// Cover lettering and box-art marks, drawn straight onto the cover canvas with the app's own
// shipped OFL fonts (VP Display, VP Text, VP Editorial under app/fonts). No game logo, wordmark or
// font file is used: every finish below is built from gradients, strokes and glow.
//   chrome   Horizon Chrome: sunset-to-ivory metal, upper bevel, horizon line, jet-black keyline
//            and drop block, a lens sparkle on the first letter
//   neon     Neon Tube: double magenta / cyan bloom, white-hot core tube on dark glass
//   sunset   Sunset Enamel: gold-amber-coral enamel with retro stripes over a navy extruded block
//   riviera  Riviera Serif: ivory-gold luxury serif, wide tracking, soft shadow
//   heavy    Heavy Block: white action block with a fat black keyline and an accent hard shadow
// Around the title: a kicker line, an angled subtitle ribbon, a scalloped edition seal with the VP
// monogram, the 17+ plate, a barcode, the edition band and an anamorphic sun flare. The title
// zone is face-safe: in Auto it moves off any face the panels show.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const DISPLAY = (size) => `900 ${size}px "VP Display", "Arial Black", Impact, sans-serif`;
const TEXT = (size, weight = 700) => `${weight} ${size}px "VP Text", "Arial", sans-serif`;
const SERIF = (size) => `700 ${size}px "VP Editorial", Georgia, serif`;
const INK = '#0a0a0d';

const STYLE = {
  chrome: { font: DISPLAY, track: 0.02, skew: -0.12, lineH: 0.92 },
  neon: { font: DISPLAY, track: 0.05, skew: -0.06, lineH: 0.98 },
  sunset: { font: DISPLAY, track: 0.03, skew: -0.1, lineH: 0.94 },
  riviera: { font: SERIF, track: 0.12, skew: 0, lineH: 1.02 },
  heavy: { font: DISPLAY, track: 0.01, skew: -0.04, lineH: 0.9 },
};

// Title spots as fractions of the cover, for the Position menu and the face-safe search.
const SPOTS = {
  top: { x: 0.06, y: 0.045, w: 0.88, h: 0.23, align: 'center' },
  center: { x: 0.08, y: 0.37, w: 0.84, h: 0.26, align: 'center' },
  band: { x: 0.06, y: 0.7, w: 0.88, h: 0.24, align: 'center' },
  left: { x: 0.045, y: 0.3, w: 0.52, h: 0.4, align: 'left' },
};

const spotZone = (geo, s) => ({ x: s.x * geo.width, y: s.y * geo.height, w: s.w * geo.width, h: s.h * geo.height, align: s.align });
const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const faceCover = (zone, faces) => faces.reduce((sum, f) => sum + overlap(zone, f) / Math.max(1, f.w * f.h), 0);

// The face-safe title zone before any drag: the chosen position, or in Auto the layout's own
// title band unless faces sit under it, then the spot that covers the least of them.
function baseZone(geo, state, faces) {
  const pick = state.textPosition ?? 'auto';
  if (SPOTS[pick]) return spotZone(geo, SPOTS[pick]);
  const own = { ...geo.zones.title, align: geo.zones.title.align ?? 'center' };
  if (!faces.length || faceCover(own, faces) < 0.15) return own;
  const options = [own, ...['top', 'band', 'center'].map((k) => spotZone(geo, SPOTS[k]))];
  return options.map((z, i) => ({ z, cost: faceCover(z, faces) + i * 0.04 })).sort((a, b) => a.cost - b.cost)[0].z;
}

