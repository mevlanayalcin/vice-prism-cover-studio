// Poster lettering in Canvas 2D with shipped SIL OFL faces: a stacked title with a 3D extrusion, a
// fat ink keyline and one of five finishes, a subtitle plaque, a tagline, a sunburst edition seal,
// an original platform band, 17+ plate and footer. No game wordmark, rating mark or game typeface.

const TITLE_FONT = `'VP Display', 'Lato', 'Arial Black', 'Liberation Sans', sans-serif`;
const TEXT_FONT = `'VP Text', 'Lato', 'Helvetica Neue', 'Liberation Sans', Arial, sans-serif`;
const EDITORIAL_FONT = `'VP Editorial', 'Liberation Serif', Georgia, serif`;
const INK = '#0a0a0d';

const style = (stack, weight, condense, tracking, skew, finish, depth) => ({ stack, weight, condense, tracking, skew, finish, depth });
const FONT_STYLES = {
  chrome: style(TITLE_FONT, 900, 0.84, -0.026, 0.07, 'chrome', 0.075),
  neon: style(TITLE_FONT, 900, 0.74, 0.004, 0.04, 'neon', 0.05),
  block: style(TITLE_FONT, 900, 0.84, -0.028, 0.055, 'sunset', 0.07),
  riviera: style(EDITORIAL_FONT, 700, 0.96, -0.01, 0, 'riviera', 0.06),
  heavy: style(TITLE_FONT, 900, 0.93, -0.018, 0.02, 'sunset', 0.04),
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
const accentBar = (ctx, x0, x1, grade) => gradient(ctx.createLinearGradient(x0, 0, x1, 0), [[0, grade.accent], [1, grade.accent2]]);

function titleLines(ctx, raw, maxW, maxH, st) {
  const words = (raw || 'VICE HORIZON').trim().toUpperCase().split(/\s+/).filter(Boolean).slice(0, 5);
  if (!words.length) words.push('VICE', 'HORIZON');
  let best = null;
  for (let count = 1; count <= Math.min(3, words.length); count++) {
    const lines = [];
    for (let i = 0, at = 0; i < count; i++) {
      const take = Math.ceil((words.length - at) / (count - i));
      lines.push(words.slice(at, (at += take)).join(' '));
    }
    ctx.save();
    font(ctx, st.weight, 100, st.stack, st.tracking);
    const widest = Math.max(...lines.map((line) => (ctx.measureText(line).width * st.condense) / 100));
    ctx.restore();
    const size = Math.min((maxH / (1 + 0.9 * (lines.length - 1) + 0.08 + st.depth)) * 0.99, (maxW / Math.max(0.08, widest + st.depth)) * 0.96);
    if (!best || size > best.size + 0.5) best = { lines, size };
  }
  return best;
}

export function resolveTitleZone(geo, state) {
  const { width: w, height: h } = geo;
  const at = { center: [0.07, 0.33, 0.86, 0.3, 'center'], left: [0.055, 0.37, 0.66, 0.3, 'left'], band: [0.05, 0.655, 0.9, 0.235, 'left'] }[state.textPosition];
  return at ? { x: w * at[0], y: h * at[1], w: w * at[2], h: h * at[3], align: at[4] } : geo.zones.title;
}

function drawScrim(ctx, geo, title) {
  const { width: w, height: h } = geo;
  const top = Math.max(0, title.y - h * 0.06);
  const bottom = Math.min(h, title.y + title.h + h * 0.05);
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, top, 0, bottom), [[0, 'rgba(7,2,12,0)'], [0.5, 'rgba(7,2,12,0.22)'], [1, 'rgba(6,1,10,0.08)']]);
  ctx.fillRect(0, top, w, bottom - top);
  const cx = title.x + title.w * (title.align === 'center' ? 0.5 : 0.36);
  const cy = title.y + title.h * 0.5;
  ctx.fillStyle = gradient(ctx.createRadialGradient(cx, cy, Math.min(title.w, title.h) * 0.1, cx, cy, Math.max(title.w, title.h) * 0.62), [[0, 'rgba(5,1,10,0.3)'], [1, 'rgba(5,1,10,0)']]);
  ctx.fillRect(0, 0, w, h);
}

