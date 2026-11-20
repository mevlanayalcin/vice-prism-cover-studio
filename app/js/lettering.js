// Cover lettering in Canvas 2D with the shipped SIL OFL faces (no game wordmark, rating mark or
// game typeface): a kicker line, the display title with a heavy ink keyline, a stepped 3D
// extrusion and a cast shadow in one of five finishes, an angled subtitle ribbon, and the small
// box-art marks (17+ plate, VP sunset seal, barcode, optional edition band). The title zone is
// chosen face-safe: on 'auto' it takes the layout's zone unless a framed face sits under it, and
// then the candidate band that covers the least face area.

const TITLE_FONT = `'VP Display', 'Lato', 'Arial Black', 'Liberation Sans', sans-serif`;
const TEXT_FONT = `'VP Text', 'Lato', 'Helvetica Neue', 'Liberation Sans', Arial, sans-serif`;
const EDITORIAL_FONT = `'VP Editorial', 'Liberation Serif', Georgia, serif`;
const INK = '#0a0a0d';

const style = (stack, weight, condense, tracking, skew, finish, depth) => ({ stack, weight, condense, tracking, skew, finish, depth });
const FONT_STYLES = {
  chrome: style(TITLE_FONT, 900, 0.86, -0.022, 0.08, 'chrome', 0.085),
  neon: style(TITLE_FONT, 900, 0.8, 0.01, 0.05, 'neon', 0.06),
  sunset: style(TITLE_FONT, 900, 0.86, -0.024, 0.06, 'sunset', 0.08),
  riviera: style(EDITORIAL_FONT, 700, 0.96, -0.01, 0.02, 'riviera', 0.06),
  heavy: style(TITLE_FONT, 900, 0.95, -0.016, 0.02, 'sunset', 0.05),
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const tint = (hex, amount) => {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};
const font = (ctx, weight, size, stack, track = 0) => {
  ctx.font = `${weight} ${size}px ${stack}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * track}px`;
};
const gradient = (g, stops) => {
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
};
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const faceCost = (rect, faces) => faces.reduce((s, f) => s + overlap(rect, f) / Math.max(1, f.w * f.h), 0);

function titleLines(ctx, raw, maxW, maxH, st) {
  const words = (raw || 'VICE HORIZON').trim().toUpperCase().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!words.length) words.push('VICE', 'HORIZON');
  let best = null;
  ctx.save();
  for (let count = 1; count <= Math.min(3, words.length); count++) {
    const lines = [];
    for (let i = 0, at = 0; i < count; i++) {
      const take = Math.ceil((words.length - at) / (count - i));
      lines.push(words.slice(at, (at += take)).join(' '));
    }
    font(ctx, st.weight, 100, st.stack, st.tracking);
    const widest = Math.max(...lines.map((line) => (ctx.measureText(line).width * st.condense) / 100));
    const size = Math.min(maxH / (1 + 0.88 * (lines.length - 1) + 0.1 + st.depth), (maxW / Math.max(0.08, widest + st.depth + 0.1)) * 0.97);
    // a stacked title reads bigger than its point size: more lines win unless they shrink a lot
    const score = size * Math.sqrt(lines.length);
    if (!best || score > best.score * 1.04) best = { lines, size, score };
  }
  ctx.restore();
  return best;
}

const ZONES = { center: [0.06, 0.36, 0.88, 0.28, 'center'], top: [0.06, 0.035, 0.88, 0.25, 'center'], band: [0.06, 0.64, 0.88, 0.25, 'center'], left: [0.045, 0.3, 0.6, 0.36, 'left'] };
const zoneRect = (geo, [x, y, w, h, align]) => ({ x: geo.width * x, y: geo.height * y, w: geo.width * w, h: geo.height * h, align });

export function resolveTitleZone(geo, state, faces = []) {
  if (ZONES[state.textPosition]) return zoneRect(geo, ZONES[state.textPosition]);
  const own = geo.zones.title;
  if (faceCost(own, faces) < 0.04) return own;
  const options = [own, ...['center', 'band', 'top'].map((k) => zoneRect(geo, ZONES[k]))];
  return options.reduce((best, z) => (faceCost(z, faces) < faceCost(best, faces) - 0.02 ? z : best), own);
}

