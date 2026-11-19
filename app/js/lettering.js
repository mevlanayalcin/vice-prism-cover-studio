// Poster lettering, drawn with Canvas 2D and shipped SIL Open Font License faces: a stacked title
// with a 3D extrusion, a fat ink keyline and one of five finishes (horizon chrome, neon tube,
// sunset enamel, riviera serif, heavy block); a subtitle plaque; a tagline; a sunburst edition
// seal; an original platform band and an original 17+ age plate. No game wordmark, rating-board
// mark, console logo or game typeface is used anywhere.

const TITLE_FONT = `'VP Display', 'Lato', 'Arial Black', 'Liberation Sans', sans-serif`;
const TEXT_FONT = `'VP Text', 'Lato', 'Helvetica Neue', 'Liberation Sans', Arial, sans-serif`;
const EDITORIAL_FONT = `'VP Editorial', 'Liberation Serif', Georgia, serif`;
const INK = '#0a0a0d';

const FONT_STYLES = {
  chrome: { stack: TITLE_FONT, weight: 900, condense: 0.84, tracking: -0.026, skew: 0.07, label: 'Horizon Chrome', finish: 'chrome', depth: 0.075 },
  neon: { stack: TITLE_FONT, weight: 900, condense: 0.74, tracking: 0.004, skew: 0.04, label: 'Neon Tube', finish: 'neon', depth: 0.05 },
  block: { stack: TITLE_FONT, weight: 900, condense: 0.84, tracking: -0.028, skew: 0.055, label: 'Sunset Enamel', finish: 'sunset', depth: 0.07 },
  riviera: { stack: EDITORIAL_FONT, weight: 700, condense: 0.96, tracking: -0.01, skew: 0, label: 'Riviera Serif', finish: 'riviera', depth: 0.06 },
  heavy: { stack: TITLE_FONT, weight: 900, condense: 0.93, tracking: -0.018, skew: 0.02, label: 'Heavy Block', finish: 'sunset', depth: 0.04 },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const tint = (hex, amount) => {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};
const styleOf = (state) => FONT_STYLES[state.fontStyle] ?? FONT_STYLES.chrome;
const setFont = (ctx, style, size) => {
  ctx.font = `${style.weight} ${size}px ${style.stack}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * style.tracking}px`;
};

function titleWords(raw) {
  const words = (raw || 'VICE HORIZON').trim().toUpperCase().split(/\s+/).filter(Boolean).slice(0, 5);
  return words.length ? words : ['VICE', 'HORIZON'];
}

function balancedLines(words, count) {
  const lines = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const take = Math.ceil((words.length - cursor) / (count - i));
    lines.push(words.slice(cursor, cursor + take).join(' '));
    cursor += take;
  }
  return lines.filter(Boolean);
}

/** The line count and type size that make the title as large as its zone allows. */
function planTitle(ctx, words, maxW, maxH, style) {
  let best = null;
  for (let count = 1; count <= Math.min(3, words.length); count++) {
    const lines = balancedLines(words, count);
    const byHeight = (maxH / (1 + 0.9 * (lines.length - 1) + 0.08 + style.depth)) * 0.99;
    ctx.save();
    setFont(ctx, style, 100);
    const widest = Math.max(...lines.map((line) => (ctx.measureText(line).width * style.condense) / 100));
    ctx.restore();
    const size = Math.min(byHeight, (maxW / Math.max(0.08, widest + style.depth)) * 0.96);
    if (!best || size > best.size + 0.5) best = { lines, size };
  }
  return best;
}

/** Where the title sits after the user's text-position choice. */
export function resolveTitleZone(geo, state) {
  const { width: w, height: h } = geo;
  if (state.textPosition === 'center') return { x: w * 0.07, y: h * 0.33, w: w * 0.86, h: h * 0.3, align: 'center' };
  if (state.textPosition === 'left') return { x: w * 0.055, y: h * 0.37, w: w * 0.66, h: h * 0.3, align: 'left' };
  if (state.textPosition === 'band') return { x: w * 0.05, y: h * 0.655, w: w * 0.9, h: h * 0.235, align: 'left' };
  return geo.zones.title;
}

