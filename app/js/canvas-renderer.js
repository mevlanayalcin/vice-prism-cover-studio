// The renderer: crops each source through the painterly pipeline, cuts it into the layout's
// slanted panels, adds jet-black gutters, a crisp cream inner bevel and a neon bleed, then hands
// the poster to the lettering layer. One function draws both the live preview and the export, so
// what is on screen is what the PNG holds.

import { buildGeometry, layoutById, tracePanel } from './layouts.js';
import { FX_DEFAULTS, gradeById, paintPanel } from './filters.js';
import { renderLettering } from './lettering.js';

const QUALITY_CAP = { draft: 330, preview: 580, export: 900 };
const textureCache = new Map();
const MAX_CACHE = 36;

const rgba = (hex, alpha) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const assetOf = (assets, id) => {
  if (!assets) return null;
  if (typeof assets.get === 'function') return assets.get(id) ?? null;
  return assets[id] ?? null;
};

function panelTexture(asset, cfg, panel, grade, fx, cap, seed) {
  if (!asset?.image) return null;
  const image = asset.image;
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;
  if (!sw || !sh) return null;

  const box = panel.box;
  const ratio = Math.min(1, cap / Math.max(box.w, box.h, 1));
  const tw = Math.max(48, Math.round(box.w * ratio));
  const th = Math.max(48, Math.round(box.h * ratio));
  const key = [
    asset.id ?? cfg.source,
    asset.version ?? 1,
    cfg.zoom.toFixed(3),
    cfg.focusX.toFixed(3),
    cfg.focusY.toFixed(3),
    (cfg.rotate ?? 0).toFixed(2),
    cfg.flip ? 1 : 0,
    grade.id,
    fx.paint.toFixed(2),
    fx.ink.toFixed(2),
    fx.halftone.toFixed(2),
    fx.grain.toFixed(2),
    fx.grade.toFixed(2),
    cap,
    tw,
    th,
    seed,
  ].join('|');
  const hit = textureCache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.save();
  ctx.translate(tw / 2, th / 2);
  const rot = ((cfg.rotate ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rot));
  const sin = Math.abs(Math.sin(rot));
  const cover = Math.max((tw * cos + th * sin) / sw, (tw * sin + th * cos) / sh);
  const scale = cover * Math.max(0.2, cfg.zoom ?? 1);
  if (cfg.flip) ctx.scale(-1, 1);
  ctx.rotate(rot);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, -(cfg.focusX ?? 0.5) * sw * scale, -(cfg.focusY ?? 0.5) * sh * scale, sw * scale, sh * scale);
  ctx.restore();

  let data = null;
  try {
    data = ctx.getImageData(0, 0, tw, th);
  } catch {
    data = null;
  }
  if (data) {
    paintPanel(data, { grade, fx, seed });
    ctx.putImageData(data, 0, 0);
  }

  if (textureCache.size >= MAX_CACHE) {
    const oldest = textureCache.keys().next().value;
    textureCache.delete(oldest);
  }
  textureCache.set(key, canvas);
  return canvas;
}