// Applies the title transform: drag offset (fractions of the cover), size and tilt, the zone
// scaled about its centre and kept wholly inside the frame.
export function placeTitleZone(geo, zone, t = {}) {
  const scale = clamp(t.scale ?? 1, 0.5, 1.6);
  const w = Math.min(geo.width * 0.98, zone.w * scale);
  const h = Math.min(geo.height * 0.9, zone.h * scale);
  const cx = zone.x + zone.w / 2 + (t.dx ?? 0) * geo.width;
  const cy = zone.y + zone.h / 2 + (t.dy ?? 0) * geo.height;
  const x = clamp(cx - w / 2, geo.width * 0.01, geo.width * 0.99 - w);
  const y = clamp(cy - h / 2, geo.height * 0.01, geo.height * 0.99 - h);
  return { ...zone, x, y, w, h, scale, tilt: clamp(t.tilt ?? 0, -15, 15) };
}

export function resolveTitleZone(geo, state, faces = []) {
  return placeTitleZone(geo, baseZone(geo, state, faces), state.title ?? {});
}

function setType(ctx, font, size, track) {
  ctx.font = font(size);
  ctx.letterSpacing = `${(size * track).toFixed(2)}px`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

const measure = (ctx, text) => {
  const m = ctx.measureText(text);
  return { w: m.width, asc: m.actualBoundingBoxAscent || 0, desc: m.actualBoundingBoxDescent || 0 };
};

// Fills the glyphs on their own layer so gradients and highlights stay inside the letters.
function glyphLayer(ctx, text, x, base, m, size, paint) {
  const pad = Math.ceil(size * 0.2);
  const layer = Object.assign(document.createElement('canvas'), { width: Math.ceil(m.w + pad * 2), height: Math.ceil(m.asc + m.desc + pad * 2) });
  const l = layer.getContext('2d');
  Object.assign(l, { font: ctx.font, letterSpacing: ctx.letterSpacing, textBaseline: 'alphabetic', textAlign: 'left' });
  const y = pad + m.asc;
  paint(l, pad, y, pad, pad + m.asc + m.desc, layer.width);
  l.globalCompositeOperation = 'destination-in';
  l.fillStyle = '#000';
  l.fillText(text, pad, y);
  ctx.drawImage(layer, x - pad, base - m.asc - pad);
}

function vertical(l, top, bottom, stops) {
  const g = l.createLinearGradient(0, top, 0, bottom);
  for (const [at, c] of stops) g.addColorStop(at, c);
  return g;
}

// A four-point lens sparkle.
function sparkle(ctx, x, y, r, color = '#ffffff') {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.6);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const rr = k % 2 ? r * 0.12 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawChrome(ctx, text, x, base, m, size, grade, first) {
  ctx.lineJoin = 'round';
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.lineWidth = size * 0.15;
  for (let k = 1; k <= 4; k++) {
    const d = size * 0.022 * k;
    ctx.strokeText(text, x + d, base + d * 1.1);
    ctx.fillText(text, x + d, base + d * 1.1);
  }
  ctx.strokeText(text, x, base);
  ctx.strokeStyle = grade.accent;
  ctx.lineWidth = size * 0.045;
  ctx.strokeText(text, x, base);
  glyphLayer(ctx, text, x, base, m, size, (l, px, py, top, bottom, lw) => {
    l.fillStyle = vertical(l, top, bottom, [[0, '#ffffff'], [0.18, '#fff3d6'], [0.46, '#ffc46a'], [0.5, '#7a1d4e'], [0.54, '#c2306a'], [0.72, '#ff7a45'], [1, '#ffe7b0']]);
    l.fillRect(0, 0, lw, bottom + top);
    l.fillStyle = 'rgba(255,255,255,0.55)';
    l.fillRect(0, top, lw, (bottom - top) * 0.1);
    l.fillStyle = 'rgba(255,255,255,0.8)';
    l.fillRect(0, top + (bottom - top) * 0.535, lw, Math.max(1, size * 0.012));
  });
  if (first) sparkle(ctx, x + size * 0.12, base - m.asc + size * 0.06, size * 0.32);
}

function drawNeon(ctx, text, x, base, size, grade) {
  ctx.lineJoin = 'round';
  ctx.fillStyle = 'rgba(14,4,36,0.55)';
  ctx.fillText(text, x, base);
  for (const [color, lw, blur] of [[grade.accent2, 0.1, 0.55], [grade.accent2, 0.075, 0.3], [grade.accent, 0.055, 0.22], ['#f4ffff', 0.022, 0.08]]) {
    Object.assign(ctx, { strokeStyle: color, lineWidth: size * lw, shadowColor: color, shadowBlur: size * blur });
    ctx.strokeText(text, x, base);
  }
  ctx.shadowBlur = 0;
}

function drawSunset(ctx, text, x, base, m, size) {
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#141a4a';
  ctx.strokeStyle = '#141a4a';
  ctx.lineWidth = size * 0.1;
  const steps = Math.max(4, Math.round(size * 0.07));
  for (let k = steps; k >= 1; k--) {
    const d = (size * 0.085 * k) / steps;
    ctx.strokeText(text, x + d, base + d);
    ctx.fillText(text, x + d, base + d);
  }
  ctx.strokeText(text, x, base);
  glyphLayer(ctx, text, x, base, m, size, (l, px, py, top, bottom, lw) => {
    const h = bottom - top;
    l.fillStyle = vertical(l, top, bottom, [[0, '#fff2a6'], [0.3, '#ffc93c'], [0.62, '#ff8a3a'], [1, '#ff4f78']]);
    l.fillRect(0, 0, lw, bottom + top);
    l.fillStyle = 'rgba(20,26,74,0.9)';
    for (let k = 0; k < 4; k++) l.fillRect(0, top + h * (0.62 + k * 0.1), lw, h * (0.018 + k * 0.012));
    l.fillStyle = 'rgba(255,255,255,0.6)';
    l.fillRect(0, top + h * 0.05, lw, h * 0.07);
  });
}

function drawRiviera(ctx, text, x, base, m, size) {
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.75)', shadowBlur: size * 0.18, shadowOffsetY: size * 0.05, lineJoin: 'miter', strokeStyle: INK, lineWidth: size * 0.07 });
  ctx.strokeText(text, x, base);
  Object.assign(ctx, { shadowBlur: 0, shadowOffsetY: 0 });
  glyphLayer(ctx, text, x, base, m, size, (l, px, py, top, bottom, lw) => {
    l.fillStyle = vertical(l, top, bottom, [[0, '#fffaf0'], [0.55, '#ffe9c2'], [1, '#e6b25a']]);
    l.fillRect(0, 0, lw, bottom + top);
  });
}

