// The renderer: frames each source in its panel, runs it through the paint pipeline, cuts it into
// the layout's slanted panels with thick #0A0A0D ink gutters, a cream inner bevel and an optional
// neon bleed, adds the lighting FX, then hands the poster to the lettering layer. One function
// draws both the live preview and the export, so what is on screen is what the PNG holds.
//
// Illustrated scenes are vector draw functions, so a panel draws its crop of the scene at the
// panel's own pixel size: every cut is crisp at every post size. Photos are drawn from their
// bitmap around the detected face, never centre-cropped blindly.

import { buildGeometry, layoutById, tracePanel } from './layouts.js';
import { FX_DEFAULTS, gradeById } from './looks.js';
import { paintPanel } from './filters.js';
import { renderLettering } from './lettering.js';
import { STICKER_DEFAULTS } from './editor-state.js';

export const GUTTER_INK = '#0a0a0d';
const QUALITY_CAP = { draft: 380, preview: 760, export: 2000 };
const textureCache = new Map();
const MAX_CACHE = 60;

const rgba = (hex, alpha) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const assetOf = (assets, id) => (assets && typeof assets.get === 'function' ? assets.get(id) ?? null : assets?.[id] ?? null);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sizeOfSource = (asset) => [asset.width || asset.image?.naturalWidth || asset.image?.width || 0, asset.height || asset.image?.naturalHeight || asset.image?.height || 0];

/**
 * Plan a crop for one panel. A photo with a face box centres head and shoulders and refuses to
 * zoom past clipping it; a scene keeps its subject box whole; otherwise the layout's focal point
 * is honoured, clamped so the source always covers the cut.
 */
export function planCrop(sw, sh, cfg, tw, th) {
  const rot = ((cfg.rotate ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rot));
  const sin = Math.abs(Math.sin(rot));
  const base = Math.max((tw * cos + th * sin) / sw, (tw * sin + th * cos) / sh);
  const subject = cfg.manualFocus ? null : cfg.subject;
  let zoom = clamp(cfg.zoom ?? 1, 1, 2.6);
  let fx = cfg.focusX ?? 0.5;
  let fy = cfg.focusY ?? 0.5;
  let fit = 0;
  const vw = tw / (sw * base);
  const vh = th / (sh * base);

  if (subject && cfg.scene) {
    // a scene's subject box: zoom only as far as the whole subject (plus air) still fits
    const roomy = Math.min(vw / Math.min(1, subject.w * 1.12), vh / Math.min(1, subject.h * 1.12));
    zoom = clamp(Math.min(zoom, roomy), 1, 2.6);
    fx = subject.x;
    fy = subject.y;
  } else if (subject) {
    const faceW = subject.w || 0.22;
    const faceH = subject.h || 0.22;
    const needW = clamp(faceW * 1.7, 0.24, 1);
    const needH = clamp(faceH * 1.3, 0.3, 1);
    const roomy = Math.min(vw / needW, vh / needH);
    if (roomy >= 1) {
      zoom = Math.min(zoom, roomy);
      fx = clamp(subject.x, 0.5 * needW, 1 - 0.5 * needW);
      fy = clamp(subject.y + faceH * 0.42, 0.5 * needH, 1 - 0.5 * needH);
    } else if (vh >= faceH * 0.98 && vw >= faceW * 0.98) {
      zoom = 1;
      fx = clamp(subject.x, 0.5 * faceW, 1 - 0.5 * faceW);
      fy = clamp(subject.y + faceH * 0.5, 0.5 * faceH, 1 - 0.5 * faceH);
    } else {
      // far wider than a portrait can fill: fit the face and fill the margins with a soft ground
      zoom = 1;
      fit = Math.min(tw / (sw * Math.max(faceW * 1.12, 0.12)), th / (sh * Math.max(faceH * 1.12, 0.12)));
      fx = clamp(subject.x, 0.5 * faceW, 1 - 0.5 * faceW);
      fy = clamp(subject.y, 0.5 * faceH, 1 - 0.5 * faceH);
    }
  }
  if (!fit) {
    const hw = 0.5 * Math.min(1, vw / zoom);
    const hh = 0.5 * Math.min(1, vh / zoom);
    fx = clamp(fx, hw, 1 - hw);
    fy = clamp(fy, hh, 1 - hh);
  }
  return { sw, sh, base, scale: base * zoom, fx, fy, rot, fit };
}

