// The cover compositor: every cut gets its photo framed by planCrop, painted by filters.js at the
// quality's working scale and clipped into its slanted cut over a jet-black ground. Painted and
// raw tiles are cached by everything that changes their pixels. Then the box-art marks, the
// lettering and the Before / After divider. `framing` and `lettering` are read back by app.js.

import { buildGeometry, insetPolygon, layoutById, tracePanel } from './layouts.js';
import { gradeById } from './looks.js';
import { stylizePanelCanvas } from './filters.js';
import { renderCoverTypography } from './lettering.js';

export const GUTTER_INK = '#060509';
export let framing = [];
export const lettering = { rect: null, seal: null };

const WORK_SCALE = { draft: 0.36, preview: 0.58, export: 1 };
const CACHE_MAX = 56;
const cache = new Map();
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const FACE_SHOT = { wide: 0.24, medium: 0.4, close: 0.62 };

const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.max(1, w), height: Math.max(1, h) });

function remember(key, make) {
  if (cache.has(key)) {
    const hit = cache.get(key);
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const value = make();
  cache.set(key, value);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return value;
}

// Where the photo sits inside a cut of tw x th cover pixels. The plan keeps the photo's own size
// (sw, sh), the total scale and the view centre (fx, fy as fractions), which is what the studio's
// pan and zoom gestures read back; fit is always false since every cut is filled edge to edge.
export function planCrop(asset, cfg, tw, th) {
  const img = asset.image;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const cover = Math.max(tw / iw, th / ih);
  const subject = asset.subject;
  const shot = cfg.shot ?? 'medium';
  let zoom = 1;
  let fx = 0.5;
  let fy = 0.5;
  if (cfg.manualFocus) {
    zoom = clamp(cfg.zoom ?? 1, 1, 3);
    fx = cfg.focusX ?? 0.5;
    fy = cfg.focusY ?? 0.5;
  } else if (subject?.kind === 'face') {
    zoom = clamp((FACE_SHOT[shot] ?? 0.4) * th / (subject.h * ih * cover), 1, 3);
    const viewH = th / (cover * zoom);
    fx = subject.x;
    fy = (subject.y * ih + 0.1 * viewH) / ih; // the head lands two fifths down the cut
  } else if (subject) {
    if (shot !== 'wide') {
      zoom = Math.min((0.94 * tw) / (subject.w * iw * cover), (0.92 * th) / (subject.h * ih * cover));
      zoom = clamp(shot === 'close' ? zoom * 1.4 : zoom, 1, 3);
    }
    const viewW = tw / (cover * zoom) / iw;
    fx = subject.x + (subject.lead ?? 0) * viewW * 0.08; // room ahead of a vehicle
    fy = subject.y;
  }
  const rotate = ((cfg.rotate ?? 0) * Math.PI) / 180;
  const spin = rotate ? Math.abs(Math.cos(rotate)) + Math.abs(Math.sin(rotate)) * Math.max(tw / th, th / tw) : 1;
  const scale = cover * zoom * spin;
  const vw = tw / scale;
  const vh = th / scale;
  const cx = vw >= iw ? iw / 2 : clamp(fx * iw, vw / 2, iw - vw / 2);
  const cy = vh >= ih ? ih / 2 : clamp(fy * ih, vh / 2, ih - vh / 2);
  return { tw, th, sw: iw, sh: ih, scale, zoom, fx: cx / iw, fy: cy / ih, fit: false, cx, cy, vw, vh, rotate, flip: !!cfg.flip };
}

function drawCrop(ctx, img, plan, w, h) {
  const k = w / plan.tw;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(w / 2, h / 2);
  if (plan.rotate) ctx.rotate(plan.rotate);
  if (plan.flip) ctx.scale(-1, 1);
  ctx.scale(plan.scale * k, plan.scale * k);
  ctx.drawImage(img, -plan.cx, -plan.cy);
  ctx.restore();
}

// The subject box of a photo mapped into the cut (cover pixels relative to the cut's box).
function subjectRect(asset, plan) {
  const s = asset.subject;
  if (!s) return null;
  let x = (s.x * plan.sw - plan.cx) * plan.scale;
  if (plan.flip) x = -x;
  const y = (s.y * plan.sh - plan.cy) * plan.scale;
  const w = s.w * plan.sw * plan.scale;
  const h = s.h * plan.sh * plan.scale;
  return { kind: s.kind, x: plan.tw / 2 + x - w / 2, y: plan.th / 2 + y - h / 2, w, h };
}

function panelTile(asset, cfg, box, grade, fx, quality, unit, index, raw) {
  const plan = planCrop(asset, cfg, box.w, box.h);
  const s = WORK_SCALE[quality] ?? WORK_SCALE.preview;
  const w = Math.max(4, Math.round(box.w * s));
  const h = Math.max(4, Math.round(box.h * s));
  const rect = subjectRect(asset, plan);
  const key = [raw ? 'raw' : 'paint', cfg.source, asset.version ?? 1, w, h, plan.cx.toFixed(1), plan.cy.toFixed(1), plan.scale.toFixed(5), plan.rotate.toFixed(3), plan.flip,
    raw ? '' : `${grade.id}|${quality}|${Object.values(fx).map((v) => v.toFixed(2)).join(',')}`].join('|');
  const tile = remember(key, () => {
    const c = makeCanvas(w, h);
    drawCrop(c.getContext('2d'), asset.image, plan, w, h);
    if (raw) return c;
    const k = w / box.w;
    const protect = rect && rect.kind === 'face' ? [{ x: rect.x * k, y: rect.y * k, w: rect.w * k, h: rect.h * k }] : [];
    return stylizePanelCanvas(c, { grade, fx, quality, unit: unit * s, protect, seed: index + 1 });
  });
  return { tile, plan, rect };
}

function placeholder(ctx, panel, grade) {
  const { box } = panel;
  const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  grade.sky.forEach((c, i) => g.addColorStop(i / (grade.sky.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
}

// A soft printed falloff toward each cut's edges, so panels read as pasted-up prints.
function innerShade(ctx, box) {
  const g = ctx.createRadialGradient(box.x + box.w / 2, box.y + box.h / 2, Math.min(box.w, box.h) * 0.25, box.x + box.w / 2, box.y + box.h / 2, Math.hypot(box.w, box.h) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(6,4,12,0.32)');
  ctx.fillStyle = g;
  ctx.fillRect(box.x, box.y, box.w, box.h);
}

function paintPanels(ctx, geo, state, assets, grade, quality, unit, raw, plans, heroes) {
  geo.panels.forEach((panel, i) => {
    const cfg = state.panels[i];
    const asset = cfg && assets.get(cfg.source);
    ctx.save();
    tracePanel(ctx, panel.points);
    ctx.clip();
    if (!asset?.image) {
      placeholder(ctx, panel, grade);
    } else {
      const pg = cfg.gradeOverride && cfg.gradeOverride !== 'global' ? gradeById(cfg.gradeOverride) : grade;
      const { tile, plan, rect } = panelTile(asset, cfg, panel.box, pg, state.fx, quality, unit, i, raw);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tile, panel.box.x, panel.box.y, panel.box.w, panel.box.h);
      if (!raw) innerShade(ctx, panel.box);
      if (plans) plans[i] = plan;
      if (heroes && rect) {
        const x0 = Math.max(panel.box.x, panel.box.x + rect.x);
        const y0 = Math.max(panel.box.y, panel.box.y + rect.y);
        const x1 = Math.min(panel.box.x + panel.box.w, panel.box.x + rect.x + rect.w);
        const y1 = Math.min(panel.box.y + panel.box.h, panel.box.y + rect.y + rect.h);
        if (x1 > x0 && y1 > y0) heroes.push({ kind: rect.kind, panel: i, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
    }
    ctx.restore();
  });
}

function paintMarks(ctx, geo, state, grade, unit) {
  const { width, height } = geo;
  if (state.stickers.keyline) {
    ctx.save();
    Object.assign(ctx, { strokeStyle: '#fffaf0', lineWidth: Math.max(2, unit * 0.0034), lineJoin: 'miter' });
    for (const panel of geo.panels) {
      const k = geo.gutter * 0.62;
      tracePanel(ctx, insetPolygon(panel.points, width, height, k, k));
      ctx.stroke();
    }
    ctx.restore();
  }
  if (state.stickers.bevel) {
    for (const panel of geo.panels) {
      ctx.save();
      tracePanel(ctx, panel.points);
      ctx.clip();
      const g = ctx.createLinearGradient(panel.box.x, panel.box.y, panel.box.x + panel.box.w, panel.box.y + panel.box.h);
      g.addColorStop(0, grade.accent2);
      g.addColorStop(1, grade.accent);
      Object.assign(ctx, { strokeStyle: g, lineWidth: Math.max(3, unit * 0.008), shadowColor: grade.accent, shadowBlur: unit * 0.02 });
      tracePanel(ctx, panel.points);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (state.stickers.flare) {
    const zone = geo.zones.title;
    const cx = zone.x + zone.w * 0.72;
    const cy = zone.y + zone.h * 0.18;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(cx, cy);
    ctx.scale(1, 0.035);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, width * 0.42);
    g.addColorStop(0, `rgba(${grade.light}, 0.95)`);
    g.addColorStop(0.35, `rgba(${grade.light}, 0.35)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-width, -width, width * 2, width * 2);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, unit * 0.05);
    core.addColorStop(0, 'rgba(255,255,255,0.95)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = core;
    ctx.fillRect(cx - unit * 0.05, cy - unit * 0.05, unit * 0.1, unit * 0.1);
    ctx.restore();
  }
}

function pill(ctx, text, x, y, size, fill, ink) {
  ctx.font = `800 ${size}px 'VP Text', sans-serif`;
  const w = ctx.measureText(text).width + size * 1.6;
  const h = size * 1.75;
  const left = Math.min(Math.max(4, x - w / 2), ctx.canvas.width - w - 4);
  ctx.beginPath();
  ctx.roundRect(left, y, w, h, h / 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = Math.max(1, size * 0.1);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + w / 2, y + h / 2 + size * 0.05);
}

// The live Before / After divider: a glowing white hairline with a round <> grip and two pills.
function paintDivider(ctx, x, width, height, unit, grade) {
  ctx.save();
  Object.assign(ctx, { strokeStyle: '#ffffff', lineWidth: Math.max(2, unit * 0.003), shadowColor: grade.night ? '#7ff6ff' : '#fff3d6', shadowBlur: unit * 0.018 });
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  ctx.stroke();
  const r = Math.max(10, unit * 0.024);
  const cy = height * 0.5;
  ctx.shadowBlur = unit * 0.02;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0910';
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const dir of [-1, 1]) {
    ctx.moveTo(x + dir * r * 0.18, cy - r * 0.32);
    ctx.lineTo(x + dir * r * 0.5, cy);
    ctx.lineTo(x + dir * r * 0.18, cy + r * 0.32);
  }
  ctx.stroke();
  ctx.restore();
  const size = Math.max(10, unit * 0.019);
  const y = unit * 0.035;
  ctx.save();
  if (x > size * 6) pill(ctx, 'BEFORE', x - size * 4.6, y, size, 'rgba(10,8,16,0.86)', '#ffffff');
  if (x < width - size * 6) pill(ctx, 'AFTER', x + size * 4.2, y, size, grade.accent, '#0a0a0d');
  ctx.restore();
}

export function renderPoster(canvas, { width, height, state, assets, quality = 'preview', record = false, before = null }) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  const layout = layoutById(state.layout);
  const geo = buildGeometry(layout, width, height);
  const grade = gradeById(state.grade);
  const unit = Math.min(width, height);
  const plans = [];
  const heroes = [];
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = GUTTER_INK;
  ctx.fillRect(0, 0, width, height);
  paintPanels(ctx, geo, state, assets, grade, quality, unit, false, plans, heroes);
  if (before != null) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, before * width, height);
    ctx.clip();
    ctx.fillStyle = GUTTER_INK;
    ctx.fillRect(0, 0, width, height);
    paintPanels(ctx, geo, state, assets, grade, quality, unit, true, null, null);
    ctx.restore();
  }
  paintMarks(ctx, geo, state, grade, unit);
  const placed = renderCoverTypography(ctx, { width, height, geometry: geo, layout, state, grade, heroRects: heroes });
  if (before != null) paintDivider(ctx, before * width, width, height, unit, grade);
  ctx.restore();
  if (record) {
    framing = plans;
    lettering.rect = placed?.rect ?? null;
    lettering.seal = placed?.seal ?? null;
  }
  return canvas;
}

// The raw photo as a small cover-cropped thumbnail for the gallery and the panel strip.
export function paintSourceThumb(canvas, asset, w, h) {
  Object.assign(canvas, { width: w, height: h });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = GUTTER_INK;
  ctx.fillRect(0, 0, w, h);
  if (asset?.image) drawCrop(ctx, asset.image, planCrop(asset, { shot: 'wide' }, w, h), w, h);
  return canvas;
}
