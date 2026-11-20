// The renderer: frames each photo in its panel around the head or the vehicle, runs the crop
// through the GTA paint engine at the cover's own scale, cuts it into the inset panel with even
// ink gutters and an optional sunset or neon inner bevel, then grain, light and the face-safe
// lettering. One function draws the live preview and the export, so the PNG is what you see.

import { buildGeometry, layoutById, tracePanel } from './layouts.js';
import { FX_DEFAULTS, gradeById } from './looks.js';
import { paintPanel } from './filters.js';
import { renderLettering, resolveTitleZone } from './lettering.js';
import { STICKER_DEFAULTS } from './editor-state.js';

export const GUTTER_INK = '#0a0a0d';
const QUALITY_CAP = { draft: 420, preview: 860, export: 2400 };
const MAX_ZOOM = 3;
const textureCache = new Map();
// framing[i] is the crop panel i was last drawn with, so a manual edit starts from it
export const framing = [];

const rgba = (hex, alpha) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sizeOfSource = (a) => [a.image?.naturalWidth || a.image?.width || 0, a.image?.naturalHeight || a.image?.height || 0];
const gradient = (g, stops) => {
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
};

// Shot sizes: how many head widths and heights a face shot holds, and the margin round a vehicle.
const SHOTS = { wide: [3.6, 3.3, 1.6], medium: [2.5, 2.35, 1.28], close: [1.6, 1.5, 1.08] };

// Plans the crop of a sw × sh photo for a tw × th panel. A head is never cut: the zoom stops where
// the head box plus a margin still fits, the eyes sit on the upper third, and a panel too thin for
// the head at all shows it whole over a dimmed fill of the same photo. A vehicle lands on a third,
// facing into the room ahead of it, and when the title covers part of its panel (cfg.avoid, the
// covered rows as fractions of the panel) it moves into the larger free band above or below.
export function planCrop(sw, sh, cfg, tw, th) {
  const rot = ((cfg.rotate ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rot));
  const sin = Math.abs(Math.sin(rot));
  const base = Math.max((tw * cos + th * sin) / sw, (tw * sin + th * cos) / sh);
  const vw = tw / (sw * base);
  const vh = th / (sh * base);
  const s = cfg.manualFocus ? null : cfg.subject;
  const shot = SHOTS[cfg.shot] ?? SHOTS.medium;
  let zoom = clamp(cfg.zoom ?? 1, 1, MAX_ZOOM);
  let fx = cfg.focusX ?? 0.5;
  let fy = cfg.focusY ?? 0.5;
  let fit = 0;
  if (s?.kind === 'scene') {
    const a = cfg.avoid;
    const band = !a ? [0, 1] : a.top > 1 - a.bottom ? [0, a.top] : [a.bottom, 1];
    zoom = clamp(Math.min(vw / (s.w * shot[2]), (vh * (band[1] - band[0])) / (s.h * shot[2])), 1, MAX_ZOOM);
    const W = vw / zoom;
    fx = s.x + (s.lead ?? 0) * 0.14 * W;
    fx = W > s.w ? clamp(fx, s.x + s.w / 2 - W / 2, s.x - s.w / 2 + W / 2) : s.x;
    fy = s.y + (0.5 - (band[0] + band[1]) / 2) * (vh / zoom);
  } else if (s) {
    const most = Math.min(vw / (s.w * 1.12), vh / (s.h * 1.16));
    if (most < 1) {
      fit = Math.min(tw / (sw * s.w * 1.12), th / (sh * s.h * 1.16));
      [fx, fy] = [s.x, s.y];
    } else {
      zoom = clamp(Math.min(vw / (s.w * shot[0]), vh / (s.h * shot[1])), 1, Math.min(MAX_ZOOM, most));
      const H = vh / zoom;
      fx = s.x;
      fy = clamp(s.y + H * 0.14, s.y + s.h * 0.54 - H / 2, s.y - s.h * 0.56 + H / 2);
    }
  }
  if (!fit) {
    const hw = 0.5 * Math.min(1, vw / zoom);
    const hh = 0.5 * Math.min(1, vh / zoom);
    fx = clamp(fx, hw, 1 - hw);
    fy = clamp(fy, hh, 1 - hh);
  }
  return { sw, sh, tw, th, base, scale: base * zoom, zoom, fx, fy, rot, fit };
}