/** Put the source on the texture: a vector scene is drawn under the crop transform, a photo blitted. */
function drawSource(ctx, asset, plan, tw, th, cfg) {
  const { sw, sh, base, scale, fx, fy, rot, fit } = plan;
  if (cfg.flip) {
    ctx.translate(tw, 0);
    ctx.scale(-1, 1);
  }
  const paint = (use, x, y) => {
    if (asset.illustrated) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(use, use);
      ctx.beginPath();
      ctx.rect(0, 0, sw, sh);
      ctx.clip();
      asset.draw(ctx, cfg.time);
      ctx.restore();
    } else {
      ctx.drawImage(asset.image, x, y, sw * use, sh * use);
    }
  };
  if (fit) {
    ctx.save();
    ctx.globalAlpha = 0.72;
    const bw = sw * base;
    const bh = sh * base;
    paint(base, Math.min(0, Math.max(tw - bw, tw / 2 - fx * bw)), Math.min(0, Math.max(th - bh, th / 2 - fy * bh)));
    ctx.restore();
    ctx.fillStyle = 'rgba(8,2,14,0.42)';
    ctx.fillRect(0, 0, tw, th);
  }
  const use = fit || scale;
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  if (rot && !fit) {
    ctx.translate(tw / 2, th / 2);
    ctx.rotate(rot);
    paint(use, -fx * sw * use, -fy * sh * use);
  } else {
    let dx = tw / 2 - fx * sw * use;
    let dy = th / 2 - fy * sh * use;
    if (!fit) {
      dx = Math.min(0, Math.max(tw - sw * use, dx));
      dy = Math.min(0, Math.max(th - sh * use, dy));
    }
    paint(use, dx, dy);
  }
  ctx.restore();
}

function panelTexture(asset, cfg, panel, grade, fx, cap, seed) {
  const [sw, sh] = sizeOfSource(asset);
  if (!sw || !sh) return null;
  const box = panel.box;
  const ratio = Math.min(1, cap / Math.max(box.w, box.h, 1));
  const tw = Math.max(48, Math.round(box.w * ratio));
  const th = Math.max(48, Math.round(box.h * ratio));
  const key = [asset.id, asset.version ?? 1, cfg.zoom.toFixed(3), cfg.focusX.toFixed(3), cfg.focusY.toFixed(3), (cfg.rotate ?? 0).toFixed(2), cfg.flip ? 1 : 0, cfg.manualFocus ? 1 : 0, grade.id, ...Object.values(fx).map((v) => v.toFixed(2)), tw, th, seed].join('|');
  const hit = textureCache.get(key);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const crop = { ...cfg, subject: asset.focus ?? asset.subject ?? null, scene: !!asset.illustrated, time: grade.time };
  drawSource(ctx, asset, planCrop(sw, sh, crop, tw, th), tw, th, crop);
  try {
    const data = ctx.getImageData(0, 0, tw, th);
    paintPanel(data, { grade, fx, seed, illustrated: !!asset.illustrated });
    ctx.putImageData(data, 0, 0);
  } catch {
    // a tainted canvas still shows the unpainted source rather than nothing
  }
  if (textureCache.size >= MAX_CACHE) textureCache.delete(textureCache.keys().next().value);
  textureCache.set(key, canvas);
  return canvas;
}

function drawPanel(ctx, panel, texture, grade, width, height, neon) {
  const pts = panel.points;
  const box = panel.box;
  const unit = Math.min(width, height);
  const bevel = Math.max(1.1, unit * 0.0026);

  ctx.save();
  tracePanel(ctx, pts);
  ctx.clip();
  ctx.fillStyle = GUTTER_INK;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  if (texture) ctx.drawImage(texture, box.x, box.y, box.w, box.h);
  // warm key from the upper right, cool falloff at the foot, a soft vignette per cut
  ctx.fillStyle = (() => {
    const g = ctx.createLinearGradient(box.x + box.w, box.y, box.x, box.y + box.h);
    g.addColorStop(0, `rgba(${grade.light}, 0.14)`);
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(4,1,8,0.2)');
    return g;
  })();
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const v = ctx.createRadialGradient(box.x + box.w / 2, box.y + box.h / 2, Math.min(box.w, box.h) * 0.25, box.x + box.w / 2, box.y + box.h / 2, Math.max(box.w, box.h) * 0.8);
  v.addColorStop(0, 'rgba(4,1,8,0)');
  v.addColorStop(1, 'rgba(4,1,8,0.34)');
  ctx.fillStyle = v;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  // crisp cream inner bevel and an accent hairline inside it
  tracePanel(ctx, pts);
  ctx.strokeStyle = 'rgba(255,247,231,0.88)';
  ctx.lineWidth = bevel * 2;
  ctx.stroke();
  ctx.strokeStyle = rgba(grade.accent, grade.edge ?? 0.32);
  ctx.lineWidth = Math.max(1, bevel * 3.4);
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.restore();

  // the ink edge, bleeding neon into the gutter when the toggle is on
  ctx.save();
  tracePanel(ctx, pts);
  ctx.strokeStyle = GUTTER_INK;
  ctx.lineWidth = Math.max(3, unit * 0.007);
  if (neon) {
    ctx.shadowColor = rgba(grade.accent, 0.55);
    ctx.shadowBlur = Math.max(8, unit * 0.02);
  }
  ctx.stroke();
  ctx.restore();
}

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  const size = 180;
  noiseTile = document.createElement('canvas');
  noiseTile.width = noiseTile.height = size;
  const ctx = noiseTile.getContext('2d');
  const img = ctx.createImageData(size, size);
  let seed = 90210;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 120 + ((seed >>> 8) % 120);
    img.data[i + 3] = 20;
  }
  ctx.putImageData(img, 0, 0);
  return noiseTile;
}