function drawScrim(ctx, geo, title) {
  const { width: w, height: h } = geo;
  const top = Math.max(0, title.y - h * 0.06);
  const bottom = Math.min(h, title.y + title.h + h * 0.05);
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(7,2,12,0)');
  g.addColorStop(0.5, 'rgba(7,2,12,0.22)');
  g.addColorStop(1, 'rgba(6,1,10,0.08)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, bottom - top);
  const cx = title.x + title.w * (title.align === 'center' ? 0.5 : 0.36);
  const cy = title.y + title.h * 0.5;
  const pool = ctx.createRadialGradient(cx, cy, Math.min(title.w, title.h) * 0.1, cx, cy, Math.max(title.w, title.h) * 0.62);
  pool.addColorStop(0, 'rgba(5,1,10,0.3)');
  pool.addColorStop(1, 'rgba(5,1,10,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, w, h);
}

/** Fill, extrusion and glow colours for each finish, from the grade's accents. */
function finishOf(style, grade, size, index, last) {
  const a = grade.accent;
  const b = grade.accent2;
  switch (style.finish) {
    case 'chrome':
      return {
        stops: [[0, '#ffffff'], [0.3, '#ffe9c4'], [0.49, tint(b, 0.15)], [0.5, '#3b1450'], [0.62, tint(a, -0.1)], [0.86, tint(a, 0.35)], [1, '#fff0d8']],
        extrude: [tint(a, -0.55), tint(a, -0.8)],
        glow: a,
        glowBlur: 0.16,
        line: '#ffffff',
      };
    case 'neon':
      return {
        stops: [[0, '#ffffff'], [0.45, tint(b, 0.55)], [1, tint(a, 0.1)]],
        extrude: [tint(a, -0.6), tint(a, -0.85)],
        glow: a,
        glowBlur: 0.34,
        tube: b,
        line: '#ffffff',
      };
    case 'riviera':
      return {
        stops: [[0, '#fffaf0'], [0.55, '#ffe7c4'], [1, tint(b, 0.25)]],
        extrude: [tint(a, -0.2), tint(a, -0.55)],
        glow: 'rgba(0,0,0,0)',
        glowBlur: 0,
        line: '#ffffff',
      };
    default:
      return {
        stops: [[0, '#fffdf4'], [0.4, tint(b, 0.45)], [0.72, b], [1, last ? a : b]],
        extrude: [tint(a, -0.45), tint(a, -0.75)],
        glow: a,
        glowBlur: 0.18,
        line: '#fff7e6',
      };
  }
}

function drawTitle(ctx, geo, state, title, grade) {
  const style = styleOf(state);
  const words = titleWords(state.caption.title);
  const hasSubtitle = !!(state.caption.subtitle || '').trim();
  const reserve = hasSubtitle ? Math.min(title.h * 0.2, geo.height * 0.05) : 0;
  const maxH = Math.max(geo.height * 0.06, title.h - reserve);
  const plan = planTitle(ctx, words, title.w, maxH, style);
  const { lines, size } = plan;
  const lineGap = size * 0.9;
  const blockH = size + lineGap * (lines.length - 1);
  const blockTop = title.y + (maxH - blockH) / 2;
  const depth = size * style.depth;
  const pad = Math.max(24, size * 0.5);

  const layer = document.createElement('canvas');
  const layerW = Math.ceil(title.w + pad * 2);
  const layerH = Math.ceil(Math.max(maxH, blockH) + pad * 2);
  layer.width = layerW;
  layer.height = layerH;
  const t = layer.getContext('2d');
  t.lineJoin = 'round';
  t.miterLimit = 2;
  let baseline = pad + blockTop - title.y + size * 0.8;

  lines.forEach((line, index) => {
    const fin = finishOf(style, grade, size, index, index === lines.length - 1);
    t.save();
    setFont(t, style, size);
    const lineW = t.measureText(line).width * style.condense;
    const x = title.align === 'center' ? pad + (title.w - lineW - depth) / 2 : pad;
    t.translate(x, baseline);
    t.transform(1, 0, -style.skew, 1, 0, 0);
    t.scale(style.condense, 1);
    setFont(t, style, size);

    // outer glow
    if (fin.glowBlur) {
      t.save();
      t.shadowColor = fin.glow;
      t.shadowBlur = size * fin.glowBlur;
      t.strokeStyle = fin.glow;
      t.lineWidth = size * 0.14;
      t.globalAlpha = 0.8;
      t.strokeText(line, depth, depth);
      t.restore();
    }
    // 3D extrusion stepped down-right, inked as one solid block
    const steps = Math.max(2, Math.round(depth / Math.max(1, size * 0.012)));
    t.strokeStyle = INK;
    t.lineWidth = size * 0.17;
    t.strokeText(line, depth, depth);
    for (let s = steps; s >= 1; s--) {
      const k = s / steps;
      t.fillStyle = k > 0.5 ? fin.extrude[1] : fin.extrude[0];
      t.fillText(line, depth * k, depth * k);
    }
    // the fat comics keyline, then the finish
    t.strokeStyle = INK;
    t.lineWidth = size * 0.15;
    t.strokeText(line, 0, 0);
    const g = t.createLinearGradient(0, -size * 0.74, 0, size * 0.06);
    fin.stops.forEach(([o, c]) => g.addColorStop(o, c));
    t.fillStyle = g;
    t.fillText(line, 0, 0);
    if (fin.tube) {
      t.save();
      t.shadowColor = fin.tube;
      t.shadowBlur = size * 0.08;
      t.strokeStyle = fin.tube;
      t.lineWidth = size * 0.022;
      t.strokeText(line, 0, 0);
      t.restore();
    }
    // a bright bevel kiss on the top-left edges
    t.save();
    t.globalAlpha = 0.55;
    t.strokeStyle = fin.line;
    t.lineWidth = size * 0.014;
    t.strokeText(line, -size * 0.008, -size * 0.008);
    t.restore();
    t.restore();
    baseline += lineGap;
  });

  // print sheen and scan tooth, clipped to the letters themselves
  t.save();
  t.globalCompositeOperation = 'source-atop';
  const sheen = t.createLinearGradient(0, 0, layerW, layerH);
  sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.7, 'rgba(255,255,255,0.08)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.06)');
  t.fillStyle = sheen;
  t.fillRect(0, 0, layerW, layerH);
  t.globalAlpha = 0.05;
  t.fillStyle = INK;
  for (let y = 0; y < layerH; y += Math.max(4, Math.round(size * 0.04))) t.fillRect(0, y, layerW, Math.max(1, size * 0.006));
  t.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.04;
  ctx.drawImage(layer, title.x - pad, title.y - pad);
  ctx.restore();

  // a chrome glint on the first letter's shoulder
  if (style.finish === 'chrome' || style.finish === 'neon') {
    const gx = title.align === 'center' ? title.x + title.w * 0.2 : title.x + size * 0.3;
    star4(ctx, gx, blockTop + size * 0.08, size * 0.22);
  }
  return { size, blockBottom: blockTop + blockH + depth, blockTop };
}

function star4(ctx, x, y, r) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rr = i % 2 ? r * 0.08 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function plaque(ctx, x, y, w, h, grade) {
  const slant = h * 0.34;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = h * 0.35;
  ctx.beginPath();
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w - slant, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(10,10,13,0.94)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,244,218,0.6)';
  ctx.lineWidth = Math.max(1, h * 0.035);
  ctx.stroke();
  const bar = ctx.createLinearGradient(x, y, x + w, y);
  bar.addColorStop(0, grade.accent);
  bar.addColorStop(1, grade.accent2);
  ctx.fillStyle = bar;
  ctx.beginPath();
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + slant + h * 0.28, y);
  ctx.lineTo(x + h * 0.28, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSubtitle(ctx, geo, state, title, info, grade, avoid) {
  const text = (state.caption.subtitle || '').trim().toUpperCase();
  if (!text) return;
  const { width: w, height: h } = geo;
  const size = clamp(Math.min(h * 0.03, info.size * 0.13), 12, 60);
  ctx.save();
  ctx.font = `800 ${size}px ${TEXT_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.17}px`;
  const textW = ctx.measureText(text).width;
  ctx.restore();
  const scale = Math.min(1, (title.w * 0.94) / textW);
  const s = size * scale;
  const ph = s * 1.7;
  const pw = textW * scale + s * 2.2;
  let x = title.align === 'center' ? title.x + (title.w - pw) / 2 : title.x;
  let y = clamp(info.blockBottom + h * 0.012, h * 0.02, h * 0.92 - ph);
  if (avoid && y + ph > avoid.y && x < avoid.x + avoid.w) x = Math.max(x, avoid.x + avoid.w + w * 0.015);
  x = clamp(x, w * 0.03, w - w * 0.03 - pw);
  plaque(ctx, x, y, pw, ph, grade);
  ctx.save();
  ctx.fillStyle = '#fff4d8';
  ctx.font = `800 ${s}px ${TEXT_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${s * 0.17}px`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + s * 0.9, y + ph / 2 + s * 0.04);
  ctx.restore();
}

