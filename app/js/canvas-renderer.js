// The cover renderer: frames every photo in its slanted cut (subject-aware crop, pan, zoom, rotate,
// flip), paints it through the filters.js engine with the cover's or the panel's own grade, lays
// the cuts on jet-black diagonal gutters with an optional white collector's keyline and neon bevel,
// letters the cover through lettering.js and, in the editor, splits the canvas into a live
// Before / After. Painted panels are cached by everything that changes their pixels, so a title
// drag or a caption edit never repaints a photo.

import { buildGeometry, insetPolygon, layoutById, tracePanel } from './layouts.js';
import { FX_DEFAULTS, gradeById } from './looks.js';
import { stylizePanelCanvas } from './filters.js';
import { renderCoverTypography, resolveTitleZone } from './lettering.js';
import { STICKER_DEFAULTS } from './editor-state.js';

export const GUTTER_INK = '#0a0a0d';
// Per-panel framing of the last recorded render (app.js reads zoom, fx, fy, tw, th, sw, sh, scale).
export const framing = [];
// Where the title landed on the last recorded render, for title drag and wheel sizing.
export const lettering = { rect: null, zone: null };

const QUALITY = { draft: 0.3, preview: 0.5, export: 1 };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const cache = new Map();
const CACHE_MAX = 48;
const canvasOf = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.max(1, w), height: Math.max(1, h) });

// How much of the panel height a subject takes in each shot size: a head box for portraits, the
// whole vehicle or scene box otherwise.
const SHOT_FILL = {
  face: { wide: 0.3, medium: 0.46, close: 0.8 },
  scene: { wide: 0.62, medium: 0.82, close: 1.1 },
};

// Plans the crop of a sw x sh photo into a tw x th panel texture. A manual crop keeps its own
// zoom and focus; otherwise the shot size frames the subject with headroom for a face and room
// ahead of a vehicle. The focus comes back clamped so the view never leaves the photo.
export function planCrop(sw, sh, cfg = {}, tw, th) {
  const base = Math.max(tw / sw, th / sh);
  const sub = cfg.subject;
  let zoom = clamp(cfg.zoom ?? 1, 1, 3);
  let fx = cfg.focusX ?? 0.5;
  let fy = cfg.focusY ?? 0.5;
  if (!cfg.manualFocus && sub) {
    const face = sub.kind === 'face';
    const fill = (face ? SHOT_FILL.face : SHOT_FILL.scene)[cfg.shot] ?? (face ? 0.46 : 0.82);
    let scale = (fill * th) / Math.max(1, sub.h * sh);
    if (!face) scale = Math.min(scale, (0.94 * tw) / Math.max(1, sub.w * sw));
    zoom = clamp(scale / base, 1, 3);
    const viewW = tw / (base * zoom) / sw;
    fx = sub.x + (face ? 0 : (sub.lead ?? 0) * viewW * 0.14);
    fy = face ? sub.y + sub.h * (cfg.shot === 'close' ? 0.12 : 0.42) : sub.y - sub.h * 0.04;
  }
  const scale = base * zoom;
  const vw = tw / scale;
  const vh = th / scale;
  const cx = clamp(fx * sw, vw / 2, sw - vw / 2);
  const cy = clamp(fy * sh, vh / 2, sh - vh / 2);
  return { zoom, scale, fx: cx / sw, fy: cy / sh, cx, cy, vw, vh, tw, th, sw, sh, fit: 0 };
}

const sourceSize = (image) => [image.naturalWidth || image.width, image.naturalHeight || image.height];

// The raw framed photo: rotated about the panel centre, over-zoomed just enough that a tilt never
// shows a corner, and mirrored for a flipped panel.
function drawFramed(ctx, image, plan, cfg) {
  const { tw, th } = plan;
  const a = ((cfg.rotate ?? 0) * Math.PI) / 180;
  const cover = Math.abs(Math.cos(a)) + Math.abs(Math.sin(a)) * Math.max(tw / th, th / tw);
  const s = plan.scale * cover;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(tw / 2, th / 2);
  ctx.rotate(a);
  ctx.scale(cfg.flip ? -s : s, s);
  ctx.drawImage(image, -plan.cx, -plan.cy);
  ctx.restore();
}

function remember(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, value);
  return value;
}

// One panel's raw and painted textures at q times cover scale, cached.
function panelTextures(panel, cfg, asset, grade, fx, q, unit, index) {
  const tw = Math.max(8, Math.round(panel.box.w * q));
  const th = Math.max(8, Math.round(panel.box.h * q));
  const [sw, sh] = sourceSize(asset.image);
  const plan = planCrop(sw, sh, { ...cfg, subject: asset.subject }, tw, th);
  const key = [asset.id, asset.version, tw, th, plan.cx.toFixed(1), plan.cy.toFixed(1), plan.scale.toFixed(4), cfg.rotate, !!cfg.flip, grade.id, JSON.stringify(fx), Math.round(unit * q), index].join('|');
  const hit = cache.get(key);
  if (hit) return { ...hit, plan };
  const raw = canvasOf(tw, th);
  drawFramed(raw.getContext('2d'), asset.image, plan, cfg);
  const painted = canvasOf(tw, th);
  const pctx = painted.getContext('2d', { willReadFrequently: true });
  pctx.drawImage(raw, 0, 0);
  try {
    const img = pctx.getImageData(0, 0, tw, th);
    stylizePanelCanvas(img, { grade, fx, seed: 11 + index * 7, light: 1, unit: unit * q });
    pctx.putImageData(img, 0, 0);
  } catch {
    // a tainted canvas keeps the raw photo rather than failing the cover
  }
  return { ...remember(key, { raw, painted }), plan };
}

