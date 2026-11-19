// The renderer: crops each source through the painterly pipeline, cuts it into the layout's
// slanted panels, adds jet-black gutters, a crisp cream inner bevel and a neon bleed, then hands
// the poster to the lettering layer. One function draws both the live preview and the export, so
// what is on screen is what the PNG holds.
//
// Smart framing lives here too: a photo of a person is never centre-cropped blindly. The crop
// seeks the subject's face and keeps the head and shoulders inside the cut, falling back to a
// soft, blurred fill only when a cut is far wider than a portrait can fill.

import { buildGeometry, layoutById, tracePanel } from './layouts.js';
import { FX_DEFAULTS, gradeById, paintPanel } from './filters.js';
import { renderLettering } from './lettering.js';

const QUALITY_CAP = { draft: 340, preview: 620, export: 980 };
const textureCache = new Map();
const MAX_CACHE = 42;

const rgba = (hex, alpha) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const assetOf = (assets, id) => {
  if (!assets) return null;
  if (typeof assets.get === 'function') return assets.get(id) ?? null;
  return assets[id] ?? null;
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Plan a crop for one panel. With a subject (a detected face box in normalised image space)
 * the plan centres the head and shoulders and refuses to zoom past the point where the subject
 * would be clipped. Without one it honours the layout's focal point, clamped so the image
 * always covers the cut.
 */
function planCrop(image, cfg, box, tw, th) {
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;
  const rot = ((cfg.rotate ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rot));
  const sin = Math.abs(Math.sin(rot));
  const base = Math.max((tw * cos + th * sin) / sw, (tw * sin + th * cos) / sh);
  const subject = !cfg.manualFocus ? cfg.subject : null;
  let zoom = Math.max(1, Math.min(2.6, cfg.zoom ?? 1));
  let fx = cfg.focusX ?? 0.5;
  let fy = cfg.focusY ?? 0.5;
  let fit = 0;

  if (subject) {
    const faceW = subject.w || 0.22;
    const faceH = subject.h || 0.22;
    // A comfortable head-and-shoulders box, then the face itself as the non-negotiable core.
    const needW = clamp(faceW * 1.7, 0.24, 1);
    const needH = clamp(faceH * 1.3, 0.3, 1);
    const vw = tw / (sw * base);
    const vh = th / (sh * base);
    const roomy = Math.min(vw / needW, vh / needH);
    if (roomy >= 1) {
      zoom = Math.min(zoom, roomy);
      fx = clamp(subject.x, 0.5 * needW, 1 - 0.5 * needW);
      fy = clamp(subject.y + faceH * 0.42, 0.5 * needH, 1 - 0.5 * needH);
    } else if (vh >= faceH * 0.98 && vw >= faceW * 0.98) {
      // A letterbox cut: the face fits exactly, so centre it and let the shoulders crop.
      zoom = 1;
      fx = clamp(subject.x, 0.5 * faceW, 1 - 0.5 * faceW);
      fy = clamp(subject.y + faceH * 0.5, 0.5 * faceH, 1 - 0.5 * faceH);
    } else {
      // The cut is wider than the portrait can cover: fit the face whole and fill the
      // remaining margins with a soft, darkened enlargement of the same photo.
      zoom = 1;
      fit = Math.min(tw / (sw * Math.max(faceW * 1.12, 0.12)), th / (sh * Math.max(faceH * 1.12, 0.12)));
      fx = clamp(subject.x, 0.5 * faceW, 1 - 0.5 * faceW);
      fy = clamp(subject.y, 0.5 * faceH, 1 - 0.5 * faceH);
    }
  } else {
    // Keep the requested centre inside the image so no bare gutter ever shows through.
    fx = clamp(fx, 0.5 * Math.min(1, tw / (sw * base * zoom)), 1 - 0.5 * Math.min(1, tw / (sw * base * zoom)));
    fy = clamp(fy, 0.5 * Math.min(1, th / (sh * base * zoom)), 1 - 0.5 * Math.min(1, th / (sh * base * zoom)));
  }

  const scale = base * zoom;
  return { sw, sh, base, scale, fx, fy, rot, fit, subject: !!subject };
}

function drawPhoto(ctx, image, plan, tw, th, cfg) {
  const { sw, sh, base, scale, fx, fy, rot, fit } = plan;
  if (cfg.flip) {
    ctx.translate(tw, 0);
    ctx.scale(-1, 1);
  }

  if (fit) {
    // Blurred full-bleed ground, then the whole portrait fitted at the subject's scale.
    ctx.save();
    ctx.globalAlpha = 0.72;
    const bw = sw * base;
    const bh = sh * base;
    const bdx = Math.min(0, Math.max(tw - bw, tw / 2 - fx * bw));
    const bdy = Math.min(0, Math.max(th - bh, th / 2 - fy * bh));
    ctx.drawImage(image, bdx, bdy, bw, bh);
    ctx.restore();
    const shade = ctx.createLinearGradient(0, 0, tw, th);
    shade.addColorStop(0, 'rgba(8,2,14,0.34)');
    shade.addColorStop(1, 'rgba(8,2,14,0.5)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, tw, th);
  }

  const use = fit || scale;
  let dx = tw / 2 - fx * sw * use;
  let dy = th / 2 - fy * sh * use;
  if (!fit) {
    // Never let the photo float inside the cut: clamp its origin so it always covers the
    // texture. Without this a tall panel could leave a dark strip above a portrait's head.
    const imgW = sw * use;
    const imgH = sh * use;
    dx = Math.min(0, Math.max(tw - imgW, dx));
    dy = Math.min(0, Math.max(th - imgH, dy));
  }
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (rot && !fit) {
    ctx.translate(tw / 2, th / 2);
    ctx.rotate(rot);
    ctx.drawImage(image, -fx * sw * use, -fy * sh * use, sw * use, sh * use);
  } else {
    ctx.drawImage(image, dx, dy, sw * use, sh * use);
  }
  ctx.restore();
}

/** Measure painted pixels so a flat or near-black cut can be enriched instead of shipped. */
function textureMood(data) {
  let n = 0;
  let sum = 0;
  let sum2 = 0;
  for (let i = 0; i < data.length; i += 64) {
    const l = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    sum += l;
    sum2 += l * l;
    n++;
  }
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sum2 / n - mean * mean)) };
}