function drawHeavy(ctx, text, x, base, size, grade) {
  ctx.lineJoin = 'miter';
  ctx.fillStyle = grade.accent;
  ctx.fillText(text, x + size * 0.07, base + size * 0.07);
  Object.assign(ctx, { strokeStyle: INK, lineWidth: size * 0.16 });
  ctx.strokeText(text, x, base);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, base);
}

// The kicker: tracked small caps between two short accent rules.
function drawKicker(ctx, text, cx, y, size, grade, align, left) {
  setType(ctx, (s) => TEXT(s, 700), size, 0.32);
  const w = ctx.measureText(text).width;
  const x = align === 'left' ? left : cx - w / 2;
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.9)', shadowBlur: size * 0.5, fillStyle: '#fff4dc' });
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = grade.accent2;
  const rule = size * 2.2;
  const ry = y - size * 0.38;
  if (align !== 'left') ctx.fillRect(x - rule - size * 0.7, ry, rule, Math.max(1.5, size * 0.12));
  ctx.fillRect(x + w + size * 0.4, ry, rule, Math.max(1.5, size * 0.12));
}

// The subtitle ribbon: an angled parallelogram with italic copy, glass for the neon finish.
function drawRibbon(ctx, text, cx, top, size, grade, style, align, left) {
  setType(ctx, (s) => TEXT(s, 700), size, 0.06);
  const w = ctx.measureText(text).width + size * 2.2;
  const h = size * 1.7;
  const x = align === 'left' ? left : cx - w / 2;
  const slant = h * 0.35;
  ctx.save();
  ctx.translate(x + w / 2, top + h / 2);
  ctx.rotate(-0.035);
  ctx.beginPath();
  ctx.moveTo(-w / 2 + slant, -h / 2);
  ctx.lineTo(w / 2 + slant * 0.4, -h / 2);
  ctx.lineTo(w / 2 - slant, h / 2);
  ctx.lineTo(-w / 2 - slant * 0.4, h / 2);
  ctx.closePath();
  const neon = style === 'neon';
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, neon ? 'rgba(10,6,34,0.85)' : grade.accent);
  g.addColorStop(1, neon ? 'rgba(30,8,60,0.85)' : grade.accent2);
  Object.assign(ctx, { fillStyle: g, shadowColor: neon ? grade.accent : 'rgba(0,0,0,0.7)', shadowBlur: size * (neon ? 0.9 : 0.4), shadowOffsetY: neon ? 0 : size * 0.12 });
  ctx.fill();
  Object.assign(ctx, { shadowBlur: 0, shadowOffsetY: 0, strokeStyle: neon ? grade.accent : INK, lineWidth: Math.max(1.5, size * 0.12) });
  ctx.stroke();
  ctx.transform(1, 0, -0.2, 1, 0, 0);
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'middle', fillStyle: neon ? '#f4ffff' : '#140616' });
  if (neon) Object.assign(ctx, { shadowColor: grade.accent, shadowBlur: size * 0.6 });
  ctx.fillText(text, 0, size * 0.06);
  ctx.restore();
  return { x: x - slant, y: top, w: w + slant * 2, h };
}