function drawTagline(ctx, geo, state, grade, top) {
  const text = (state.caption.tagline || '').trim().toUpperCase();
  if (!text) return;
  const { x } = geo.zones.tagline;
  const h = geo.height;
  const size = clamp(Math.min(geo.width, h) * 0.02, 10, 34);
  const y = Math.max(geo.zones.tagline.y, top + size * 1.9);
  ctx.save();
  const bar = ctx.createLinearGradient(x, y, x + size * 3, y);
  bar.addColorStop(0, grade.accent);
  bar.addColorStop(1, grade.accent2);
  ctx.fillStyle = bar;
  ctx.fillRect(x, y - size * 0.45, size * 2.6, Math.max(3, size * 0.2));
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = size * 0.5;
  ctx.fillStyle = 'rgba(255,246,225,0.96)';
  ctx.font = `800 ${size}px ${TEXT_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.24}px`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size * 3.3, y - size * 0.32);
  ctx.restore();
}

/** The original platform band across the top: an edition strip in the spirit of a boxed release. */
function drawPlatformBand(ctx, geo, state, grade) {
  const { width: w, height: h } = geo;
  const unit = Math.min(w, h);
  const bh = Math.round(unit * 0.052);
  ctx.save();
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, bh);
  const rule = ctx.createLinearGradient(0, 0, w, 0);
  rule.addColorStop(0, grade.accent);
  rule.addColorStop(1, grade.accent2);
  ctx.fillStyle = rule;
  ctx.fillRect(0, bh, w, Math.max(2, unit * 0.004));
  const fs = bh * 0.44;
  ctx.textBaseline = 'middle';
  // left: a prism mark and the edition name
  const mx = unit * 0.03;
  ctx.beginPath();
  ctx.moveTo(mx, bh * 0.76);
  ctx.lineTo(mx + bh * 0.3, bh * 0.22);
  ctx.lineTo(mx + bh * 0.6, bh * 0.76);
  ctx.closePath();
  ctx.fillStyle = rule;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${fs}px ${TITLE_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${fs * 0.16}px`;
  const label = (state.caption.platform || 'CONSOLE EDITION').toUpperCase().slice(0, 26);
  ctx.fillText(label, mx + bh * 0.85, bh * 0.53);
  // right: an original "PRO" chip and a disc-count note
  ctx.font = `800 ${fs * 0.7}px ${TEXT_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${fs * 0.12}px`;
  const note = '4K · HDR · 1 PLAYER';
  const nw = ctx.measureText(note).width;
  const chipW = fs * 2.6;
  const right = w - unit * 0.03;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(note, right - chipW - fs * 0.6 - nw, bh * 0.53);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.2, bh * 0.05);
  ctx.strokeRect(right - chipW, bh * 0.22, chipW, bh * 0.56);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${fs * 0.78}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('PRO', right - chipW / 2, bh * 0.53);
  ctx.restore();
  return bh + unit * 0.004;
}

/** An original 17+ age plate: our own shape and wording, not any rating board's mark. */
function ageRect(geo) {
  const unit = Math.min(geo.width, geo.height);
  const hh = unit * 0.115;
  const ww = hh * 0.76;
  return { x: unit * 0.03, y: geo.height - unit * 0.03 - hh, w: ww, h: hh };
}

function drawAgePlate(ctx, geo, grade) {
  const { x, y, w, h } = ageRect(geo);
  const r = w * 0.14;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = h * 0.2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = '#f7f2ea';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(2, w * 0.05);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(x + w * 0.08, y + h * 0.06, w * 0.84, h * 0.6, r * 0.6);
  ctx.fillStyle = INK;
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + h * 0.6);
  g.addColorStop(0, grade.accent2);
  g.addColorStop(1, grade.accent);
  ctx.fillStyle = g;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${h * 0.36}px ${TITLE_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${-h * 0.01}px`;
  ctx.fillText('17+', x + w / 2, y + h * 0.37);
  ctx.fillStyle = INK;
  ctx.font = `800 ${h * 0.105}px ${TEXT_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${h * 0.012}px`;
  ctx.fillText('MATURE', x + w / 2, y + h * 0.77);
  ctx.font = `700 ${h * 0.068}px ${TEXT_FONT}`;
  ctx.fillText('AGES 17 & UP', x + w / 2, y + h * 0.89);
  ctx.restore();
}

function drawArcText(ctx, text, radius, start, end, size, color, under = false) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px ${TEXT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...text];
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

/** The sunburst edition seal: rays, a banded sun, the studio monogram and the edition name. */
function drawMedallion(ctx, geo, state, grade) {
  const b = geo.zones.badge;
  const R = b.radius;
  const text = (state.caption.badge || 'SUNSET EDITION').trim().toUpperCase().slice(0, 24);
  ctx.save();
  ctx.translate(b.cx, b.cy);
  ctx.rotate(-0.12);
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = R * 0.45;
  ctx.shadowOffsetY = R * 0.1;
  ctx.beginPath();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const rr = i % 2 ? R * 0.94 : R;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(2, R * 0.05);
  ctx.strokeStyle = grade.accent2;
  ctx.stroke();
  for (let i = 0; i < 20; i++) {
    const a0 = (i / 20) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a0) * R * 0.58, Math.sin(a0) * R * 0.58);
    ctx.lineTo(Math.cos(a0 + 0.12) * R * 0.86, Math.sin(a0 + 0.12) * R * 0.86);
    ctx.lineTo(Math.cos(a0 + 0.2) * R * 0.58, Math.sin(a0 + 0.2) * R * 0.58);
    ctx.fillStyle = i % 2 ? `${grade.accent}88` : `${grade.accent2}66`;
    ctx.fill();
  }
  // banded sun core
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.56, 0, Math.PI * 2);
  ctx.clip();
  const sun = ctx.createLinearGradient(0, -R * 0.56, 0, R * 0.56);
  sun.addColorStop(0, '#fff3c0');
  sun.addColorStop(0.5, grade.accent2);
  sun.addColorStop(1, grade.accent);
  ctx.fillStyle = sun;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.fillStyle = INK;
  for (let i = 0; i < 4; i++) ctx.fillRect(-R, R * (0.12 + i * 0.12), R * 2, R * (0.025 + i * 0.012));
  ctx.restore();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.56, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(2, R * 0.04);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.font = `900 ${R * 0.46}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = R * 0.1;
  ctx.strokeStyle = INK;
  ctx.strokeText('VP', 0, -R * 0.06);
  ctx.fillStyle = '#fffaf0';
  ctx.fillText('VP', 0, -R * 0.06);
  drawArcText(ctx, text, R * 0.74, -Math.PI * 0.84, -Math.PI * 0.16, Math.max(6, R * 0.11), '#fff6e1');
  drawArcText(ctx, '★ LEONIDA ★', R * 0.76, Math.PI * 0.72, Math.PI * 0.28, Math.max(6, R * 0.1), grade.accent2, true);
  ctx.restore();
}

function drawFooter(ctx, geo, left0) {
  const { width: w, height: h } = geo;
  const unit = Math.min(w, h);
  const size = clamp(unit * 0.0125, 7, 19);
  const y = h - unit * 0.036;
  const barW = unit * 0.11;
  const barH = size * 1.75;
  const barX = w - unit * 0.03 - barW;
  const left = left0;
  const maxText = barX - left - unit * 0.03;
  ctx.save();
  const strip = ctx.createLinearGradient(0, h - unit * 0.11, 0, h);
  strip.addColorStop(0, 'rgba(10,10,13,0)');
  strip.addColorStop(1, 'rgba(10,10,13,0.78)');
  ctx.fillStyle = strip;
  ctx.fillRect(0, h - unit * 0.11, w, unit * 0.11);
  let text = 'AN ORIGINAL VICE PRISM PRODUCTION  ·  LEONIDA COVER STUDIO  ·  NOT AFFILIATED WITH ANY GAME PUBLISHER';
  let px = size;
  const font = (p, tr) => {
    ctx.font = `600 ${p}px ${TEXT_FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${p * tr}px`;
  };
  font(px, 0.1);
  while (ctx.measureText(text).width > maxText && px > size * 0.72) font((px *= 0.96), 0.06);
  if (ctx.measureText(text).width > maxText) {
    while (text.length > 12 && ctx.measureText(`${text.slice(0, -2)}…`).width > maxText) text = text.slice(0, -2);
    text = `${text.slice(0, -1)}…`;
  }
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = size * 0.6;
  ctx.fillStyle = 'rgba(255,246,228,0.72)';
  ctx.fillText(text, left, y);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(barX - size * 0.4, y - barH - size * 0.5, barW + size * 0.8, barH + size * 1.6);
  ctx.fillStyle = INK;
  let cursor = barX;
  let seed = 41;
  while (cursor < barX + barW) {
    seed = (seed * 16807) % 2147483647;
    const bw = Math.max(1, (seed % 4) * (barH * 0.07));
    ctx.fillRect(cursor, y - barH - size * 0.2, Math.min(bw, barX + barW - cursor), barH);
    cursor += bw + Math.max(1, ((seed >> 3) % 3) * (barH * 0.06));
  }
  ctx.font = `700 ${Math.max(6, size * 0.75)}px ${TEXT_FONT}`;
  ctx.fillText('VP-26-0417', barX, y + size * 0.65);
  ctx.restore();
}

/** Draw the whole caption layer over the panels. */
export function renderLettering(ctx, geo, state, grade, stickers = {}) {
  const title = resolveTitleZone(geo, state);
  drawScrim(ctx, geo, title);
  const top = stickers.header ? drawPlatformBand(ctx, geo, state, grade) : 0;
  const info = drawTitle(ctx, geo, state, title, grade);
  const age = stickers.age ? ageRect(geo) : null;
  drawSubtitle(ctx, geo, state, title, info, grade, age);
  drawTagline(ctx, geo, state, grade, top);
  if (stickers.medallion) drawMedallion(ctx, geo, state, grade);
  if (age) drawAgePlate(ctx, geo, grade);
  drawFooter(ctx, geo, age ? age.x + age.w + Math.min(geo.width, geo.height) * 0.025 : Math.min(geo.width, geo.height) * 0.04);
  return title;
}