/**
 * A deterministic prism wash. It is used only where a crop landed on a genuinely empty field
 * (deep night water, a blank sky): rays, a warm horizon and print streaks keep every one of the
 * six cuts a painted panel rather than a black box.
 */
function enrichTexture(canvas, grade, seed) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, rgba(grade.accent, 0.34));
  base.addColorStop(0.46, rgba(grade.accent2, 0.2));
  base.addColorStop(1, rgba(grade.accent, 0.1));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const halo = ctx.createRadialGradient(w * 0.36, h * 0.72, 0, w * 0.36, h * 0.72, Math.max(w, h) * 0.8);
  halo.addColorStop(0, 'rgba(255,206,146,0.5)');
  halo.addColorStop(1, 'rgba(255,120,90,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  let s = seed >>> 0;
  for (let i = 0; i < 26; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const y = (s % 1000) / 1000 * h;
    const alpha = 0.05 + ((s >>> 10) % 100) / 420;
    ctx.fillStyle = `rgba(255,214,160,${alpha})`;
    ctx.fillRect(0, y, w, Math.max(1, h * 0.004));
  }
  ctx.restore();
}

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
  const subjectKey = cfg.subject ? `${cfg.subject.x.toFixed(2)}:${cfg.subject.y.toFixed(2)}` : 'auto';
  const key = [
    asset.id ?? cfg.source,
    asset.version ?? 1,
    cfg.zoom.toFixed(3),
    cfg.focusX.toFixed(3),
    cfg.focusY.toFixed(3),
    (cfg.rotate ?? 0).toFixed(2),
    cfg.flip ? 1 : 0,
    cfg.manualFocus ? 1 : 0,
    subjectKey,
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
  const plan = planCrop(image, cfg, box, tw, th);
  drawPhoto(ctx, image, plan, tw, th, cfg);

  let data = null;
  try {
    data = ctx.getImageData(0, 0, tw, th);
  } catch {
    data = null;
  }
  if (data) {
    paintPanel(data, { grade, fx, seed });
    const mood = textureMood(data);
    if (mood.mean < 52 || mood.std < 16) enrichTexture(canvas, grade, seed * 31 + tw);
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
  light.addColorStop(1, 'rgba(4,1,8,0.22)');
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
  vignette.addColorStop(0.76, 'rgba(4,1,8,0.1)');
  vignette.addColorStop(1, 'rgba(4,1,8,0.42)');
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

/** Draw the full cover. `assets` maps source ids to { image, subject, version }. */
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
    const crop = asset?.subject ? { ...cfg, subject: asset.subject } : cfg;
    const texture = asset ? panelTexture(asset, crop, panel, panelGrade, fx, cap, 11 + panel.index * 37) : null;
    drawPanel(ctx, geo, panel, texture, panelGrade, width, height);
  }

  // a quiet print tooth over everything before the type is laid down
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  renderLettering(ctx, geo, state, grade);

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