// Lays out kicker, title lines and ribbon inside the zone and draws them under its tilt.
function drawTitleBlock(ctx, geo, zone, state, grade, avoid) {
  const caption = state.caption ?? {};
  const title = String(caption.title ?? '').trim().toUpperCase();
  const kicker = String(caption.tagline ?? '').trim().toUpperCase();
  const subtitle = String(caption.subtitle ?? '').trim().toUpperCase();
  const styleId = STYLE[state.fontStyle] ? state.fontStyle : 'chrome';
  const st = STYLE[styleId];
  const align = zone.align === 'left' ? 'left' : 'center';
  let maxW = zone.w * 0.94;
  if (avoid && avoid.cy + avoid.radius > zone.y && avoid.cy - avoid.radius < zone.y + zone.h) {
    const zc = zone.x + zone.w / 2;
    maxW = align === 'left' ? Math.min(maxW, avoid.cx - avoid.radius * 1.1 - zone.x) : Math.min(maxW, 2 * (Math.abs(avoid.cx - zc) - avoid.radius * 1.12));
    maxW = Math.max(zone.w * 0.45, maxW);
  }
  const words = title.split(/\s+/).filter(Boolean);
  let lines = title ? [title] : [];
  let size = zone.h * (kicker ? 0.56 : 0.64) * (subtitle ? 0.86 : 1);
  setType(ctx, st.font, 100, st.track);
  const widthAt = (list, s) => Math.max(...list.map((t) => ctx.measureText(t).width)) * (s / 100) * (1 + Math.abs(st.skew) * 0.3);
  if (lines.length && widthAt(lines, size) > maxW * 1.5 && words.length > 1) {
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const pair = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
      const wid = widthAt(pair, 100);
      if (!best || wid < best.wid) best = { pair, wid };
    }
    lines = best.pair;
    size *= 0.62;
  }
  if (lines.length) size = Math.min(size, (maxW / widthAt(lines, 100)) * 100);
  size = Math.max(10, size);
  const kSize = Math.max(8, size * 0.17);
  const rSize = Math.max(8, size * 0.2);
  const lineH = size * st.lineH;
  const blockH = (kicker ? kSize * 2 : 0) + lines.length * lineH + (subtitle ? rSize * 2.3 : 0);
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  const left = zone.x + zone.w * 0.03;
  let y = cy - blockH / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((zone.tilt * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  if (styleId === 'neon' && lines.length) {
    setType(ctx, st.font, size, st.track);
    const pw = Math.min(geo.width * 0.98, widthAt(lines, size) + size * 0.8);
    ctx.beginPath();
    ctx.roundRect(align === 'left' ? left - size * 0.4 : cx - pw / 2, y - size * 0.15, pw, blockH + size * 0.3, size * 0.18);
    Object.assign(ctx, { fillStyle: 'rgba(6,4,24,0.5)', strokeStyle: 'rgba(255,255,255,0.12)', lineWidth: Math.max(1, size * 0.015) });
    ctx.fill();
    ctx.stroke();
  }
  if (kicker) {
    drawKicker(ctx, kicker, cx, y + kSize * 1.1, kSize, grade, align, left);
    y += kSize * 2;
  }
  let textW = 0;
  lines.forEach((line, i) => {
    setType(ctx, st.font, size, st.track);
    const m = measure(ctx, line);
    textW = Math.max(textW, m.w);
    const base = y + lineH * 0.86;
    const x = align === 'left' ? left : cx - m.w / 2;
    ctx.save();
    ctx.translate(x, base);
    ctx.transform(1, 0, st.skew, 1, 0, 0);
    ctx.translate(-x, -base);
    if (styleId === 'neon') drawNeon(ctx, line, x, base, size, grade);
    else if (styleId === 'sunset') drawSunset(ctx, line, x, base, m, size);
    else if (styleId === 'riviera') drawRiviera(ctx, line, x, base, m, size);
    else if (styleId === 'heavy') drawHeavy(ctx, line, x, base, size, grade);
    else drawChrome(ctx, line, x, base, m, size, grade, i === 0);
    ctx.restore();
    y += lineH;
  });
  if (subtitle) drawRibbon(ctx, subtitle, cx, y + rSize * 0.4, rSize, grade, styleId, align, left);
  ctx.restore();
  const bw = Math.max(textW + size * 0.3, subtitle ? rSize * subtitle.length * 0.7 : 0);
  const local = { x: align === 'left' ? left - size * 0.1 : cx - bw / 2, y: cy - blockH / 2 - size * 0.08, w: bw, h: blockH + size * 0.16 };
  return rotatedBounds(local, cx, cy, zone.tilt);
}

function rotatedBounds(r, cx, cy, tilt) {
  const a = (tilt * Math.PI) / 180;
  const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

function arcText(ctx, text, cx, cy, r, top) {
  const chars = [...text];
  const gap = ctx.measureText(' ').width * 0.35;
  const widths = chars.map((c) => ctx.measureText(c).width + gap);
  const span = widths.reduce((s, w) => s + w, 0) / r;
  const dir = top ? 1 : -1;
  let a = (top ? -Math.PI / 2 : Math.PI / 2) - (dir * span) / 2;
  chars.forEach((c, i) => {
    a += (dir * widths[i]) / 2 / r;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + (top ? Math.PI / 2 : -Math.PI / 2));
    ctx.fillText(c, 0, 0);
    ctx.restore();
    a += (dir * widths[i]) / 2 / r;
  });
}

// The edition seal: a scalloped, bevelled disc with the VP monogram and the edition on two arcs.
function drawSeal(ctx, { cx, cy, radius: r }, text, grade) {
  ctx.save();
  ctx.beginPath();
  for (let k = 0; k <= 96; k++) {
    const a = (k / 96) * Math.PI * 2;
    const rr = r * (1 + 0.055 * Math.cos(a * 24));
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.1);
  g.addColorStop(0, '#fff3c4');
  g.addColorStop(0.45, grade.accent2);
  g.addColorStop(1, grade.accent);
  Object.assign(ctx, { fillStyle: g, shadowColor: 'rgba(0,0,0,0.7)', shadowBlur: r * 0.3, shadowOffsetY: r * 0.08 });
  ctx.fill();
  Object.assign(ctx, { shadowBlur: 0, shadowOffsetY: 0, strokeStyle: INK, lineWidth: r * 0.07 });
  ctx.stroke();
  for (const [rr, color, lw] of [[0.8, INK, 0.05], [0.74, 'rgba(255,255,255,0.85)', 0.02]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * rr, 0, Math.PI * 2);
    Object.assign(ctx, { strokeStyle: color, lineWidth: r * lw });
    ctx.stroke();
  }
  setType(ctx, DISPLAY, r * 0.44, 0);
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'middle', fillStyle: INK });
  ctx.fillText('VP', cx + r * 0.02, cy + r * 0.05);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('VP', cx, cy + r * 0.03);
  const words = String(text || '').toUpperCase().split(/\s+/).filter(Boolean);
  if (words.length) {
    setType(ctx, DISPLAY, r * 0.19, 0.04);
    Object.assign(ctx, { textAlign: 'center', textBaseline: 'middle', fillStyle: INK });
    arcText(ctx, words[0], cx, cy, r * 0.56, true);
    if (words.length > 1) arcText(ctx, words.slice(1).join(' '), cx, cy, r * 0.56, false);
  }
  ctx.restore();
}