function drawSource(ctx, image, { sw, sh, base, scale, fx, fy, rot, fit }, tw, th, flip) {
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  if (flip) {
    ctx.translate(tw, 0);
    ctx.scale(-1, 1);
  }
  if (fit) {
    ctx.globalAlpha = 0.6;
    ctx.drawImage(image, clamp(tw / 2 - fx * sw * base, tw - sw * base, 0), clamp(th / 2 - fy * sh * base, th - sh * base, 0), sw * base, sh * base);
    Object.assign(ctx, { globalAlpha: 1, fillStyle: 'rgba(8,2,14,0.45)' });
    ctx.fillRect(0, 0, tw, th);
    ctx.drawImage(image, tw / 2 - fx * sw * fit, th / 2 - fy * sh * fit, sw * fit, sh * fit);
  } else {
    ctx.translate(tw / 2, th / 2);
    if (rot) ctx.rotate(rot);
    ctx.drawImage(image, -fx * sw * scale, -fy * sh * scale, sw * scale, sh * scale);
  }
  ctx.restore();
}

// Where a framed head lands inside its panel, in cover pixels: the lettering keeps clear of it.
function faceRect(subject, plan, box, tw, th, flip) {
  if (subject?.kind !== 'face') return null;
  const use = plan.fit || plan.scale;
  const k = box.w / tw;
  let cx = tw / 2 + (subject.x - plan.fx) * plan.sw * use;
  if (flip) cx = tw - cx;
  const cy = th / 2 + (subject.y - plan.fy) * plan.sh * use;
  const w = subject.w * plan.sw * use;
  const h = subject.h * plan.sh * use;
  return { x: box.x + (cx - w / 2) * k, y: box.y + (cy - h / 2) * k, w: w * k, h: h * k };
}

function panelTexture(asset, cfg, box, grade, fx, cap, seed, light, coverUnit) {
  const [sw, sh] = sizeOfSource(asset);
  if (!sw || !sh) return null;
  const ratio = Math.min(1, cap / Math.max(box.w, box.h, 1));
  const tw = Math.max(48, Math.round(box.w * ratio));
  const th = Math.max(48, Math.round(box.h * ratio));
  const crop = { ...cfg, subject: asset.subject ?? null };
  const plan = planCrop(sw, sh, crop, tw, th);
  const face = faceRect(crop.subject, plan, box, tw, th, cfg.flip);
  const key = [asset.id, asset.version ?? 1, cfg.shot, cfg.zoom.toFixed(3), cfg.focusX.toFixed(3), cfg.focusY.toFixed(3), (cfg.rotate ?? 0).toFixed(2), cfg.flip ? 1 : 0, cfg.avoid ? `${cfg.avoid.top.toFixed(2)}-${cfg.avoid.bottom.toFixed(2)}` : '', cfg.manualFocus ? 1 : 0, grade.id, ...Object.values(fx).map((v) => v.toFixed(2)), tw, th, seed, light].join('|');
  let canvas = textureCache.get(key);
  if (!canvas) {
    canvas = Object.assign(document.createElement('canvas'), { width: tw, height: th });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    drawSource(ctx, asset.image, plan, tw, th, cfg.flip);
    try {
      ctx.putImageData(paintPanel(ctx.getImageData(0, 0, tw, th), { grade, fx, seed, light, unit: coverUnit * ratio }), 0, 0);
    } catch {
      // a tainted canvas keeps the plain framed photo
    }
    if (textureCache.size >= 48) textureCache.delete(textureCache.keys().next().value);
    textureCache.set(key, canvas);
  }
  return { canvas, plan, face };
}

