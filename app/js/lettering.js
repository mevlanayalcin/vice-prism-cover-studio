// Poster lettering, drawn entirely with Canvas 2D and two shipped SIL Open Font License faces:
// a stacked, condensed title with a fat ink keyline, warm-to-magenta chrome, an inner bevel and
// a print shine; a tracked subtitle plaque; a tagline; a custom sunburst emblem; and original
// microtype. No game wordmark or typeface is used anywhere.

const TITLE_FONT = `'VP Display', 'Lato', 'Arial Black', 'Liberation Sans', sans-serif`;
const TEXT_FONT = `'VP Text', 'Lato', 'Helvetica Neue', 'Liberation Sans', Arial, sans-serif`;
const EDITORIAL_FONT = `'VP Editorial', 'Liberation Serif', Georgia, serif`;

const FONT_STYLES = {
  block: { stack: TITLE_FONT, weight: 900, condense: 0.84, tracking: -0.028, skew: 0.055, label: 'Block' },
  heavy: { stack: TITLE_FONT, weight: 900, condense: 0.93, tracking: -0.018, skew: 0.02, label: 'Heavy' },
  narrow: { stack: TITLE_FONT, weight: 900, condense: 0.7, tracking: -0.004, skew: 0.04, label: 'Compressed' },
  serif: { stack: EDITORIAL_FONT, weight: 700, condense: 0.99, tracking: -0.012, skew: 0, label: 'Editorial' },
};