function finishOf(finish, grade, last) {
  const a = grade.accent;
  const b = grade.accent2;
  if (finish === 'chrome') return { stops: [[0, '#ffffff'], [0.3, '#ffe9c4'], [0.49, tint(b, 0.15)], [0.5, '#3b1450'], [0.62, tint(a, -0.1)], [0.86, tint(a, 0.35)], [1, '#fff0d8']], extrude: [tint(a, -0.55), tint(a, -0.8)], glow: a, glowBlur: 0.16, line: '#ffffff' };
  if (finish === 'neon') return { stops: [[0, '#ffffff'], [0.45, tint(b, 0.55)], [1, tint(a, 0.1)]], extrude: [tint(a, -0.6), tint(a, -0.85)], glow: a, glowBlur: 0.34, tube: b, line: '#ffffff' };
  if (finish === 'riviera') return { stops: [[0, '#fffaf0'], [0.55, '#ffe7c4'], [1, tint(b, 0.25)]], extrude: [tint(a, -0.2), tint(a, -0.55)], glowBlur: 0, line: '#ffffff' };
  return { stops: [[0, '#fffdf4'], [0.4, tint(b, 0.45)], [0.72, b], [1, last ? a : b]], extrude: [tint(a, -0.45), tint(a, -0.75)], glow: a, glowBlur: 0.18, line: '#fff7e6' };
}

function drawTitle(ctx, geo, state, title, grade) {
  const st = FONT_STYLES[state.fontStyle] ?? FONT_STYLES.chrome;
  const reserve = (state.caption.subtitle || '').trim() ? Math.min(title.h * 0.2, geo.height * 0.05) : 0;
  const maxH = Math.max(geo.height * 0.06, title.h - reserve);
  const { lines, size } = titleLines(ctx, state.caption.title, title.w, maxH, st);
  const lineGap = size * 0.9;
  const blockH = size + lineGap * (lines.length - 1);
  const blockTop = title.y + (maxH - blockH) / 2;
  const depth = size * st.depth;
  const pad = Math.max(24, size * 0.5);
  const layer = document.createElement('canvas');
  const layerW = (layer.width = Math.ceil(title.w + pad * 2));
  const layerH = (layer.height = Math.ceil(Math.max(maxH, blockH) + pad * 2));
  const t = layer.getContext('2d');
  Object.assign(t, { lineJoin: 'round', miterLimit: 2 });
  let baseline = pad + blockTop - title.y + size * 0.8;

  lines.forEach((line, index) => {
    const fin = finishOf(st.finish, grade, index === lines.length - 1);
    t.save();
    font(t, st.weight, size, st.stack, st.tracking);
    const lineW = t.measureText(line).width * st.condense;
    t.translate(title.align === 'center' ? pad + (title.w - lineW - depth) / 2 : pad, baseline);
    t.transform(1, 0, -st.skew, 1, 0, 0);
    t.scale(st.condense, 1);
    font(t, st.weight, size, st.stack, st.tracking);
    if (fin.glowBlur) {
      t.save();
      Object.assign(t, { shadowColor: fin.glow, shadowBlur: size * fin.glowBlur, strokeStyle: fin.glow, lineWidth: size * 0.14, globalAlpha: 0.8 });
      t.strokeText(line, depth, depth);
      t.restore();
    }
    const steps = Math.max(2, Math.round(depth / Math.max(1, size * 0.012)));
    Object.assign(t, { strokeStyle: INK, lineWidth: size * 0.17 });
    t.strokeText(line, depth, depth);
    for (let s = steps; s >= 1; s--) {
      t.fillStyle = s / steps > 0.5 ? fin.extrude[1] : fin.extrude[0];
      t.fillText(line, (depth * s) / steps, (depth * s) / steps);
    }
    t.lineWidth = size * 0.15;
    t.strokeText(line, 0, 0);
    t.fillStyle = gradient(t.createLinearGradient(0, -size * 0.74, 0, size * 0.06), fin.stops);
    t.fillText(line, 0, 0);
    if (fin.tube) {
      t.save();
      Object.assign(t, { shadowColor: fin.tube, shadowBlur: size * 0.08, strokeStyle: fin.tube, lineWidth: size * 0.022 });
      t.strokeText(line, 0, 0);
      t.restore();
    }
    Object.assign(t, { globalAlpha: 0.55, strokeStyle: fin.line, lineWidth: size * 0.014 });
    t.strokeText(line, -size * 0.008, -size * 0.008);
    t.restore();
    baseline += lineGap;
  });

  Object.assign(t, { globalCompositeOperation: 'source-atop', fillStyle: gradient(t.createLinearGradient(0, 0, layerW, layerH), [[0, 'rgba(255,255,255,0.22)'], [0.35, 'rgba(255,255,255,0)'], [0.7, 'rgba(255,255,255,0.08)'], [1, 'rgba(0,0,0,0.06)']]) });
  t.fillRect(0, 0, layerW, layerH);
  Object.assign(t, { globalAlpha: 0.05, fillStyle: INK });
  for (let y = 0; y < layerH; y += Math.max(4, Math.round(size * 0.04))) t.fillRect(0, y, layerW, Math.max(1, size * 0.006));

  ctx.save();
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.6)', shadowBlur: size * 0.12, shadowOffsetY: size * 0.04 });
  ctx.drawImage(layer, title.x - pad, title.y - pad);
  ctx.restore();
  if (st.finish === 'chrome' || st.finish === 'neon') star4(ctx, title.align === 'center' ? title.x + title.w * 0.2 : title.x + size * 0.3, blockTop + size * 0.08, size * 0.22);
  return { size, blockBottom: blockTop + blockH + depth };
}