/** Lighting FX over the art, under the type: an anamorphic sun streak and a warm film leak. */
function drawLighting(ctx, width, height, grade, stickers) {
  const unit = Math.min(width, height);
  if (stickers.flare) {
    // an anamorphic streak through a hot core in the upper-right corner, kept off the faces
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cx = width * 0.93;
    const cy = height * 0.085;
    const g = ctx.createLinearGradient(width * 0.55, 0, width, 0);
    g.addColorStop(0, 'rgba(255,200,140,0)');
    g.addColorStop(0.8, `rgba(${grade.light}, 0.4)`);
    g.addColorStop(1, 'rgba(255,248,230,0.7)');
    ctx.fillStyle = g;
    ctx.fillRect(width * 0.55, cy - unit * 0.003, width * 0.45, unit * 0.006);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.2);
    core.addColorStop(0, 'rgba(255,250,235,0.75)');
    core.addColorStop(0.25, `rgba(${grade.light}, 0.25)`);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.fillRect(cx - unit * 0.2, cy - unit * 0.2, unit * 0.4, unit * 0.4);
    for (const [t, r, a] of [[0.8, 0.018, 0.2], [0.68, 0.03, 0.1], [0.58, 0.012, 0.18]]) {
      ctx.beginPath();
      ctx.arc(width * t, cy + (0.93 - t) * height * 0.5, unit * r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${grade.light}, ${a})`;
      ctx.fill();
    }
    ctx.restore();
  }
  if (stickers.leak) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const leak = ctx.createRadialGradient(0, height, 0, 0, height, unit * 0.7);
    leak.addColorStop(0, rgba(grade.accent2, 0.42));
    leak.addColorStop(0.5, rgba(grade.accent, 0.14));
    leak.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leak;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

/** Draw the full cover. `assets` maps source ids to an illustrated scene or a photo asset. */
export function renderPoster(canvas, { width, height, state, assets, quality = 'preview' }) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const grade = gradeById(state.grade);
  const geo = buildGeometry(layoutById(state.layout), width, height);
  const cap = QUALITY_CAP[quality] ?? QUALITY_CAP.preview;
  const fx = { ...FX_DEFAULTS, ...(state.fx ?? {}) };
  const stickers = { ...STICKER_DEFAULTS, ...(state.stickers ?? {}) };

  ctx.fillStyle = GUTTER_INK;
  ctx.fillRect(0, 0, width, height);

  for (const panel of geo.panels) {
    const cfg = state.panels[panel.index] ?? { source: 'sunset-run', zoom: panel.focal.zoom, focusX: panel.focal.x, focusY: panel.focal.y, rotate: 0, flip: false };
    const panelGrade = cfg.gradeOverride && cfg.gradeOverride !== 'global' ? gradeById(cfg.gradeOverride) : grade;
    const asset = assetOf(assets, cfg.source);
    const texture = asset ? panelTexture(asset, cfg, panel, panelGrade, fx, cap, 11 + panel.index * 37) : null;
    drawPanel(ctx, panel, texture, panelGrade, width, height, stickers.neonEdge);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  drawLighting(ctx, width, height, grade, stickers);
  renderLettering(ctx, geo, state, grade, stickers);

  const trim = Math.max(2, Math.min(width, height) * 0.006);
  ctx.save();
  ctx.strokeStyle = GUTTER_INK;
  ctx.lineWidth = trim * 2;
  ctx.strokeRect(0, 0, width, height);
  ctx.restore();
  return canvas;
}

/** A small thumbnail of any source for the gallery and panel chips. */
export function paintSourceThumb(canvas, asset, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const [sw, sh] = sizeOfSource(asset);
  if (!sw) return canvas;
  const cfg = { zoom: 1.25, focusX: 0.5, focusY: 0.5, rotate: 0, subject: asset.focus ?? asset.subject ?? null, scene: !!asset.illustrated, time: null };
  drawSource(ctx, asset, planCrop(sw, sh, cfg, w, h), w, h, cfg);
  return canvas;
}