// The original 17+ plate: white card, black frame, big numerals over a MATURE strip.
function drawRatingPlate(ctx, geo, unit) {
  const w = unit * 0.075;
  const h = w * 1.32;
  const x = geo.gutter * 2.2;
  const y = geo.height - geo.gutter * 2.2 - h;
  ctx.save();
  Object.assign(ctx, { fillStyle: '#ffffff', strokeStyle: INK, lineWidth: Math.max(2, w * 0.06), shadowColor: 'rgba(0,0,0,0.6)', shadowBlur: w * 0.2 });
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = INK;
  ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
  setType(ctx, DISPLAY, w * 0.56, 0);
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'middle' });
  ctx.fillText('17+', x + w / 2, y + h * 0.37);
  setType(ctx, (s) => TEXT(s, 700), w * 0.15, 0.08);
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'middle', fillStyle: '#ffffff' });
  ctx.fillText('MATURE', x + w / 2, y + h * 0.85);
  ctx.restore();
}

// A UPC-style barcode with bars hashed from the title, digits under it.
function drawBarcode(ctx, geo, unit, seedText) {
  const w = unit * 0.13;
  const h = w * 0.62;
  const x = geo.width - geo.gutter * 2.2 - w;
  const y = geo.height - geo.gutter * 2.2 - h;
  let hash = 2166136261;
  for (const c of String(seedText)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const rand = () => ((hash = Math.imul(hash ^ (hash >>> 15), 2246822507) >>> 0) % 1000) / 1000;
  ctx.save();
  Object.assign(ctx, { fillStyle: '#ffffff', shadowColor: 'rgba(0,0,0,0.5)', shadowBlur: w * 0.08 });
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.fillStyle = INK;
  const pad = w * 0.07;
  const barH = h * 0.66;
  for (let bx = x + pad; bx < x + w - pad;) {
    const bw = Math.max(1, w * (0.006 + rand() * 0.018));
    ctx.fillRect(bx, y + pad * 0.8, bw, barH);
    bx += bw + Math.max(1, w * (0.006 + rand() * 0.014));
  }
  const digits = Array.from({ length: 12 }, () => Math.floor(rand() * 10)).join('');
  setType(ctx, (s) => TEXT(s, 400), h * 0.15, 0.12);
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'alphabetic' });
  ctx.fillText(`${digits[0]} ${digits.slice(1, 6)} ${digits.slice(6, 11)} ${digits[11]}`, x + w / 2, y + h - pad * 0.6);
  ctx.restore();
}