function drawPanel(ctx, geo, panel, texture, grade, width, height) {
  const pts = panel.points;
  const box = panel.box;
  const accent = grade.accent;
  const bevel = Math.max(1.1, Math.min(width, height) * 0.0028);
  const outer = Math.max(3, Math.min(width, height) * 0.0075);

  ctx.save();
  tracePanel(ctx, pts);
  ctx.clip();
  ctx.fillStyle = '#07030c';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  if (texture) {
    ctx.drawImage(texture, box.x, box.y, box.w, box.h);
  } else {
    const fallback = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    fallback.addColorStop(0, '#2a0b3e');
    fallback.addColorStop(0.55, rgba(grade.accent, 0.55));
    fallback.addColorStop(1, '#12051c');
    ctx.fillStyle = fallback;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }

  // warm light leak from the upper right, cool shadow at the foot
  const light = ctx.createLinearGradient(box.x + box.w, box.y, box.x, box.y + box.h);
  light.addColorStop(0, `rgba(${grade.light}, 0.16)`);
  light.addColorStop(0.42, 'rgba(255,255,255,0)');
  light.addColorStop(1, 'rgba(4,1,8,0.24)');
  ctx.fillStyle = light;
  ctx.fillRect(box.x, box.y, box.w, box.h);

  const glow = ctx.createRadialGradient(box.x + box.w * 0.82, box.y + box.h * 0.18, 0, box.x + box.w * 0.82, box.y + box.h * 0.18, Math.max(box.w, box.h) * 0.8);
  const bloom = grade.bloom ?? 0.2;
  glow.addColorStop(0, `rgba(${grade.light}, ${bloom})`);
  glow.addColorStop(0.45, `rgba(${grade.light}, ${bloom * 0.25})`);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(box.x, box.y, box.w, box.h);

  const vignette = ctx.createRadialGradient(box.x + box.w / 2, box.y + box.h / 2, Math.min(box.w, box.h) * 0.18, box.x + box.w / 2, box.y + box.h / 2, Math.max(box.w, box.h) * 0.78);
  vignette.addColorStop(0, 'rgba(4,1,8,0)');
  vignette.addColorStop(0.76, 'rgba(4,1,8,0.12)');
  vignette.addColorStop(1, 'rgba(4,1,8,0.46)');
  ctx.fillStyle = vignette;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.restore();

  // crisp cream inner bevel: the visible half of a double-width stroke clipped to the panel
  ctx.save();
  tracePanel(ctx, pts);
  ctx.clip();
  tracePanel(ctx, pts);
  ctx.strokeStyle = 'rgba(255,247,231,0.9)';
  ctx.lineWidth = bevel * 2;
  ctx.stroke();
  tracePanel(ctx, pts);
  ctx.strokeStyle = rgba(accent, grade.edge ?? 0.32);
  ctx.lineWidth = Math.max(1, bevel * 0.7);
  ctx.stroke();
  ctx.restore();

  // black edge with a neon bleed into the gutters
  ctx.save();
  tracePanel(ctx, pts);
  ctx.strokeStyle = 'rgba(6,2,9,0.96)';
  ctx.lineWidth = outer;
  ctx.shadowColor = rgba(accent, 0.34);
  ctx.shadowBlur = Math.max(8, height * 0.018);
  ctx.stroke();
  ctx.restore();

  // small comic corner ticks, only on the two leading corners
  const tick = Math.min(box.w, box.h) * 0.07;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,246,226,0.62)';
  ctx.lineWidth = Math.max(1.2, bevel * 1.1);
  ctx.beginPath();
  ctx.moveTo(box.x + tick, box.y + bevel * 1.8);
  ctx.lineTo(box.x + bevel * 1.8, box.y + bevel * 1.8);
  ctx.lineTo(box.x + bevel * 1.8, box.y + tick);
  ctx.moveTo(box.x + box.w - tick, box.y + box.h - bevel * 1.8);
  ctx.lineTo(box.x + box.w - bevel * 1.8, box.y + box.h - bevel * 1.8);
  ctx.lineTo(box.x + box.w - bevel * 1.8, box.y + box.h - tick);
  ctx.stroke();
  ctx.restore();
}

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  const size = 180;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  let seed = 90210;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = 120 + ((seed >>> 8) % 120);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 20;
  }
  ctx.putImageData(img, 0, 0);
  noiseTile = canvas;
  return canvas;
}

/** Draw the full cover. `assets` maps source ids to { image, version }. */
export function renderPoster(canvas, { width, height, state, assets, quality = 'preview' }) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const grade = gradeById(state.grade);
  const layout = layoutById(state.layout);
  const geo = buildGeometry(layout, width, height);
  const cap = QUALITY_CAP[quality] ?? QUALITY_CAP.preview;
  const fx = { ...FX_DEFAULTS, ...(state.fx ?? {}) };

  // deep plum studio board, lightly lit so the gutters read black rather than flat
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0b0414');
  bg.addColorStop(0.55, '#07020c');
  bg.addColorStop(1, '#0e0417');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const halo = ctx.createRadialGradient(width * 0.7, height * 0.12, 0, width * 0.7, height * 0.12, Math.max(width, height) * 0.8);
  halo.addColorStop(0, rgba(grade.accent, 0.12));
  halo.addColorStop(0.5, rgba(grade.accent2, 0.05));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  for (const panel of geo.panels) {
    const cfg = state.panels[panel.index] ?? {
      source: 'sunset-city',
      zoom: panel.focal.zoom,
      focusX: panel.focal.x,
      focusY: panel.focal.y,
      rotate: 0,
      flip: false,
    };
    const panelGrade = cfg.gradeOverride && cfg.gradeOverride !== 'global' ? gradeById(cfg.gradeOverride) : grade;
    const asset = assetOf(assets, cfg.source);
    const texture = asset ? panelTexture(asset, cfg, panel, panelGrade, fx, cap, 11 + panel.index * 37) : null;
    if (state.debugTextures && typeof window !== 'undefined') {
      (window.__vpDebugTextures ??= []).push(texture ? texture.toDataURL('image/png') : null);
    }
    drawPanel(ctx, geo, panel, texture, panelGrade, width, height);
  }

  // a quiet print tooth over everything before the type is laid down
  if (!state.debugNoGrain) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  if (!state.debugNoLettering) renderLettering(ctx, geo, state, grade);

  // print frame: black tooth at the trim and a whisper of a keyline
  const trim = Math.max(2, Math.min(width, height) * 0.006);
  ctx.save();
  ctx.strokeStyle = 'rgba(5,2,8,0.9)';
  ctx.lineWidth = trim * 2;
  ctx.strokeRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(255,246,226,0.18)';
  ctx.lineWidth = Math.max(1, trim * 0.4);
  ctx.strokeRect(trim * 1.6, trim * 1.6, width - trim * 3.2, height - trim * 3.2);
  ctx.restore();

  return canvas;
}

/** Drop cached textures (used when a new photo replaces an existing source). */
export function clearTextureCache() {
  textureCache.clear();
}