function finishOf(finish, grade) {
  const a = grade.accent;
  const b = grade.accent2;
  if (finish === 'chrome') return { stops: [[0, '#ffffff'], [0.26, '#fff4dc'], [0.47, tint(b, 0.3)], [0.5, '#2b0c3d'], [0.56, tint(a, -0.25)], [0.8, tint(a, 0.15)], [1, tint(b, 0.55)]], extrude: [tint(a, -0.5), tint(a, -0.78)], glow: a, glowBlur: 0.18 };
  if (finish === 'neon') return { stops: [[0, '#ffffff'], [0.5, tint(b, 0.55)], [1, tint(b, 0.05)]], extrude: [tint(a, -0.55), tint(a, -0.85)], glow: a, glowBlur: 0.4, tube: a };
  if (finish === 'riviera') return { stops: [[0, '#fffaf0'], [0.55, '#ffe5c0'], [1, tint(b, 0.2)]], extrude: [tint(a, -0.25), tint(a, -0.6)], glowBlur: 0 };
  return { stops: [[0, '#fff8e0'], [0.38, tint(b, 0.35)], [0.7, b], [1, a]], extrude: [tint(a, -0.48), tint(a, -0.8)], glow: a, glowBlur: 0.16 };
}

function drawTitle(ctx, geo, state, zone, grade) {
  const st = FONT_STYLES[state.fontStyle] ?? FONT_STYLES.chrome;
  const kicker = (state.caption.tagline || '').trim();
  const subtitle = (state.caption.subtitle || '').trim();
  const kickH = kicker ? Math.min(zone.h * 0.12, geo.height * 0.032) : 0;
  const subH = subtitle ? Math.min(zone.h * 0.2, geo.height * 0.055) : 0;
  const maxH = Math.max(geo.height * 0.06, zone.h - kickH - subH);
  const { lines, size } = titleLines(ctx, state.caption.title, zone.w, maxH, st);
  const lineGap = size * 0.88;
  const depth = size * st.depth;
  const blockH = size * 0.78 + lineGap * (lines.length - 1) + depth;
  const top = zone.y + kickH + (maxH - blockH) / 2;
  const pad = Math.ceil(size * 0.45);
  const layer = document.createElement('canvas');
  const layerW = (layer.width = Math.ceil(zone.w + pad * 2));
  const layerH = (layer.height = Math.ceil(blockH + pad * 2));
  const t = layer.getContext('2d');
  Object.assign(t, { lineJoin: 'round', miterLimit: 2 });
  const fin = finishOf(st.finish, grade);
  let left = Infinity;
  let right = -Infinity;
  lines.forEach((line, index) => {
    font(t, st.weight, size, st.stack, st.tracking);
    const lineW = t.measureText(line).width * st.condense;
    const x0 = zone.align === 'center' ? pad + (zone.w - lineW - depth) / 2 : pad;
    left = Math.min(left, x0);
    right = Math.max(right, x0 + lineW + depth);
    t.save();
    t.translate(x0, pad + size * 0.78 + lineGap * index);
    t.transform(1, 0, -st.skew, 1, 0, 0);
    t.scale(st.condense, 1);
    if (fin.glowBlur) {
      t.save();
      Object.assign(t, { shadowColor: fin.glow, shadowBlur: size * fin.glowBlur, strokeStyle: fin.glow, lineWidth: size * 0.16, globalAlpha: 0.85 });
      t.strokeText(line, depth, depth);
      t.restore();
    }
    // the extrusion: stacked copies stepping down-right, lit at the face and dark at the back
    const steps = Math.max(3, Math.round(depth / Math.max(1, size * 0.01)));
    Object.assign(t, { strokeStyle: INK, lineWidth: size * 0.19 });
    t.strokeText(line, depth, depth);
    for (let s = steps; s >= 1; s--) {
      t.fillStyle = s / steps > 0.45 ? fin.extrude[1] : fin.extrude[0];
      t.fillText(line, (depth * s) / steps, (depth * s) / steps);
    }
    t.lineWidth = size * 0.16;
    t.strokeText(line, 0, 0);
    t.fillStyle = gradient(t.createLinearGradient(0, -size * 0.74, 0, size * 0.04), fin.stops);
    t.fillText(line, 0, 0);
    if (fin.tube) {
      Object.assign(t, { shadowColor: fin.tube, shadowBlur: size * 0.1, strokeStyle: tint(fin.tube, 0.35), lineWidth: size * 0.026 });
      t.strokeText(line, 0, 0);
      t.shadowBlur = 0;
    }
    Object.assign(t, { globalAlpha: 0.7, strokeStyle: '#ffffff', lineWidth: size * 0.012 });
    t.strokeText(line, -size * 0.006, -size * 0.008);
    t.restore();
  });
  // a soft specular sweep across the faces of the letters
  Object.assign(t, { globalCompositeOperation: 'source-atop', fillStyle: gradient(t.createLinearGradient(0, 0, layerW, layerH), [[0, 'rgba(255,255,255,0.2)'], [0.3, 'rgba(255,255,255,0)'], [0.62, 'rgba(255,255,255,0.1)'], [1, 'rgba(0,0,0,0.05)']]) });
  t.fillRect(0, 0, layerW, layerH);

  const ox = zone.x - pad;
  const oy = top - pad;
  ctx.save();
  Object.assign(ctx, { shadowColor: 'rgba(4,0,10,0.72)', shadowBlur: size * 0.1, shadowOffsetX: size * 0.05, shadowOffsetY: size * 0.08 });
  ctx.drawImage(layer, ox, oy);
  ctx.restore();
  const rect = { x: ox + left, y: top, w: right - left, h: blockH, size };
  if (st.finish === 'chrome' || st.finish === 'neon') star4(ctx, rect.x + rect.w * 0.06, top + size * 0.1, size * 0.24);
  if (kicker) drawKicker(ctx, kicker, zone, rect, kickH, grade);
  return rect;
}