function star4(ctx, x, y, r) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient(ctx.createRadialGradient(x, y, 0, x, y, r * 0.5), [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) ctx.lineTo(x + Math.cos((i * Math.PI) / 4) * (i % 2 ? r * 0.08 : r), y + Math.sin((i * Math.PI) / 4) * (i % 2 ? r * 0.08 : r));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function slant(ctx, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function drawSubtitle(ctx, geo, state, title, info, grade, avoid) {
  const text = (state.caption.subtitle || '').trim().toUpperCase();
  if (!text) return;
  const { width: w, height: h } = geo;
  const size = clamp(Math.min(h * 0.03, info.size * 0.13), 12, 60);
  ctx.save();
  font(ctx, 800, size, TEXT_FONT, 0.17);
  const textW = ctx.measureText(text).width;
  const s = size * Math.min(1, (title.w * 0.94) / textW);
  const ph = s * 1.7;
  const pw = textW * (s / size) + s * 2.2;
  let x = title.align === 'center' ? title.x + (title.w - pw) / 2 : title.x;
  const y = clamp(info.blockBottom + h * 0.012, h * 0.02, h * 0.92 - ph);
  if (avoid && y + ph > avoid.y && x < avoid.x + avoid.w) x = Math.max(x, avoid.x + avoid.w + w * 0.015);
  x = clamp(x, w * 0.03, w - w * 0.03 - pw);
  const k = ph * 0.34;
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: ph * 0.35, fillStyle: 'rgba(10,10,13,0.94)' });
  slant(ctx, [x + k, y, x + pw, y, x + pw - k, y + ph, x, y + ph]);
  ctx.fill();
  Object.assign(ctx, { shadowColor: 'transparent', strokeStyle: 'rgba(255,244,218,0.6)', lineWidth: Math.max(1, ph * 0.035) });
  ctx.stroke();
  ctx.fillStyle = accentBar(ctx, x, x + pw, grade);
  slant(ctx, [x + k, y, x + k + ph * 0.28, y, x + ph * 0.28, y + ph, x, y + ph]);
  ctx.fill();
  font(ctx, 800, s, TEXT_FONT, 0.17);
  Object.assign(ctx, { fillStyle: '#fff4d8', textBaseline: 'middle' });
  ctx.fillText(text, x + s * 0.9, y + ph / 2 + s * 0.04);
  ctx.restore();
}

function drawTagline(ctx, geo, state, grade, top) {
  const text = (state.caption.tagline || '').trim().toUpperCase();
  if (!text) return;
  const { x } = geo.zones.tagline;
  const size = clamp(Math.min(geo.width, geo.height) * 0.02, 10, 34);
  const y = Math.max(geo.zones.tagline.y, top + size * 1.9);
  ctx.save();
  ctx.fillStyle = accentBar(ctx, x, x + size * 3, grade);
  ctx.fillRect(x, y - size * 0.45, size * 2.6, Math.max(3, size * 0.2));
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.8)', shadowBlur: size * 0.5, fillStyle: 'rgba(255,246,225,0.96)', textBaseline: 'middle' });
  font(ctx, 800, size, TEXT_FONT, 0.24);
  ctx.fillText(text, x + size * 3.3, y - size * 0.32);
  ctx.restore();
}