// A panel with no photo yet: the grade's sky as a flat painted placeholder.
function paintEmpty(ctx, panel, grade) {
  const g = ctx.createLinearGradient(0, panel.box.y, 0, panel.box.y + panel.box.h);
  grade.sky.forEach((c, i) => g.addColorStop(i / (grade.sky.length - 1), c));
  tracePanel(ctx, panel.points);
  ctx.fillStyle = g;
  ctx.fill();
}

// Soft inner shading toward every cut's edges, so each panel reads as a printed frame.
function shadePanel(ctx, panel, unit) {
  const { box } = panel;
  const r = Math.hypot(box.w, box.h) / 2;
  const g = ctx.createRadialGradient(panel.cx, panel.cy, r * 0.45, panel.cx, panel.cy, r * 1.05);
  g.addColorStop(0, 'rgba(10,6,20,0)');
  g.addColorStop(1, 'rgba(10,6,20,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.lineWidth = Math.max(1, unit * 0.0016);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.stroke();
}

// Where a face sits on the cover, so the lettering can stay off it.
function faceRect(panel, plan, cfg, subject) {
  if (subject?.kind !== 'face') return null;
  const { box } = panel;
  let ux = (subject.x * plan.sw - plan.cx) / plan.vw + 0.5;
  const uy = (subject.y * plan.sh - plan.cy) / plan.vh + 0.5;
  if (cfg.flip) ux = 1 - ux;
  const fw = ((subject.w * plan.sw) / plan.vw) * box.w;
  const fh = ((subject.h * plan.sh) / plan.vh) * box.h;
  const x = box.x + ux * box.w - fw / 2;
  const y = box.y + uy * box.h - fh / 2;
  const left = Math.max(x, box.x);
  const top = Math.max(y, box.y);
  const w = Math.min(x + fw, box.x + box.w) - left;
  const h = Math.min(y + fh, box.y + box.h) - top;
  return w > 4 && h > 4 ? { x: left, y: top, w, h, panel: panel.index } : null;
}

// The white collector's keyline: one crisp line a little inside every cut.
function drawKeyline(ctx, geo, unit) {
  const inset = Math.max(3, unit * 0.007);
  ctx.save();
  Object.assign(ctx, { strokeStyle: '#fffaf0', lineWidth: Math.max(2, unit * 0.0034), lineJoin: 'miter', shadowColor: 'rgba(0,0,0,0.55)', shadowBlur: unit * 0.004 });
  for (const panel of geo.panels) {
    tracePanel(ctx, insetPolygon(panel.points, geo.width, geo.height, inset, inset));
    ctx.stroke();
  }
  ctx.restore();
}

// The neon bevel: a glowing accent edge inside every cut, lit from the top left.
function drawBevel(ctx, geo, grade, unit) {
  const lw = Math.max(2, unit * 0.005);
  for (const panel of geo.panels) {
    ctx.save();
    tracePanel(ctx, panel.points);
    ctx.clip();
    const g = ctx.createLinearGradient(panel.box.x, panel.box.y, panel.box.x + panel.box.w, panel.box.y + panel.box.h);
    g.addColorStop(0, grade.accent2);
    g.addColorStop(0.5, grade.accent);
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    Object.assign(ctx, { strokeStyle: g, lineWidth: lw * 2, shadowColor: grade.accent, shadowBlur: unit * 0.018 });
    tracePanel(ctx, panel.points);
    ctx.stroke();
    ctx.restore();
  }
}

// A soft dark scrim behind the title zone so the lettering reads over any photo.
function drawTitleScrim(ctx, zone, unit) {
  if (!zone) return;
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  const r = Math.max(zone.w, zone.h) * 0.62;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, Math.max(0.3, zone.h / Math.max(zone.w, 1)) * 1.4);
  const g = ctx.createRadialGradient(0, 0, unit * 0.02, 0, 0, r);
  g.addColorStop(0, 'rgba(8,4,18,0.38)');
  g.addColorStop(1, 'rgba(8,4,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

function pill(ctx, text, x, y, size, fill, ink, alignRight = false) {
  ctx.font = `900 ${size}px 'VP Text', 'Arial Black', sans-serif`;
  const w = ctx.measureText(text).width + size * 1.4;
  const h = size * 1.75;
  const left = alignRight ? x - w : x;
  ctx.beginPath();
  ctx.roundRect(left, y, w, h, h / 2);
  Object.assign(ctx, { fillStyle: fill, shadowColor: 'rgba(0,0,0,0.6)', shadowBlur: size * 0.6 });
  ctx.fill();
  Object.assign(ctx, { shadowBlur: 0, fillStyle: ink, textBaseline: 'middle', textAlign: 'center' });
  ctx.fillText(text, left + w / 2, y + h / 2 + size * 0.04);
}

// Live Before / After: raw framed photos left of the divider, a glowing hairline and two pills.
function drawBeforeSplit(ctx, geo, raws, split, unit, grade) {
  const x = Math.round(clamp(split, 0, 1) * geo.width);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, x, geo.height);
  ctx.clip();
  ctx.fillStyle = GUTTER_INK;
  ctx.fillRect(0, 0, x, geo.height);
  for (const { panel, raw } of raws) {
    ctx.save();
    tracePanel(ctx, panel.points);
    ctx.clip();
    if (raw) ctx.drawImage(raw, panel.box.x, panel.box.y, panel.box.w, panel.box.h);
    else paintEmpty(ctx, panel, grade);
    ctx.restore();
  }
  ctx.restore();
  ctx.save();
  const lw = Math.max(2, unit * 0.0032);
  Object.assign(ctx, { strokeStyle: '#ffffff', lineWidth: lw, shadowColor: grade.accent, shadowBlur: unit * 0.02 });
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, geo.height);
  ctx.stroke();
  ctx.stroke();
  const knob = unit * 0.022;
  ctx.beginPath();
  ctx.arc(x, geo.height / 2, knob, 0, Math.PI * 2);
  Object.assign(ctx, { fillStyle: '#ffffff', shadowBlur: unit * 0.015 });
  ctx.fill();
  Object.assign(ctx, { shadowBlur: 0, fillStyle: GUTTER_INK, font: `900 ${knob}px 'VP Text', sans-serif`, textAlign: 'center', textBaseline: 'middle' });
  ctx.fillText('‹ ›', x, geo.height / 2);
  const size = Math.max(12, unit * 0.022);
  const top = geo.gutter * 2 + size * 0.4;
  if (x > size * 7) pill(ctx, 'BEFORE', x - size * 0.8, top, size, 'rgba(10,10,13,0.86)', '#ffffff', true);
  if (geo.width - x > size * 7) pill(ctx, 'AFTER', x + size * 0.8, top, size, grade.accent, '#0a0a0d');
  ctx.restore();
}