function drawKicker(ctx, text, zone, rect, h, grade) {
  const size = clamp(h * 0.72, 9, 40);
  ctx.save();
  font(ctx, 800, size, TEXT_FONT, 0.32);
  const label = text.toUpperCase();
  const w = ctx.measureText(label).width;
  const cx = zone.align === 'center' ? rect.x + rect.w / 2 : rect.x + w / 2 + size;
  const y = rect.y - size * 0.35;
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'alphabetic', shadowColor: 'rgba(0,0,0,0.9)', shadowBlur: size * 0.5, fillStyle: '#fff3dc' });
  ctx.fillText(label, cx, y);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = gradient(ctx.createLinearGradient(cx - w, 0, cx + w, 0), [[0, grade.accent], [1, grade.accent2]]);
  for (const dir of [-1, 1]) ctx.fillRect(dir < 0 ? cx - w / 2 - size * 3.2 : cx + w / 2 + size * 0.8, y - size * 0.42, size * 2.4, Math.max(2, size * 0.16));
  ctx.restore();
}

function star4(ctx, x, y, r) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient(ctx.createRadialGradient(x, y, 0, x, y, r * 0.55), [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) ctx.lineTo(x + Math.cos((i * Math.PI) / 4) * (i % 2 ? r * 0.07 : r), y + Math.sin((i * Math.PI) / 4) * (i % 2 ? r * 0.07 : r));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function slant(ctx, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

// The subtitle ribbon: a sharp parallelogram in the grade's accents with an ink keyline and a
// dark cast copy behind it, tucked just under the extrusion.
function drawRibbon(ctx, geo, state, zone, rect, grade) {
  const text = (state.caption.subtitle || '').trim().toUpperCase();
  if (!text) return null;
  const { width: w, height: h } = geo;
  const size = clamp(Math.min(h * 0.032, rect.size * 0.17), 11, 64);
  ctx.save();
  font(ctx, 900, size, TEXT_FONT, 0.2);
  const textW = ctx.measureText(text).width;
  const s = size * Math.min(1, (zone.w * 0.8) / (textW + size * 3));
  font(ctx, 900, s, TEXT_FONT, 0.2);
  const tw = ctx.measureText(text).width;
  const ph = s * 1.75;
  const pw = tw + s * 2.6;
  const k = ph * 0.42;
  let x = zone.align === 'center' ? rect.x + (rect.w - pw) / 2 : rect.x + rect.size * 0.12;
  x = clamp(x, w * 0.03, w * 0.97 - pw);
  const y = clamp(rect.y + rect.h - rect.size * 0.02, h * 0.02, h * 0.97 - ph);
  const shape = (dx, dy) => slant(ctx, [x + k + dx, y + dy, x + pw + dx, y + dy, x + pw - k + dx, y + ph + dy, x + dx, y + ph + dy]);
  ctx.fillStyle = 'rgba(6,1,12,0.85)';
  shape(s * 0.28, s * 0.32);
  ctx.fill();
  ctx.fillStyle = gradient(ctx.createLinearGradient(x, 0, x + pw, 0), [[0, grade.accent], [1, grade.accent2]]);
  shape(0, 0);
  ctx.fill();
  Object.assign(ctx, { strokeStyle: INK, lineWidth: Math.max(2, ph * 0.08), lineJoin: 'miter' });
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  slant(ctx, [x + k, y, x + pw, y, x + pw - k * 0.18, y + ph * 0.18, x + k * 0.82, y + ph * 0.18]);
  ctx.fill();
  Object.assign(ctx, { fillStyle: '#12051c', textBaseline: 'middle', textAlign: 'center' });
  ctx.fillText(text, x + pw / 2 + s * 0.1, y + ph / 2 + s * 0.06);
  ctx.restore();
  return { x, y, w: pw, h: ph };
}

function drawPlatformBand(ctx, geo, state, grade) {
  const { width: w, height: h } = geo;
  const unit = Math.min(w, h);
  const bh = Math.round(unit * 0.046);
  const fs = bh * 0.46;
  const mx = unit * 0.03;
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, bh);
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, 0, w, 0), [[0, grade.accent], [1, grade.accent2]]);
  ctx.fillRect(0, bh, w, Math.max(2, unit * 0.004));
  slant(ctx, [mx, bh * 0.76, mx + bh * 0.3, bh * 0.22, mx + bh * 0.6, bh * 0.76]);
  ctx.fill();
  Object.assign(ctx, { fillStyle: '#ffffff', textBaseline: 'middle' });
  font(ctx, 900, fs, TITLE_FONT, 0.16);
  ctx.fillText((state.caption.platform || 'COLLECTOR EDITION').toUpperCase().slice(0, 26), mx + bh * 0.85, bh * 0.53);
  ctx.restore();
}