function drawPlatformBand(ctx, geo, state, grade) {
  const { width: w, height: h } = geo;
  const unit = Math.min(w, h);
  const bh = Math.round(unit * 0.052);
  const fs = bh * 0.44;
  const mx = unit * 0.03;
  const right = w - unit * 0.03;
  const chipW = fs * 2.6;
  const rule = accentBar(ctx, 0, w, grade);
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, bh);
  ctx.fillStyle = rule;
  ctx.fillRect(0, bh, w, Math.max(2, unit * 0.004));
  ctx.textBaseline = 'middle';
  slant(ctx, [mx, bh * 0.76, mx + bh * 0.3, bh * 0.22, mx + bh * 0.6, bh * 0.76]);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  font(ctx, 900, fs, TITLE_FONT, 0.16);
  ctx.fillText((state.caption.platform || 'CONSOLE EDITION').toUpperCase().slice(0, 26), mx + bh * 0.85, bh * 0.53);
  font(ctx, 800, fs * 0.7, TEXT_FONT, 0.12 / 0.7);
  const note = '4K · HDR · 1 PLAYER';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(note, right - chipW - fs * 0.6 - ctx.measureText(note).width, bh * 0.53);
  Object.assign(ctx, { strokeStyle: '#ffffff', lineWidth: Math.max(1.2, bh * 0.05), fillStyle: '#ffffff', textAlign: 'center' });
  ctx.strokeRect(right - chipW, bh * 0.22, chipW, bh * 0.56);
  ctx.font = `900 ${fs * 0.78}px ${TITLE_FONT}`;
  ctx.fillText('PRO', right - chipW / 2, bh * 0.53);
  ctx.restore();
  return bh + unit * 0.004;
}

function ageRect(geo) {
  const unit = Math.min(geo.width, geo.height);
  const hh = unit * 0.115;
  return { x: unit * 0.03, y: geo.height - unit * 0.03 - hh, w: hh * 0.76, h: hh };
}

function drawAgePlate(ctx, { x, y, w, h }, grade) {
  const r = w * 0.14;
  ctx.save();
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: h * 0.2, fillStyle: '#f7f2ea' });
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  Object.assign(ctx, { shadowColor: 'transparent', lineWidth: Math.max(2, w * 0.05), strokeStyle: INK, fillStyle: INK });
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x + w * 0.08, y + h * 0.06, w * 0.84, h * 0.6, r * 0.6);
  ctx.fill();
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'middle' });
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, y, 0, y + h * 0.6), [[0, grade.accent2], [1, grade.accent]]);
  font(ctx, 900, h * 0.36, TITLE_FONT, -0.01 * (h / (h * 0.36)));
  ctx.fillText('17+', x + w / 2, y + h * 0.37);
  ctx.fillStyle = INK;
  font(ctx, 800, h * 0.105, TEXT_FONT, 0.012 / 0.105);
  ctx.fillText('MATURE', x + w / 2, y + h * 0.77);
  ctx.font = `700 ${h * 0.068}px ${TEXT_FONT}`;
  ctx.fillText('AGES 17 & UP', x + w / 2, y + h * 0.89);
  ctx.restore();
}

function drawArcText(ctx, text, radius, start, end, size, color, under = false) {
  const chars = [...text];
  ctx.save();
  Object.assign(ctx, { fillStyle: color, font: `800 ${size}px ${TEXT_FONT}`, textAlign: 'center', textBaseline: 'middle' });
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

function drawMedallion(ctx, geo, state, grade) {
  const { cx, cy, radius: R } = geo.zones.badge;
  const ring = (r) => {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  };
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.6)', shadowBlur: R * 0.45, shadowOffsetY: R * 0.1, fillStyle: INK });
  ctx.beginPath();
  for (let i = 0; i < 48; i++) ctx.lineTo(Math.cos((i / 48) * Math.PI * 2) * (i % 2 ? R * 0.94 : R), Math.sin((i / 48) * Math.PI * 2) * (i % 2 ? R * 0.94 : R));
  ctx.closePath();
  ctx.fill();
  Object.assign(ctx, { shadowColor: 'transparent', lineWidth: Math.max(2, R * 0.05), strokeStyle: grade.accent2 });
  ctx.stroke();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? `${grade.accent}88` : `${grade.accent2}66`;
    slant(ctx, [Math.cos(a) * R * 0.58, Math.sin(a) * R * 0.58, Math.cos(a + 0.12) * R * 0.86, Math.sin(a + 0.12) * R * 0.86, Math.cos(a + 0.2) * R * 0.58, Math.sin(a + 0.2) * R * 0.58]);
    ctx.fill();
  }
  ctx.save();
  ring(R * 0.56);
  ctx.clip();
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, -R * 0.56, 0, R * 0.56), [[0, '#fff3c0'], [0.5, grade.accent2], [1, grade.accent]]);
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.fillStyle = INK;
  for (let i = 0; i < 4; i++) ctx.fillRect(-R, R * (0.12 + i * 0.12), R * 2, R * (0.025 + i * 0.012));
  ctx.restore();
  ring(R * 0.56);
  Object.assign(ctx, { lineWidth: Math.max(2, R * 0.04), strokeStyle: INK });
  ctx.stroke();
  Object.assign(ctx, { font: `900 ${R * 0.46}px ${TITLE_FONT}`, textAlign: 'center', textBaseline: 'middle', lineWidth: R * 0.1, fillStyle: '#fffaf0' });
  ctx.strokeText('VP', 0, -R * 0.06);
  ctx.fillText('VP', 0, -R * 0.06);
  drawArcText(ctx, (state.caption.badge || 'SUNSET EDITION').trim().toUpperCase().slice(0, 24), R * 0.74, -Math.PI * 0.84, -Math.PI * 0.16, Math.max(6, R * 0.11), '#fff6e1');
  drawArcText(ctx, '★ LEONIDA ★', R * 0.76, Math.PI * 0.72, Math.PI * 0.28, Math.max(6, R * 0.1), grade.accent2, true);
  ctx.restore();
}