// The edition band across the top: an accent VP block and the tracked edition line.
function drawPlatformBand(ctx, geo, unit, text, grade) {
  const h = unit * 0.05;
  const y = geo.gutter * 1.15;
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,13,0.92)';
  ctx.fillRect(0, y, geo.width, h);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(geo.gutter * 1.15, y, h * 2.2, h);
  setType(ctx, DISPLAY, h * 0.62, 0.04);
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'middle', fillStyle: INK });
  ctx.fillText('VP', geo.gutter * 1.15 + h * 1.1, y + h * 0.54);
  setType(ctx, (s) => TEXT(s, 700), h * 0.38, 0.4);
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'middle', fillStyle: '#fff4dc' });
  ctx.fillText(String(text || 'COLLECTOR EDITION').toUpperCase(), geo.width / 2, y + h * 0.54);
  ctx.fillStyle = grade.accent2;
  ctx.fillRect(0, y + h - Math.max(1, h * 0.06), geo.width, Math.max(1, h * 0.06));
  ctx.restore();
}

// An anamorphic sun flare: a hot core, a long horizontal streak and two ghost rings.
function drawSunFlare(ctx, geo, unit, grade) {
  const x = geo.width * 0.74;
  const y = geo.height * 0.16;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const core = ctx.createRadialGradient(x, y, 0, x, y, unit * 0.16);
  core.addColorStop(0, 'rgba(255,248,220,0.95)');
  core.addColorStop(0.25, 'rgba(255,190,110,0.45)');
  core.addColorStop(1, 'rgba(255,120,80,0)');
  ctx.fillStyle = core;
  ctx.fillRect(x - unit * 0.16, y - unit * 0.16, unit * 0.32, unit * 0.32);
  const streak = ctx.createLinearGradient(0, 0, geo.width, 0);
  streak.addColorStop(0, 'rgba(120,200,255,0)');
  streak.addColorStop(x / geo.width, 'rgba(255,240,210,0.85)');
  streak.addColorStop(1, 'rgba(120,200,255,0)');
  ctx.fillStyle = streak;
  ctx.fillRect(0, y - unit * 0.003, geo.width, unit * 0.006);
  for (const [k, r, a] of [[0.55, 0.05, 0.18], [0.3, 0.09, 0.1]]) {
    const gx = x + (geo.width / 2 - x) * (1 + k);
    const gy = y + (geo.height / 2 - y) * (1 + k);
    ctx.beginPath();
    ctx.arc(gx, gy, unit * r, 0, Math.PI * 2);
    Object.assign(ctx, { strokeStyle: grade.accent2, globalAlpha: a, lineWidth: unit * 0.008 });
    ctx.stroke();
  }
  ctx.restore();
}