export const FONT_STYLE_OPTIONS = Object.entries(FONT_STYLES).map(([id, style]) => ({ id, label: style.label }));
export const TEXT_POSITIONS = [
  { id: 'auto', label: 'Auto composition' },
  { id: 'center', label: 'Centre stage' },
  { id: 'left', label: 'Left stack' },
  { id: 'band', label: 'Lower band' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const tint = (hex, amount) => {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (v) => Math.round(v + (255 - v) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
};

function styleOf(state) {
  return FONT_STYLES[state.fontStyle] ?? FONT_STYLES.block;
}

function titleWords(raw) {
  const words = (raw || 'VICE PRISM').trim().toUpperCase().split(/\s+/).filter(Boolean).slice(0, 5);
  return words.length ? words : ['VICE PRISM'];
}

/** Split a word list into `count` balanced lines, keeping word order. */
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

/**
 * Choose the line count and type size that make the display lettering as large as the zone
 * allows: one wide line across a landscape band, stacked lines in a square or portrait well.
 */
function planTitle(ctx, words, maxW, maxH, style) {
  const counts = [1];
  if (words.length >= 2) counts.push(2);
  if (words.length >= 3) counts.push(3);
  let best = null;
  for (const count of counts) {
    const lines = balancedLines(words, count);
    const sizeByHeight = (maxH / (1 + 0.9 * (lines.length - 1) + 0.08)) * 0.99;
    let widest = 0;
    for (const line of lines) {
      ctx.save();
      ctx.font = `${style.weight} 100px ${style.stack}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${100 * style.tracking}px`;
      widest = Math.max(widest, (ctx.measureText(line).width * style.condense) / 100);
      ctx.restore();
    }
    const sizeByWidth = (maxW / Math.max(0.08, widest)) * 0.97;
    const size = Math.min(sizeByHeight, sizeByWidth);
    if (!best || size > best.size + 0.5) best = { lines, size };
  }
  return best;
}

/** Where the title sits after the user's text-position choice. */
export function resolveTitleZone(geo, state) {
  const base = geo.zones.title;
  const { width: w, height: h } = geo;
  if (state.textPosition === 'center') {
    return { x: w * 0.07, y: h * 0.33, w: w * 0.86, h: h * 0.3, align: 'center' };
  }
  if (state.textPosition === 'left') {
    return { x: w * 0.055, y: h * 0.37, w: w * 0.66, h: h * 0.3, align: 'left' };
  }
  if (state.textPosition === 'band') {
    return { x: w * 0.05, y: h * 0.655, w: w * 0.9, h: h * 0.235, align: 'left' };
  }
  return base;
}

function drawScrim(ctx, geo, title) {
  const { width: w, height: h } = geo;
  const lower = title.y + title.h / 2 > h * 0.44;
  if (lower) {
    // Band the scrim to the lettering well. It used to wash the whole lower half of the
    // poster, which flattened the two feet of every six-panel cover.
    const top = Math.max(0, title.y - h * 0.07);
    const bottom = Math.min(h, title.y + title.h + h * 0.03);
    const g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, 'rgba(7,2,12,0)');
    g.addColorStop(0.45, 'rgba(7,2,12,0.32)');
    g.addColorStop(1, 'rgba(6,1,10,0.24)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, w, bottom - top);
  } else {
    const cx = title.x + title.w * 0.5;
    const cy = title.y + title.h * 0.5;
    const r = Math.max(title.w, title.h) * 0.72;
    const g = ctx.createRadialGradient(cx, cy, r * 0.12, cx, cy, r);
    g.addColorStop(0, 'rgba(7,2,12,0.58)');
    g.addColorStop(0.6, 'rgba(7,2,12,0.26)');
    g.addColorStop(1, 'rgba(7,2,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // a warm/cool kick from the side keeps the scrim from reading as grey
  const edge = ctx.createLinearGradient(0, 0, w * 0.55, 0);
  edge.addColorStop(0, 'rgba(255,44,130,0.10)');
  edge.addColorStop(1, 'rgba(255,44,130,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);

  // a quiet pool of shadow under the type, so gold lettering keeps its bite on busy panels
  const cx = title.x + title.w * 0.34;
  const cy = title.y + title.h * 0.48;
  const pool = ctx.createRadialGradient(cx, cy, Math.min(title.w, title.h) * 0.08, cx, cy, Math.max(title.w, title.h) * 0.62);
  pool.addColorStop(0, 'rgba(5,1,10,0.28)');
  pool.addColorStop(0.58, 'rgba(5,1,10,0.12)');
  pool.addColorStop(1, 'rgba(5,1,10,0)');
  ctx.fillStyle = pool;
  ctx.fillRect(0, 0, w, h);
}

function drawPalm(ctx, x, y, size, flip, color) {
  if (size < 8) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.fillStyle = color;
  // curved trunk
  ctx.beginPath();
  ctx.moveTo(-size * 0.035, 0);
  ctx.bezierCurveTo(size * 0.015, -size * 0.3, size * 0.11, -size * 0.66, size * 0.245, -size * 1.02);
  ctx.lineTo(size * 0.29, -size * 1.0);
  ctx.bezierCurveTo(size * 0.19, -size * 0.63, size * 0.08, -size * 0.28, size * 0.02, 0);
  ctx.closePath();
  ctx.fill();
  const topX = size * 0.27;
  const topY = -size * 1.02;
  const fronds = [
    [-2.85, 0.7, 0.3], [-2.55, 0.85, 0.15], [-2.15, 0.9, -0.05], [-1.75, 0.82, -0.22],
    [-0.62, 0.84, -0.26], [-0.25, 0.72, -0.15], [0.12, 0.6, 0.02], [-3.12, 0.58, 0.36],
  ];
  for (const [angle, len, droop] of fronds) {
    ctx.save();
    ctx.translate(topX, topY);
    ctx.rotate(angle);
    const L = size * len;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.25, -L * 0.1, L * 0.62, -L * 0.12, L, L * droop * 0.28);
    ctx.bezierCurveTo(L * 0.58, L * 0.09, L * 0.25, L * 0.07, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  // coconuts
  for (const [dx, dy] of [[-0.01, -0.02], [0.035, 0.008], [-0.045, 0.02]]) {
    ctx.beginPath();
    ctx.arc(topX + size * dx, topY + size * dy, size * 0.026, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTitle(ctx, geo, state, title, grade) {
  const style = styleOf(state);
  const words = titleWords(state.caption.title);
  const pad = Math.max(18, geo.height * 0.045);
  const maxW = title.w;
  // Keep a shelf under the title for the subtitle plaque, so stacked type never collides.
  const hasSubtitle = !!(state.caption.subtitle || '').trim();
  const reserve = hasSubtitle ? Math.min(title.h * 0.22, geo.height * 0.052) : 0;
  const maxH = Math.max(geo.height * 0.06, title.h - reserve);

  const measure = (text, size) => {
    ctx.save();
    ctx.font = `${style.weight} ${size}px ${style.stack}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * style.tracking}px`;
    const m = ctx.measureText(text).width;
    ctx.restore();
    return m * style.condense;
  };

  const plan = planTitle(ctx, words, maxW, maxH, style);
  const lines = plan.lines;
  const size = plan.size;

  const lineGap = size * 0.9;
  const blockH = size + lineGap * (lines.length - 1);
  const blockTop = title.y + (maxH - blockH) / 2;

  const layer = document.createElement('canvas');
  const layerW = Math.ceil(maxW + pad * 2);
  const layerH = Math.ceil(Math.max(maxH, blockH) + pad * 2);
  layer.width = layerW;
  layer.height = layerH;
  const tctx = layer.getContext('2d');
  tctx.textBaseline = 'alphabetic';
  tctx.lineJoin = 'round';
  tctx.miterLimit = 2.2;

  const localTop = pad + blockTop - title.y;
  let baseline = localTop + size * 0.82;

  const fillStops = (index) => {
    const last = index === lines.length - 1;
    return ['#fffdf4', tint(grade.accent2, 0.5), grade.accent2, last ? grade.accent : grade.accent2];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const lineWidth = measure(line, size);
    const x = title.align === 'center' ? pad + (maxW - lineWidth) / 2 : pad;
    tctx.save();
    tctx.translate(x, baseline);
    tctx.transform(1, 0, -style.skew, 1, 0, 0);
    tctx.scale(style.condense, 1);
    tctx.font = `${style.weight} ${size}px ${style.stack}`;
    if ('letterSpacing' in tctx) tctx.letterSpacing = `${size * style.tracking}px`;

    // a magenta bloom behind the letters
    tctx.save();
    tctx.shadowColor = 'rgba(255,36,142,0.55)';
    tctx.shadowBlur = size * 0.22;
    tctx.strokeStyle = 'rgba(255,48,150,0.42)';
    tctx.lineWidth = size * 0.16;
    tctx.strokeText(line, 0, 0);
    tctx.restore();

    // the fat comics keyline, twice, for a solid black edge
    tctx.strokeStyle = '#08030e';
    tctx.lineWidth = size * 0.185;
    tctx.strokeText(line, 0, 0);
    tctx.lineWidth = size * 0.1;
    tctx.strokeText(line, 0, 0);

    // warm-to-magenta chrome fill
    const g = tctx.createLinearGradient(0, -size * 0.74, 0, size * 0.14);
    const stops = fillStops(index);
    stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color));
    tctx.fillStyle = g;
    tctx.fillText(line, 0, 0);

    // thin top bevel plus a whisper of mis-registered ink
    tctx.strokeStyle = 'rgba(255,252,240,0.42)';
    tctx.lineWidth = size * 0.012;
    tctx.strokeText(line, 0, 0);
    tctx.globalAlpha = 0.28;
    tctx.fillStyle = grade.accent;
    tctx.fillText(line, -size * 0.015, size * 0.012);
    tctx.globalAlpha = 1;

    tctx.restore();
    baseline += lineGap;
  }

  // print shine and tiny horizontal tooth, clipped to the letters themselves
  tctx.save();
  tctx.globalCompositeOperation = 'source-atop';
  const sheen = tctx.createLinearGradient(0, pad * 0.4, layerW, layerH * 0.8);
  sheen.addColorStop(0, 'rgba(255,255,255,0.34)');
  sheen.addColorStop(0.32, 'rgba(255,255,255,0.06)');
  sheen.addColorStop(0.55, 'rgba(0,0,0,0.10)');
  sheen.addColorStop(0.8, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(1, 'rgba(255,255,255,0.02)');
  tctx.fillStyle = sheen;
  tctx.fillRect(0, 0, layerW, layerH);
  tctx.globalAlpha = 0.06;
  tctx.fillStyle = '#08030e';
  for (let y = 0; y < layerH; y += Math.max(4, Math.round(size * 0.04))) {
    tctx.fillRect(0, y, layerW, Math.max(1, size * 0.006));
  }
  tctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.68)';
  ctx.shadowBlur = size * 0.13;
  ctx.shadowOffsetY = size * 0.045;
  ctx.drawImage(layer, title.x - pad, title.y - pad);
  ctx.restore();

  return { size, blockBottom: blockTop + blockH, blockTop };
}

function drawSubtitle(ctx, geo, state, title, titleInfo, grade) {
  const text = (state.caption.subtitle || '').trim().toUpperCase();
  if (!text) return;
  const { width: w, height: h } = geo;
  const size = clamp(Math.min(h * 0.03, (titleInfo?.size ?? h * 0.2) * 0.12), 12, 60);
  ctx.save();
  ctx.font = `800 ${size}px ${TEXT_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.17}px`;
  let textW = ctx.measureText(text).width;
  const maxW = title.w * 0.94;
  const scale = textW > maxW ? maxW / textW : 1;
  ctx.restore();

  const drawSize = size * scale;
  const plaqueH = drawSize * 1.66;
  const plaqueW = textW * scale + drawSize * 2.1;
  const autoSub = geo.zones.subtitle;
  let x = state.textPosition === 'auto' ? autoSub.x : title.x;
  let y = state.textPosition === 'auto'
    ? Math.min(autoSub.y, titleInfo.blockBottom + h * 0.012)
    : titleInfo.blockBottom + h * 0.02;
  if (title.align === 'center') x = title.x + (title.w - plaqueW) / 2;
  if (x + plaqueW > w - w * 0.03) x = w - w * 0.03 - plaqueW;
  x = Math.max(w * 0.03, x);
  y = Math.max(h * 0.02, Math.min(y, h * 0.9 - plaqueH));
  const slant = plaqueH * 0.34;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = plaqueH * 0.35;
  ctx.beginPath();
  ctx.moveTo(x + slant, y);
  ctx.lineTo(x + plaqueW, y);
  ctx.lineTo(x + plaqueW - slant, y + plaqueH);
  ctx.lineTo(x, y + plaqueH);
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,3,13,0.93)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,244,218,0.55)';
  ctx.lineWidth = Math.max(1, plaqueH * 0.035);
  ctx.stroke();
  const bar = ctx.createLinearGradient(x, y, x + plaqueW, y);
  bar.addColorStop(0, grade.accent);
  bar.addColorStop(1, grade.accent2);
  ctx.fillStyle = bar;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + drawSize * 0.42, y);
  ctx.lineTo(x + drawSize * 0.28, y + plaqueH);
  ctx.lineTo(x, y + plaqueH);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.fillStyle = '#fff4d8';
  ctx.font = `800 ${drawSize}px ${TEXT_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${drawSize * 0.17}px`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + drawSize * 0.82, y + plaqueH / 2 + drawSize * 0.04);
  ctx.restore();
}

function drawTagline(ctx, geo, state, grade) {
  const text = (state.caption.tagline || '').trim().toUpperCase();
  if (!text) return;
  const { x, y } = geo.zones.tagline;
  const h = geo.height;
  const size = clamp(h * 0.0165, 10, 34);
  ctx.save();
  const bar = ctx.createLinearGradient(x, y, x + h * 0.07, y);
  bar.addColorStop(0, grade.accent);
  bar.addColorStop(1, grade.accent2);
  ctx.fillStyle = bar;
  ctx.fillRect(x, y - size * 0.85, h * 0.052, Math.max(3, size * 0.19));
  ctx.fillStyle = 'rgba(255,246,225,0.94)';
  ctx.font = `800 ${size}px ${TEXT_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.24}px`;
  ctx.fillText(text, x + h * 0.066, y + size * 0.12);
  ctx.restore();
}

function drawArcText(ctx, text, cx, cy, radius, start, end, size, color) {
  if (!text) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px ${TEXT_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...text];
  const span = end - start;
  for (let i = 0; i < chars.length; i++) {
    const a = start + (span * (i + 0.5)) / chars.length;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawBadge(ctx, geo, state, grade) {
  const b = geo.zones.badge;
  const R = b.radius;
  const cx = b.cx;
  const cy = b.cy;
  const text = (state.caption.badge || 'SUNSET EDITION').trim().toUpperCase().slice(0, 26);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.11);
  ctx.shadowColor = 'rgba(0,0,0,0.58)';
  ctx.shadowBlur = R * 0.5;
  ctx.shadowOffsetY = R * 0.12;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  const base = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
  base.addColorStop(0, '#2a0a26');
  base.addColorStop(0.7, '#12051a');
  base.addColorStop(1, '#08030d');
  ctx.fillStyle = base;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // sunburst rays
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * Math.PI * 2;
    const a1 = a0 + Math.PI / 20;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a0) * R * 0.6, Math.sin(a0) * R * 0.6);
    ctx.lineTo(Math.cos(a1) * R * 0.9, Math.sin(a1) * R * 0.9);
    ctx.lineTo(Math.cos(a1) * R * 0.6, Math.sin(a1) * R * 0.6);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,63,147,0.5)' : 'rgba(255,209,102,0.34)';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(0, 0, R * 0.93, 0, Math.PI * 2);
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = Math.max(2, R * 0.075);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.985, 0, Math.PI * 2);
  ctx.strokeStyle = '#08030e';
  ctx.lineWidth = Math.max(3, R * 0.09);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, R * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(9,3,15,0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,246,225,0.72)';
  ctx.lineWidth = Math.max(1.5, R * 0.025);
  ctx.stroke();

  // neon palm inside the medallion
  drawPalm(ctx, -R * 0.02, R * 0.42, R * 0.62, false, 'rgba(255,212,120,0.78)');

  ctx.save();
  ctx.font = `900 ${R * 0.5}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = R * 0.09;
  ctx.strokeStyle = '#08030e';
  ctx.strokeText('VP', 0, -R * 0.05);
  const vg = ctx.createLinearGradient(0, -R * 0.32, 0, R * 0.2);
  vg.addColorStop(0, '#fffdf2');
  vg.addColorStop(0.55, grade.accent2);
  vg.addColorStop(1, grade.accent);
  ctx.fillStyle = vg;
  ctx.fillText('VP', 0, -R * 0.05);
  ctx.font = `700 ${Math.max(7, R * 0.12)}px ${TEXT_FONT}`;
  ctx.fillStyle = 'rgba(255,246,225,0.86)';
  ctx.fillText('LEONIDA', 0, R * 0.42);
  ctx.restore();

  drawArcText(ctx, text, 0, 0, R * 0.78, -Math.PI * 0.79, -Math.PI * 0.21, Math.max(6, R * 0.105), 'rgba(255,246,225,0.94)');

  // stars along the lower arc
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * 0.64 + i * Math.PI * 0.11;
    const px = Math.cos(a) * R * 0.76;
    const py = Math.sin(a) * R * 0.76;
    star(ctx, px, py, R * 0.075, grade.accent2);
  }
  ctx.restore();
}

function star(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.44;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFooter(ctx, geo, grade) {
  const { width: w, height: h } = geo;
  const size = clamp(h * 0.0112, 7, 19);
  const y = h * 0.964;
  const barW = w * 0.085;
  const barH = size * 1.75;
  const barX = w * 0.9 - barW;
  const barY = y - size * 2.7;
  const left = w * 0.052;
  const maxText = barX - left - w * 0.022;

  ctx.save();

  // legal line: measured, then condensed and finally shortened so it can never run into the
  // barcode block. This is a geometric guarantee, not a hope about a font's advance widths.
  const legal = 'AN ORIGINAL VICE PRISM PRODUCTION  ·  LEONIDA COVER STUDIO  ·  NOT AFFILIATED WITH ANY GAME PUBLISHER';
  let textSize = size;
  let text = legal;
  const setFont = (px, tracking) => {
    ctx.font = `600 ${px}px ${TEXT_FONT}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px * tracking}px`;
  };
  setFont(textSize, 0.1);
  while (ctx.measureText(text).width > maxText && textSize > size * 0.72) {
    textSize *= 0.96;
    setFont(textSize, 0.06);
  }
  if (ctx.measureText(text).width > maxText) {
    while (text.length > 12 && ctx.measureText(`${text.slice(0, -2)}…`).width > maxText) text = text.slice(0, -2);
    text = `${text.slice(0, -1)}…`;
  }

  ctx.strokeStyle = 'rgba(255,244,218,0.16)';
  ctx.lineWidth = Math.max(1, h * 0.001);
  ctx.beginPath();
  ctx.moveTo(left, y - textSize * 1.9);
  ctx.lineTo(barX - w * 0.02, y - textSize * 1.9);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,246,228,0.66)';
  setFont(textSize, 0.08);
  ctx.fillText(text, left, y);

  // original barcode block, clear of the legal line by construction
  ctx.fillStyle = 'rgba(255,246,228,0.72)';
  let cursor = barX;
  let seed = 41;
  while (cursor < barX + barW * 0.7) {
    seed = (seed * 16807) % 2147483647;
    const barWidth = Math.max(1, (seed % 4) * (barH * 0.09));
    ctx.fillRect(cursor, barY, barWidth, barH);
    cursor += barWidth + Math.max(1, ((seed >> 3) % 3) * (barH * 0.07));
  }
  ctx.font = `700 ${Math.max(6, size * 0.8)}px ${TEXT_FONT}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.04}px`;
  ctx.fillStyle = 'rgba(255,246,228,0.52)';
  ctx.fillText('VP-26-001', barX, y + size * 0.1);

  // tiny corner registration marks
  const m = Math.min(w, h) * 0.018;
  ctx.strokeStyle = 'rgba(255,248,235,0.24)';
  ctx.lineWidth = Math.max(1, h * 0.0012);
  const len = Math.min(w, h) * 0.022;
  for (const [x, yy, sx, sy] of [[m, m, 1, 1], [w - m, m, -1, 1], [m, h - m, 1, -1], [w - m, h - m, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + sx * len, yy);
    ctx.lineTo(x, yy);
    ctx.lineTo(x, yy + sy * len);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw the whole caption layer. Returns the resolved title zone for the renderer's scrim/palms. */
export function renderLettering(ctx, geo, state, grade) {
  const title = resolveTitleZone(geo, state);
  drawScrim(ctx, geo, title);

  // palms are part of the lettering composition, never a copied silhouette
  for (const palm of geo.zones.palms) {
    drawPalm(ctx, palm.x, palm.y, palm.scale * 0.55, palm.flip, 'rgba(9,2,14,0.82)');
  }

  const info = drawTitle(ctx, geo, state, title, grade);
  drawSubtitle(ctx, geo, state, title, info, grade);
  drawTagline(ctx, geo, state, grade);
  drawBadge(ctx, geo, state, grade);
  drawFooter(ctx, geo, grade);
  return title;
}