// An empty panel still reads as part of the cover: the grade's own sky over a banded sun.
function drawSkyFallback(ctx, { x, y, w, h }, grade) {
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, y, 0, y + h), [[0, grade.sky[0]], [0.6, grade.sky[1]], [0.86, grade.sky[2]], [0.861, GUTTER_INK], [1, '#1a0b24']]);
  ctx.fillRect(x, y, w, h);
  const r = Math.min(w, h) * 0.3;
  const cx = x + w / 2;
  const cy = y + h * 0.86;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h * 0.86);
  ctx.clip();
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, cy - r, 0, cy), [[0, '#fff3c4'], [1, grade.accent]]);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = grade.sky[1];
  for (let k = 0; k < 4; k++) ctx.fillRect(cx - r, cy - r * (0.5 - k * 0.14), r * 2, r * (0.035 + k * 0.025));
  ctx.restore();
}

function drawPanel(ctx, { points, box }, texture, grade, unit, bevel) {
  const fill = (style) => {
    ctx.fillStyle = style;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  };
  ctx.save();
  tracePanel(ctx, points);
  ctx.clip();
  if (texture) ctx.drawImage(texture, box.x, box.y, box.w, box.h);
  else drawSkyFallback(ctx, box, grade);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  fill(gradient(ctx.createRadialGradient(cx, cy, Math.min(box.w, box.h) * 0.3, cx, cy, Math.hypot(box.w, box.h) * 0.62), [[0, 'rgba(6,1,12,0)'], [1, 'rgba(6,1,12,0.32)']]));
  if (bevel) {
    // the inner bevel: a lit top-left edge in the grade's light and an accent glow along the rest
    tracePanel(ctx, points);
    Object.assign(ctx, { lineWidth: Math.max(3, unit * 0.007), strokeStyle: gradient(ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h), [[0, `rgba(${grade.light}, 0.95)`], [0.5, rgba(grade.accent, 0.75)], [1, rgba(grade.accent2, 0.85)]]), shadowColor: rgba(grade.accent, 0.8), shadowBlur: unit * 0.012 });
    ctx.stroke();
    Object.assign(ctx, { lineWidth: Math.max(1, unit * 0.0016), strokeStyle: 'rgba(255,250,240,0.7)', shadowBlur: 0 });
    ctx.stroke();
  }
  ctx.restore();
}

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  noiseTile = Object.assign(document.createElement('canvas'), { width: 160, height: 160 });
  const ctx = noiseTile.getContext('2d');
  const img = ctx.createImageData(160, 160);
  for (let i = 0, seed = 90210; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 110 + ((seed >>> 8) % 130);
    img.data[i + 3] = 22;
  }
  ctx.putImageData(img, 0, 0);
  return noiseTile;
}

function drawFlare(ctx, width, height, grade) {
  const unit = Math.min(width, height);
  const cx = width * 0.9;
  const cy = height * 0.1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient(ctx.createLinearGradient(width * 0.6, 0, width, 0), [[0, 'rgba(255,200,140,0)'], [0.8, `rgba(${grade.light}, 0.3)`], [1, 'rgba(255,248,230,0.5)']]);
  ctx.fillRect(width * 0.6, cy - unit * 0.002, width * 0.4, unit * 0.004);
  ctx.fillStyle = gradient(ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.18), [[0, 'rgba(255,250,235,0.6)'], [0.3, `rgba(${grade.light}, 0.2)`], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(cx - unit * 0.18, cy - unit * 0.18, unit * 0.36, unit * 0.36);
  ctx.restore();
}

// The rows of a panel the title band covers, when it covers most of its width but leaves room.
function titleRows(zone, box) {
  const wide = Math.min(zone.x + zone.w, box.x + box.w) - Math.max(zone.x, box.x) > box.w * 0.4;
  const top = (Math.max(zone.y, box.y) - box.y) / box.h;
  const bottom = (Math.min(zone.y + zone.h, box.y + box.h) - box.y) / box.h;
  return wide && bottom > top && Math.max(top, 1 - bottom) > 0.3 ? { top, bottom } : null;
}

export function renderPoster(canvas, { width, height, state, assets, quality = 'preview', record = false }) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  Object.assign(ctx, { imageSmoothingEnabled: true, imageSmoothingQuality: 'high', fillStyle: GUTTER_INK });
  const unit = Math.min(width, height);
  const grade = gradeById(state.grade);
  const geo = buildGeometry(layoutById(state.layout), width, height);
  const fx = { ...FX_DEFAULTS, ...state.fx };
  const stickers = { ...STICKER_DEFAULTS, ...state.stickers };
  const faces = [];
  const zone = resolveTitleZone(geo, state);
  ctx.fillRect(0, 0, width, height);
  if (record) framing.length = 0;
  for (const panel of geo.panels) {
    const cfg = state.panels[panel.index];
    const panelGrade = cfg?.gradeOverride && cfg.gradeOverride !== 'global' ? gradeById(cfg.gradeOverride) : grade;
    const asset = cfg && assets.get(cfg.source);
    const light = panel.cx < width / 2 ? -1 : 1;
    const tex = asset ? panelTexture(asset, { ...cfg, avoid: titleRows(zone, panel.box) }, panel.box, panelGrade, fx, QUALITY_CAP[quality] ?? 860, 11 + panel.index * 37, light, unit) : null;
    if (tex?.face) faces.push(tex.face);
    if (record) framing[panel.index] = tex?.plan ?? null;
    drawPanel(ctx, panel, tex?.canvas, panelGrade, unit, stickers.bevel);
  }
  ctx.save();
  Object.assign(ctx, { globalCompositeOperation: 'overlay', globalAlpha: 0.45, fillStyle: ctx.createPattern(grainTile(), 'repeat') });
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  if (stickers.flare) drawFlare(ctx, width, height, grade);
  renderLettering(ctx, geo, state, grade, stickers, faces);
  canvas.dataset.faces = faces.length;
  return canvas;
}