// Letters the whole cover and returns where the title went (rect) and the zone it was fitted in.
export function renderCoverTypography(ctx, geo, state, grade, stickers = {}, faces = []) {
  const unit = Math.min(geo.width, geo.height);
  const age = stickers.age ?? stickers.rating;
  const band = stickers.header ?? stickers.platform;
  if (stickers.flare) drawSunFlare(ctx, geo, unit, grade);
  if (band) drawPlatformBand(ctx, geo, unit, state.caption?.platform, grade);
  const zone = resolveTitleZone(geo, state, faces);
  let seal = stickers.medallion ?? true ? geo.zones.badge : null;
  if (seal && stickers.barcode) {
    // a seal that would sit on the barcode corner moves up above it
    const top = geo.height - geo.gutter * 2.2 - unit * 0.13 * 0.62;
    const left = geo.width - geo.gutter * 2.2 - unit * 0.13;
    if (seal.cx + seal.radius > left && seal.cy + seal.radius * 1.06 > top) seal = { ...seal, cy: top - seal.radius * 1.25 };
  }
  ctx.save();
  const rect = drawTitleBlock(ctx, geo, zone, state, grade, seal);
  ctx.restore();
  if (seal) drawSeal(ctx, seal, state.caption?.badge, grade);
  if (age) drawRatingPlate(ctx, geo, unit);
  if (stickers.barcode) drawBarcode(ctx, geo, unit, state.caption?.title ?? 'VP');
  return { rect, zone };
}