// Paints the whole cover into canvas at width x height. quality is draft, preview or export;
// record keeps framing and lettering for the editor; before (0..1) opens the split at that x.
export function renderPoster(canvas, { width, height, state, assets, quality = 'preview', record = false, before = null }) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const geo = buildGeometry(layoutById(state.layout), width, height);
  const unit = Math.min(width, height);
  const grade = gradeById(state.grade);
  const fx = { ...FX_DEFAULTS, ...state.fx };
  const stickers = { ...STICKER_DEFAULTS, ...state.stickers };
  const q = QUALITY[quality] ?? QUALITY.preview;
  const faces = [];
  const raws = [];
  if (record) framing.length = 0;

  ctx.fillStyle = GUTTER_INK;
  ctx.fillRect(0, 0, width, height);
  geo.panels.forEach((panel, i) => {
    const cfg = state.panels[i] ?? state.panels[i % Math.max(1, state.panels.length)] ?? {};
    const asset = assets?.get(cfg.source);
    const look = cfg.gradeOverride && cfg.gradeOverride !== 'global' ? gradeById(cfg.gradeOverride) : grade;
    ctx.save();
    tracePanel(ctx, panel.points);
    ctx.clip();
    if (asset?.image) {
      const { raw, painted, plan } = panelTextures(panel, cfg, asset, look, fx, q, unit, i);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(painted, panel.box.x, panel.box.y, panel.box.w, panel.box.h);
      raws.push({ panel, raw });
      const face = faceRect(panel, plan, cfg, asset.subject);
      if (face) faces.push(face);
      if (record) framing[i] = plan;
    } else {
      paintEmpty(ctx, panel, look);
      raws.push({ panel, raw: null });
      if (record) framing[i] = null;
    }
    tracePanel(ctx, panel.points);
    shadePanel(ctx, panel, unit);
    ctx.restore();
  });

  if (stickers.bevel) drawBevel(ctx, geo, grade, unit);
  if (stickers.keyline) drawKeyline(ctx, geo, unit);
  if (before != null) drawBeforeSplit(ctx, geo, raws, before, unit, grade);
  drawTitleScrim(ctx, resolveTitleZone(geo, state, faces), unit);
  const placed = renderCoverTypography(ctx, geo, state, grade, stickers, faces);
  if (record) {
    lettering.rect = placed?.rect ?? null;
    lettering.zone = placed?.zone ?? null;
  }
  return canvas;
}

// A gallery or panel-strip thumbnail: the photo cover-fitted and centred on its subject.
export function paintSourceThumb(canvas, asset, w, h) {
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = GUTTER_INK;
  ctx.fillRect(0, 0, w, h);
  if (!asset?.image) return canvas;
  const [sw, sh] = sourceSize(asset.image);
  const plan = planCrop(sw, sh, { subject: asset.subject, shot: 'wide' }, w, h);
  drawFramed(ctx, asset.image, plan, {});
  return canvas;
}