function drawFooter(ctx, geo, left) {
  const { width: w, height: h } = geo;
  const unit = Math.min(w, h);
  const size = clamp(unit * 0.0125, 7, 19);
  const y = h - unit * 0.036;
  const barW = unit * 0.11;
  const barH = size * 1.75;
  const barX = w - unit * 0.03 - barW;
  const maxText = barX - left - unit * 0.03;
  ctx.save();
  ctx.fillStyle = gradient(ctx.createLinearGradient(0, h - unit * 0.11, 0, h), [[0, 'rgba(10,10,13,0)'], [1, 'rgba(10,10,13,0.78)']]);
  ctx.fillRect(0, h - unit * 0.11, w, unit * 0.11);
  let text = 'AN ORIGINAL VICE PRISM PRODUCTION  ·  LEONIDA COVER STUDIO  ·  NOT AFFILIATED WITH ANY GAME PUBLISHER';
  let px = size;
  font(ctx, 600, px, TEXT_FONT, 0.1);
  while (ctx.measureText(text).width > maxText && px > size * 0.72) font(ctx, 600, (px *= 0.96), TEXT_FONT, 0.06);
  if (ctx.measureText(text).width > maxText) {
    while (text.length > 12 && ctx.measureText(`${text.slice(0, -2)}…`).width > maxText) text = text.slice(0, -2);
    text = `${text.slice(0, -1)}…`;
  }
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.9)', shadowBlur: size * 0.6, fillStyle: 'rgba(255,246,228,0.72)' });
  ctx.fillText(text, left, y);
  Object.assign(ctx, { shadowColor: 'transparent', fillStyle: 'rgba(255,255,255,0.92)' });
  ctx.fillRect(barX - size * 0.4, y - barH - size * 0.5, barW + size * 0.8, barH + size * 1.6);
  ctx.fillStyle = INK;
  for (let cursor = barX, seed = 41; cursor < barX + barW;) {
    seed = (seed * 16807) % 2147483647;
    const bw = Math.max(1, (seed % 4) * (barH * 0.07));
    ctx.fillRect(cursor, y - barH - size * 0.2, Math.min(bw, barX + barW - cursor), barH);
    cursor += bw + Math.max(1, ((seed >> 3) % 3) * (barH * 0.06));
  }
  ctx.font = `700 ${Math.max(6, size * 0.75)}px ${TEXT_FONT}`;
  ctx.fillText('VP-26-0417', barX, y + size * 0.65);
  ctx.restore();
}

export function renderLettering(ctx, geo, state, grade, stickers = {}) {
  const title = resolveTitleZone(geo, state);
  const unit = Math.min(geo.width, geo.height);
  drawScrim(ctx, geo, title);
  const top = stickers.header ? drawPlatformBand(ctx, geo, state, grade) : 0;
  const info = drawTitle(ctx, geo, state, title, grade);
  const age = stickers.age ? ageRect(geo) : null;
  drawSubtitle(ctx, geo, state, title, info, grade, age);
  drawTagline(ctx, geo, state, grade, top);
  if (stickers.medallion) drawMedallion(ctx, geo, state, grade);
  if (age) drawAgePlate(ctx, age, grade);
  drawFooter(ctx, geo, age ? age.x + age.w + unit * 0.025 : unit * 0.04);
  return title;
}