export function paintSourceThumb(canvas, asset, w, h) {
  canvas.width = w;
  canvas.height = h;
  const [sw, sh] = sizeOfSource(asset);
  if (sw) drawSource(canvas.getContext('2d'), asset.image, planCrop(sw, sh, { shot: 'medium', subject: asset.subject }, w, h), w, h, false);
  return canvas;
}

// The before/after widget: the raw photo on the left of `split`, the painted cover look on the
// right, a divider with a handle, and the two labels.
let compared = {};
export function paintCompare(canvas, asset, grade, fx, split = 0.5) {
  const { width: w, height: h } = canvas;
  const key = [asset.id, asset.version, grade.id, w, h, ...Object.values(fx)].join('|');
  if (compared.key !== key) {
    const art = paintSourceThumb(document.createElement('canvas'), asset, w, h);
    const actx = art.getContext('2d', { willReadFrequently: true });
    actx.putImageData(paintPanel(actx.getImageData(0, 0, w, h), { grade, fx: { ...FX_DEFAULTS, ...fx }, unit: h * 2.4 }), 0, 0);
    compared = { key, art, raw: paintSourceThumb(document.createElement('canvas'), asset, w, h) };
  }
  const { raw, art } = compared;
  const ctx = canvas.getContext('2d');
  const sx = Math.round(w * clamp(split, 0.05, 0.95));
  ctx.drawImage(raw, 0, 0);
  ctx.drawImage(art, sx, 0, w - sx, h, sx, 0, w - sx, h);
  Object.assign(ctx, { fillStyle: '#fff', shadowColor: 'rgba(0,0,0,0.6)', shadowBlur: 6 });
  ctx.fillRect(sx - 1.5, 0, 3, h);
  ctx.beginPath();
  ctx.arc(sx, h / 2, h * 0.09, 0, Math.PI * 2);
  ctx.fill();
  Object.assign(ctx, { shadowBlur: 0, fillStyle: '#0a0a0d', font: `900 ${h * 0.09}px 'VP Text', sans-serif`, textAlign: 'center', textBaseline: 'middle' });
  ctx.fillText('‹ ›', sx, h / 2);
  ctx.textAlign = 'left';
  for (const [text, x, bg, ink] of [['RAW PHOTO', w * 0.03, 'rgba(10,10,13,0.82)', '#fff'], ['GTA PAINT', w * 0.97, grade.accent, '#0a0a0d']]) {
    const tw = ctx.measureText(text).width + h * 0.1;
    const left = x > w / 2 ? x - tw : x;
    ctx.fillStyle = bg;
    ctx.fillRect(left, h * 0.83, tw, h * 0.13);
    ctx.fillStyle = ink;
    ctx.fillText(text, left + h * 0.05, h * 0.9);
  }
}
