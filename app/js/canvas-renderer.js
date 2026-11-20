// The renderer: frames each source in its panel around the face or subject, runs it through the
// GTA paint engine, cuts it into slanted panels with #0A0A0D ink gutters, adds light FX and the
// lettering. One function draws the live preview and the export, so the PNG is what you see.

import { buildGeometry, layoutById, tracePanel } from './layouts.js';
import { FX_DEFAULTS, gradeById } from './looks.js';
import { paintPanel } from './filters.js';
import { renderLettering } from './lettering.js';
import { STICKER_DEFAULTS } from './editor-state.js';

export const GUTTER_INK = '#0a0a0d';
const QUALITY_CAP = { draft: 380, preview: 760, export: 2000 };
const textureCache = new Map();

const rgba = (hex, alpha) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sizeOfSource = (a) => [a.width || a.image?.naturalWidth || a.image?.width || 0, a.height || a.image?.naturalHeight || a.image?.height || 0];
const gradient = (g, stops) => {
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
};

export function planCrop(sw, sh, cfg, tw, th) {
  const rot = ((cfg.rotate ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rot));
  const sin = Math.abs(Math.sin(rot));
  const base = Math.max((tw * cos + th * sin) / sw, (tw * sin + th * cos) / sh);
  const subject = cfg.manualFocus ? null : cfg.subject;
  const vw = tw / (sw * base);
  const vh = th / (sh * base);
  let zoom = clamp(cfg.zoom ?? 1, 1, 2.6);
  let fx = cfg.focusX ?? 0.5;
  let fy = cfg.focusY ?? 0.5;
  let fit = 0;
  if (subject && cfg.scene) {
    zoom = clamp(Math.min(zoom, vw / Math.min(1, subject.w * 1.12), vh / Math.min(1, subject.h * 1.12)), 1, 2.6);
    fx = subject.x;
    fy = subject.y;
  } else if (subject) {
    const faceW = subject.w || 0.22;
    const faceH = subject.h || 0.22;
    const needW = clamp(faceW * 1.55, 0.24, 1);
    const needH = clamp(faceH * 1.25, 0.3, 1);
    const roomy = Math.min(vw / needW, vh / needH);
    const centre = (w, h, dy) => [clamp(subject.x, 0.5 * w, 1 - 0.5 * w), clamp(subject.y + faceH * dy, 0.5 * h, 1 - 0.5 * h)];
    if (roomy >= 1) {
      zoom = Math.min(Math.max(zoom, 1.45), roomy);
      [fx, fy] = centre(needW, needH, 0.42);
    } else {
      zoom = 1;
      const fits = vh >= faceH * 0.98 && vw >= faceW * 0.98;
      if (!fits) fit = Math.min(tw / (sw * Math.max(faceW * 1.12, 0.12)), th / (sh * Math.max(faceH * 1.12, 0.12)));
      [fx, fy] = centre(faceW, faceH, fits ? 0.5 : 0);
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

function drawSource(ctx, asset, { sw, sh, base, scale, fx, fy, rot, fit }, tw, th, cfg) {
  if (cfg.flip) {
    ctx.translate(tw, 0);
    ctx.scale(-1, 1);
  }
  const paint = (use, x, y) => {
    if (!asset.illustrated) return ctx.drawImage(asset.image, x, y, sw * use, sh * use);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(use, use);
    ctx.beginPath();
    ctx.rect(0, 0, sw, sh);
    ctx.clip();
    asset.draw(ctx, cfg.time);
    ctx.restore();
  };
  if (fit) {
    ctx.save();
    ctx.globalAlpha = 0.72;
    paint(base, Math.min(0, Math.max(tw - sw * base, tw / 2 - fx * sw * base)), Math.min(0, Math.max(th - sh * base, th / 2 - fy * sh * base)));
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
    const dx = tw / 2 - fx * sw * use;
    const dy = th / 2 - fy * sh * use;
    paint(use, fit ? dx : Math.min(0, Math.max(tw - sw * use, dx)), fit ? dy : Math.min(0, Math.max(th - sh * use, dy)));
  }
  ctx.restore();
}

function panelTexture(asset, cfg, box, grade, fx, cap, seed, light) {
  const [sw, sh] = sizeOfSource(asset);
  if (!sw || !sh) return null;
  const ratio = Math.min(1, cap / Math.max(box.w, box.h, 1));
  const tw = Math.max(48, Math.round(box.w * ratio));
  const th = Math.max(48, Math.round(box.h * ratio));
  const key = [asset.id, asset.version ?? 1, cfg.zoom.toFixed(3), cfg.focusX.toFixed(3), cfg.focusY.toFixed(3), (cfg.rotate ?? 0).toFixed(2), cfg.flip ? 1 : 0, cfg.manualFocus ? 1 : 0, grade.id, ...Object.values(fx).map((v) => v.toFixed(2)), tw, th, seed, light].join('|');
  if (textureCache.has(key)) return textureCache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const crop = { ...cfg, subject: asset.focus ?? asset.subject ?? null, scene: !!asset.illustrated, time: grade.time };
  drawSource(ctx, asset, planCrop(sw, sh, crop, tw, th), tw, th, crop);
  try {
    ctx.putImageData(paintPanel(ctx.getImageData(0, 0, tw, th), { grade, fx, seed, light, illustrated: !!asset.illustrated }), 0, 0);
  } catch {
  }
  if (textureCache.size >= 60) textureCache.delete(textureCache.keys().next().value);
  textureCache.set(key, canvas);
  return canvas;
}

function drawPanel(ctx, { points, box }, texture, grade, unit, neon) {
  const bevel = Math.max(1.1, unit * 0.0026);
  const fill = (style) => {
    ctx.fillStyle = style;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  };
  ctx.save();
  tracePanel(ctx, points);
  ctx.clip();
  fill(GUTTER_INK);
  if (texture) ctx.drawImage(texture, box.x, box.y, box.w, box.h);
  fill(gradient(ctx.createLinearGradient(box.x + box.w, box.y, box.x, box.y + box.h), [[0, `rgba(${grade.light}, 0.14)`], [0.45, 'rgba(255,255,255,0)'], [1, 'rgba(4,1,8,0.2)']]));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  fill(gradient(ctx.createRadialGradient(cx, cy, Math.min(box.w, box.h) * 0.25, cx, cy, Math.max(box.w, box.h) * 0.8), [[0, 'rgba(4,1,8,0)'], [1, 'rgba(4,1,8,0.34)']]));
  tracePanel(ctx, points);
  Object.assign(ctx, { strokeStyle: 'rgba(255,247,231,0.88)', lineWidth: bevel * 2 });
  ctx.stroke();
  Object.assign(ctx, { strokeStyle: rgba(grade.accent, grade.edge ?? 0.32), lineWidth: Math.max(1, bevel * 3.4), globalAlpha: 0.5 });
  ctx.stroke();
  ctx.restore();
  ctx.save();
  tracePanel(ctx, points);
  Object.assign(ctx, { strokeStyle: GUTTER_INK, lineWidth: Math.max(3, unit * 0.007) });
  if (neon) Object.assign(ctx, { shadowColor: rgba(grade.accent, 0.55), shadowBlur: Math.max(8, unit * 0.02) });
  ctx.stroke();
  ctx.restore();
}

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  noiseTile = document.createElement('canvas');
  noiseTile.width = noiseTile.height = 180;
  const ctx = noiseTile.getContext('2d');
  const img = ctx.createImageData(180, 180);
  for (let i = 0, seed = 90210; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 120 + ((seed >>> 8) % 120);
    img.data[i + 3] = 20;
  }
  ctx.putImageData(img, 0, 0);
  return noiseTile;
}

function drawLighting(ctx, width, height, grade, stickers) {
  const unit = Math.min(width, height);
  if (stickers.flare) {
    const cx = width * 0.93;
    const cy = height * 0.085;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gradient(ctx.createLinearGradient(width * 0.72, 0, width, 0), [[0, 'rgba(255,200,140,0)'], [0.8, `rgba(${grade.light}, 0.3)`], [1, 'rgba(255,248,230,0.55)']]);
    ctx.fillRect(width * 0.72, cy - unit * 0.002, width * 0.28, unit * 0.004);
    ctx.fillStyle = gradient(ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.2), [[0, 'rgba(255,250,235,0.75)'], [0.25, `rgba(${grade.light}, 0.25)`], [1, 'rgba(0,0,0,0)']]);
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
    ctx.fillStyle = gradient(ctx.createRadialGradient(0, height, 0, 0, height, unit * 0.7), [[0, rgba(grade.accent2, 0.42)], [0.5, rgba(grade.accent, 0.14)], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

export function renderPoster(canvas, { width, height, state, assets, quality = 'preview' }) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  Object.assign(ctx, { imageSmoothingEnabled: true, imageSmoothingQuality: 'high', fillStyle: GUTTER_INK });
  const unit = Math.min(width, height);
  const grade = gradeById(state.grade);
  const geo = buildGeometry(layoutById(state.layout), width, height);
  const fx = { ...FX_DEFAULTS, ...state.fx };
  const stickers = { ...STICKER_DEFAULTS, ...state.stickers };
  ctx.fillRect(0, 0, width, height);
  for (const panel of geo.panels) {
    const cfg = state.panels[panel.index] ?? { source: 'sunset-run', zoom: panel.focal.zoom, focusX: panel.focal.x, focusY: panel.focal.y, rotate: 0 };
    const panelGrade = cfg.gradeOverride && cfg.gradeOverride !== 'global' ? gradeById(cfg.gradeOverride) : grade;
    const asset = assets.get(cfg.source);
    const texture = asset && panelTexture(asset, cfg, panel.box, panelGrade, fx, QUALITY_CAP[quality] ?? 760, 11 + panel.index * 37, panel.cx < width / 2 ? 1 : -1);
    drawPanel(ctx, panel, texture, panelGrade, unit, stickers.neonEdge);
  }
  ctx.save();
  Object.assign(ctx, { globalCompositeOperation: 'overlay', globalAlpha: 0.5, fillStyle: ctx.createPattern(grainTile(), 'repeat') });
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
  drawLighting(ctx, width, height, grade, stickers);
  renderLettering(ctx, geo, state, grade, stickers);
  Object.assign(ctx, { strokeStyle: GUTTER_INK, lineWidth: Math.max(2, unit * 0.006) * 2 });
  ctx.strokeRect(0, 0, width, height);
  return canvas;
}

export function paintSourceThumb(canvas, asset, w, h) {
  canvas.width = w;
  canvas.height = h;
  const [sw, sh] = sizeOfSource(asset);
  const cfg = { zoom: 1.25, focusX: 0.5, focusY: 0.5, subject: asset.focus ?? asset.subject ?? null, scene: !!asset.illustrated };
  if (sw) drawSource(canvas.getContext('2d'), asset, planCrop(sw, sh, cfg, w, h), w, h, cfg);
  return canvas;
}

export function paintCompare(canvas, asset, grade, fx) {
  const { width: w, height: h } = canvas;
  const art = paintSourceThumb(document.createElement('canvas'), asset, w, h);
  const actx = art.getContext('2d', { willReadFrequently: true });
  actx.putImageData(paintPanel(actx.getImageData(0, 0, w, h), { grade, fx: { ...FX_DEFAULTS, ...fx }, illustrated: !!asset.illustrated }), 0, 0);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(paintSourceThumb(document.createElement('canvas'), asset, w, h), 0, 0);
  ctx.drawImage(art, w / 2, 0, w / 2, h, w / 2, 0, w / 2, h);
  ctx.fillStyle = '#fff';
  ctx.fillRect(w / 2 - 1.5, 0, 3, h);
  ctx.font = `900 ${h * 0.085}px 'VP Text', sans-serif`;
  for (const [text, x, bg, ink] of [['PHOTO', w * 0.03, 'rgba(10,10,13,0.8)', '#fff'], ['GTA PAINT', w * 0.97, grade.accent, '#0a0a0d']]) {
    const tw = ctx.measureText(text).width + h * 0.08;
    const left = x > w / 2 ? x - tw : x;
    ctx.fillStyle = bg;
    ctx.fillRect(left, h * 0.84, tw, h * 0.12);
    ctx.fillStyle = ink;
    ctx.fillText(text, left + h * 0.04, h * 0.93);
  }
}