function drawAgePlate(ctx, { x, y, w, h }, grade) {
  const r = w * 0.14;
  ctx.save();
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.55)', shadowBlur: h * 0.18, fillStyle: '#f7f2ea' });
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  Object.assign(ctx, { shadowColor: 'transparent', lineWidth: Math.max(2, w * 0.05), strokeStyle: INK, fillStyle: INK });
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x + w * 0.09, y + h * 0.07, w * 0.82, h * 0.58, r * 0.6);
  ctx.fill();
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'middle' });
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, y, 0, y + h * 0.6), [[0, grade.accent2], [1, grade.accent]]);
  font(ctx, 900, h * 0.36, TITLE_FONT);
  ctx.fillText('17+', x + w / 2, y + h * 0.37);
  ctx.fillStyle = INK;
  font(ctx, 900, h * 0.12, TEXT_FONT, 0.04);
  ctx.fillText('MATURE', x + w / 2, y + h * 0.8);
  ctx.restore();
}

function drawArcText(ctx, text, radius, start, end, size, color, under = false) {
  const chars = [...text];
  ctx.save();
  Object.assign(ctx, { fillStyle: color, font: `900 ${size}px ${TEXT_FONT}`, textAlign: 'center', textBaseline: 'middle' });
  chars.forEach((ch, i) => {
    const a = start + ((end - start) * (i + 0.5)) / chars.length;
    ctx.save();
    ctx.translate(Math.cos(a) * radius, Math.sin(a) * radius);
    ctx.rotate(under ? a - Math.PI / 2 : a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

// The VP seal: a notched ink disc, a banded sunset core with the monogram and the edition text
// on its rim.
function drawSeal(ctx, { cx, cy, radius: R }, state, grade) {
  const ring = (r) => {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  };
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.6)', shadowBlur: R * 0.4, shadowOffsetY: R * 0.08, fillStyle: INK });
  ctx.beginPath();
  for (let i = 0; i < 40; i++) ctx.lineTo(Math.cos((i / 40) * Math.PI * 2) * (i % 2 ? R * 0.93 : R), Math.sin((i / 40) * Math.PI * 2) * (i % 2 ? R * 0.93 : R));
  ctx.closePath();
  ctx.fill();
  Object.assign(ctx, { shadowColor: 'transparent', lineWidth: Math.max(2, R * 0.045), strokeStyle: grade.accent2 });
  ctx.stroke();
  ctx.save();
  ring(R * 0.58);
  ctx.clip();
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, -R * 0.58, 0, R * 0.58), [[0, '#fff3c0'], [0.5, grade.accent2], [1, grade.accent]]);
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.fillStyle = INK;
  for (let i = 0; i < 4; i++) ctx.fillRect(-R, R * (0.14 + i * 0.12), R * 2, R * (0.025 + i * 0.012));
  ctx.restore();
  ring(R * 0.58);
  Object.assign(ctx, { lineWidth: Math.max(2, R * 0.04), strokeStyle: INK });
  ctx.stroke();
  Object.assign(ctx, { font: `900 ${R * 0.5}px ${TITLE_FONT}`, textAlign: 'center', textBaseline: 'middle', lineWidth: R * 0.11, fillStyle: '#fffaf0', lineJoin: 'round' });
  ctx.strokeText('VP', 0, -R * 0.08);
  ctx.fillText('VP', 0, -R * 0.08);
  drawArcText(ctx, (state.caption.badge || 'SUNSET EDITION').trim().toUpperCase().slice(0, 20), R * 0.77, -Math.PI * 0.86, -Math.PI * 0.14, Math.max(6, R * 0.12), '#fff6e1');
  ctx.restore();
}

function drawBarcode(ctx, { x, y, w, h }) {
  ctx.save();
  Object.assign(ctx, { fillStyle: '#f7f4ee', shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: h * 0.2 });
  ctx.fillRect(x, y, w, h);
  Object.assign(ctx, { shadowColor: 'transparent', fillStyle: INK });
  const bx = x + w * 0.07;
  const bw = w * 0.86;
  for (let cursor = bx, seed = 41; cursor < bx + bw;) {
    seed = (seed * 16807) % 2147483647;
    const lw = Math.max(1, (seed % 4) * (h * 0.035));
    ctx.fillRect(cursor, y + h * 0.1, Math.min(lw, bx + bw - cursor), h * 0.62);
    cursor += lw + Math.max(1, ((seed >> 3) % 3) * (h * 0.03));
  }
  Object.assign(ctx, { font: `700 ${h * 0.17}px ${TEXT_FONT}`, textAlign: 'center', textBaseline: 'middle' });
  ctx.fillText('VP 26 0417 5', x + w / 2, y + h * 0.86);
  ctx.restore();
}

// Places the seal at the layout's spot unless the title, ribbon or a face is there; then it tries
// the other corners of the cover.
function sealSpot(geo, blocked, faces) {
  const { cx, cy, radius: R } = geo.zones.badge;
  const m = R * 1.25;
  const spots = [[cx, cy], [geo.width - m, m], [geo.width - m, geo.height * 0.5], [m, m]];
  const rectAt = ([x, y]) => ({ x: x - R, y: y - R, w: R * 2, h: R * 2 });
  const hit = (s) => blocked.some((b) => b && overlap(rectAt(s), b) > 0) || faceCost(rectAt(s), faces) > 0.02;
  const [x, y] = spots.find((s) => !hit(s)) ?? spots[0];
  return { cx: x, cy: y, radius: R };
}

export function renderLettering(ctx, geo, state, grade, stickers = {}, faces = []) {
  const unit = Math.min(geo.width, geo.height);
  const zone = resolveTitleZone(geo, state, faces);
  if (stickers.header) drawPlatformBand(ctx, geo, state, grade);
  const rect = drawTitle(ctx, geo, state, zone, grade);
  const ribbon = drawRibbon(ctx, geo, state, zone, rect, grade);
  const m = unit * 0.032;
  if (stickers.age) {
    const h = unit * 0.1;
    drawAgePlate(ctx, { x: m, y: geo.height - m - h, w: h * 0.78, h }, grade);
  }
  if (stickers.barcode) {
    const bw = unit * 0.115;
    drawBarcode(ctx, { x: geo.width - m - bw, y: geo.height - m - bw * 0.5, w: bw, h: bw * 0.5 });
  }
  if (stickers.medallion) drawSeal(ctx, sealSpot(geo, [rect, ribbon], faces), state, grade);
  return { zone, rect, ribbon };
}
