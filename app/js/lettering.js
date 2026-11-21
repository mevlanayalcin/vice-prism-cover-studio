// Box-art lettering on the cover canvas: kicker, the title in five finishes, the italic subtitle
// ribbon, the scalloped edition seal, the 17+ plate, the barcode and the platform band. The seal
// keeps its layout spot unless it would cover a face or vehicle; then it takes the clearest corner
// and the title zone gives way. All type is original; no game mark is drawn.

const FONT = {
  display: "'VP Display', 'Arial Black', Impact, sans-serif",
  text: "'VP Text', 'Helvetica Neue', Arial, sans-serif",
  serif: "'VP Editorial', Georgia, 'Times New Roman', serif",
};
const SKEW = { chrome: -0.16, neon: -0.08, sunset: -0.13, riviera: 0, heavy: -0.06 };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

const PRESETS = {
  center: { x: 0.08, y: 0.36, w: 0.84, h: 0.28, align: 'center' },
  top: { x: 0.06, y: 0.04, w: 0.88, h: 0.24, align: 'center' },
  band: { x: 0.06, y: 0.7, w: 0.88, h: 0.22, align: 'center' },
  left: { x: 0.05, y: 0.3, w: 0.5, h: 0.36, align: 'left' },
};

// The title zone in cover pixels for the chosen position ('auto' is the layout's own band).
export function resolveTitleZone(geometry, state) {
  const { width, height } = geometry;
  const preset = PRESETS[state.textPosition];
  if (!preset) return { ...geometry.zones.title, align: geometry.zones.title.align ?? 'center' };
  return { x: preset.x * width, y: preset.y * height, w: preset.w * width, h: preset.h * height, align: preset.align };
}

// Applies the user's drag offset, size and tilt, then keeps the lettering inside the frame.
export function placeTitleZone(zone, title = {}, { width, height, contentW = zone.w, contentH = zone.h }) {
  const scale = clamp(title.scale ?? 1, 0.5, 1.6);
  const tilt = ((title.tilt ?? 0) * Math.PI) / 180;
  const anchor = zone.align === 'left' ? zone.x + contentW / 2 : zone.x + zone.w / 2;
  const halfW = (Math.abs(Math.cos(tilt)) * contentW + Math.abs(Math.sin(tilt)) * contentH) * scale / 2;
  const halfH = (Math.abs(Math.sin(tilt)) * contentW + Math.abs(Math.cos(tilt)) * contentH) * scale / 2;
  const m = Math.min(width, height) * 0.02;
  const cx = clamp(anchor + (title.dx ?? 0) * width, Math.min(width / 2, m + halfW), Math.max(width / 2, width - m - halfW));
  const cy = clamp(zone.y + zone.h / 2 + (title.dy ?? 0) * height, Math.min(height / 2, m + halfH), Math.max(height / 2, height - m - halfH));
  return { cx, cy, scale, tilt, halfW, halfH, rect: { x: cx - halfW, y: cy - halfH, w: halfW * 2, h: halfH * 2 } };
}

const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const circleBox = (s) => ({ x: s.cx - s.r, y: s.cy - s.r, w: s.r * 2, h: s.r * 2 });

// Hero-safe seal spot: the layout's own spot when it is clear of every subject, otherwise the
// free corner with the least subject and title area under it.
function placeSeal(geometry, zone, heroes) {
  const { width, height } = geometry;
  const unit = Math.min(width, height);
  const r = geometry.zones.badge.radius;
  const m = unit * 0.03 + geometry.gutter;
  const area = 4 * r * r;
  const pad = unit * 0.02; // a near miss counts: the seal needs air round a wheel or a chin
  const heroHit = (s) => heroes.reduce((sum, h) => sum + overlap(circleBox(s), { x: h.x - pad, y: h.y - pad, w: h.w + pad * 2, h: h.h + pad * 2 }) * (h.kind === 'face' ? 1.5 : 1), 0);
  const home = { cx: geometry.zones.badge.cx, cy: geometry.zones.badge.cy, r };
  if (heroHit(home) < area * 0.05) return home;
  const spots = [
    { cx: width - m - r, cy: m + r }, { cx: m + r, cy: m + r },
    { cx: width - m - r, cy: height * 0.5 }, { cx: m + r, cy: height * 0.5 },
  ].map((s) => ({ ...s, r }));
  let best = home;
  let bestScore = heroHit(home) * 4;
  for (const s of spots) {
    const score = heroHit(s) * 4 + overlap(circleBox(s), zone) * 0.5;
    if (score < bestScore) [best, bestScore] = [s, score];
  }
  return best;
}

// The title zone gives way to the seal: the side the seal sits on is trimmed and the zone
// centre moves half as far, so the lettering stays near the middle of the cover.
function yieldToSeal(zone, seal) {
  if (!seal || seal.cy + seal.r < zone.y || seal.cy - seal.r > zone.y + zone.h) return zone;
  const pad = seal.r * 1.12;
  const left = zone.x;
  const right = zone.x + zone.w;
  if (seal.cx > zone.x + zone.w / 2 && seal.cx - pad < right) {
    const trim = right - (seal.cx - pad);
    return { ...zone, x: left + trim * 0.5, w: zone.w - trim * 1.5 };
  }
  if (seal.cx <= zone.x + zone.w / 2 && seal.cx + pad > left) {
    const trim = seal.cx + pad - left;
    return { ...zone, x: left + trim, w: zone.w - trim * 1.5 };
  }
  return zone;
}

function setFont(ctx, weight, size, family, spacing = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
}

function titleFont(style, fs) {
  if (style === 'riviera') return ['700', FONT.serif, fs * 0.035];
  if (style === 'heavy') return ['900', FONT.display, -fs * 0.005];
  return ['900', FONT.display, fs * 0.018];
}

// A four-point lens glint with a soft core.
function sparkle(ctx, x, y, size) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, size);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,240,250,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - size, y - size, size * 2, size * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (const [ax, ay] of [[1, 0], [0, 1]]) {
    ctx.beginPath();
    ctx.moveTo(x - ax * size * 2.2, y - ay * size * 2.2);
    ctx.lineTo(x + ay * size * 0.09, y + ax * size * 0.09);
    ctx.lineTo(x + ax * size * 2.2, y + ay * size * 2.2);
    ctx.lineTo(x - ay * size * 0.09, y - ax * size * 0.09);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function chromeTitle(ctx, text, y, fs, cap, grade, align) {
  const depth = Math.max(3, Math.round(fs * 0.085));
  for (let k = depth; k >= 1; k--) {
    ctx.fillStyle = k > depth * 0.6 ? '#07030c' : '#2b0c3f';
    ctx.fillText(text, k * 0.55, y + k);
  }
  Object.assign(ctx, { lineJoin: 'round', strokeStyle: '#07040b', lineWidth: fs * 0.13 });
  ctx.strokeText(text, 0, y);
  const rim = ctx.createLinearGradient(0, y - cap, 0, y);
  rim.addColorStop(0, grade.accent2);
  rim.addColorStop(1, grade.accent);
  Object.assign(ctx, { strokeStyle: rim, lineWidth: fs * 0.055 });
  ctx.strokeText(text, 0, y);
  const fill = ctx.createLinearGradient(0, y - cap, 0, y + fs * 0.02);
  [[0, '#ffffff'], [0.3, '#fff0f6'], [0.5, '#ffc6dc'], [0.53, '#3b0d4f'], [0.58, grade.accent], [0.8, '#ff9b55'], [1, '#ffe7a0']].forEach(([o, c]) => fill.addColorStop(o, c));
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, y);
  Object.assign(ctx, { strokeStyle: 'rgba(255,255,255,0.7)', lineWidth: Math.max(1, fs * 0.012) });
  ctx.strokeText(text, -fs * 0.006, y - fs * 0.01);
  const w = ctx.measureText(text).width;
  const left = align === 'left' ? 0 : -w / 2;
  sparkle(ctx, left + fs * 0.12, y - cap * 0.92, fs * 0.13);
  sparkle(ctx, left + w - fs * 0.2, y - cap * 0.18, fs * 0.08);
}

function neonTitle(ctx, text, y, fs, cap, grade, align) {
  const w = ctx.measureText(text).width;
  const pad = fs * 0.2;
  const left = align === 'left' ? 0 : -w / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left - pad, y - cap - pad * 0.8, w + pad * 2, cap + pad * 1.6, fs * 0.12);
  ctx.fillStyle = 'rgba(5,5,26,0.6)';
  ctx.fill();
  Object.assign(ctx, { strokeStyle: `${grade.accent2}99`, lineWidth: fs * 0.014, shadowColor: grade.accent2, shadowBlur: fs * 0.2 });
  ctx.stroke();
  ctx.restore();
  Object.assign(ctx, { lineJoin: 'round', lineCap: 'round' });
  ctx.fillStyle = 'rgba(10,6,34,0.55)';
  ctx.fillText(text, 0, y);
  for (const [color, width, blur] of [[grade.accent2, 0.085, 0.5], [grade.accent2, 0.07, 0.25], [grade.accent, 0.045, 0.18]]) {
    Object.assign(ctx, { strokeStyle: color, lineWidth: fs * width, shadowColor: color, shadowBlur: fs * blur });
    ctx.strokeText(text, 0, y);
  }
  Object.assign(ctx, { strokeStyle: '#ffffff', lineWidth: fs * 0.018, shadowColor: '#ffffff', shadowBlur: fs * 0.06 });
  ctx.strokeText(text, 0, y);
  ctx.shadowBlur = 0;
}

function sunsetTitle(ctx, text, y, fs, cap, grade, align) {
  const depth = Math.max(4, Math.round(fs * 0.11));
  Object.assign(ctx, { lineJoin: 'round', fillStyle: '#141047', strokeStyle: '#0d0b30', lineWidth: fs * 0.07 });
  for (let k = depth; k >= 1; k--) {
    ctx.strokeText(text, k * 0.7, y + k);
    ctx.fillText(text, k * 0.7, y + k);
  }
  ctx.strokeText(text, 0, y);
  // the enamel lives on its own layer so the retro stripes can be cut out of it
  const w = Math.ceil(ctx.measureText(text).width + fs * 0.4);
  const h = Math.ceil(cap + fs * 0.3);
  const layer = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const lc = layer.getContext('2d');
  lc.font = ctx.font;
  if ('letterSpacing' in lc) lc.letterSpacing = ctx.letterSpacing;
  lc.textBaseline = 'alphabetic';
  lc.textAlign = 'left';
  const top = fs * 0.15;
  const g = lc.createLinearGradient(0, top, 0, top + cap);
  [[0, '#fff3a6'], [0.35, '#ffc247'], [0.62, '#ff7a45'], [1, grade.accent]].forEach(([o, c]) => g.addColorStop(o, c));
  lc.fillStyle = g;
  lc.fillText(text, fs * 0.2, top + cap);
  lc.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 5; i++) lc.fillRect(0, top + cap * (0.56 + i * 0.09), w, Math.max(1, cap * (0.014 + i * 0.009)));
  const left = align === 'left' ? 0 : -(w - fs * 0.4) / 2;
  ctx.drawImage(layer, left - fs * 0.2, y - cap - top);
  Object.assign(ctx, { strokeStyle: 'rgba(255,248,220,0.55)', lineWidth: Math.max(1, fs * 0.01) });
  ctx.strokeText(text, 0, y);
}

function rivieraTitle(ctx, text, y, fs, cap, grade) {
  Object.assign(ctx, { lineJoin: 'round', strokeStyle: '#0b0710', lineWidth: fs * 0.07 });
  ctx.fillStyle = grade.accent;
  ctx.fillText(text, fs * 0.05, y + fs * 0.05);
  ctx.strokeText(text, 0, y);
  const g = ctx.createLinearGradient(0, y - cap, 0, y);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(1, '#ffe2b0');
  ctx.fillStyle = g;
  ctx.fillText(text, 0, y);
}

function heavyTitle(ctx, text, y, fs, cap, grade) {
  Object.assign(ctx, { lineJoin: 'miter', miterLimit: 3 });
  ctx.fillStyle = '#07050a';
  ctx.fillText(text, fs * 0.09, y + fs * 0.1);
  ctx.fillStyle = grade.accent;
  ctx.fillText(text, fs * 0.055, y + fs * 0.06);
  Object.assign(ctx, { strokeStyle: '#07050a', lineWidth: fs * 0.12 });
  ctx.strokeText(text, 0, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 0, y);
}

const TITLE_STYLES = { chrome: chromeTitle, neon: neonTitle, sunset: sunsetTitle, riviera: rivieraTitle, heavy: heavyTitle };

function kicker(ctx, text, y, size, grade, align) {
  setFont(ctx, '700', size, FONT.text, size * 0.32);
  const w = ctx.measureText(text).width;
  const left = align === 'left' ? 0 : -w / 2;
  Object.assign(ctx, { shadowColor: 'rgba(0,0,0,0.85)', shadowBlur: size * 0.5, fillStyle: '#fff6e8' });
  ctx.fillText(text, 0, y);
  ctx.shadowBlur = 0;
  Object.assign(ctx, { strokeStyle: grade.accent2, lineWidth: Math.max(1, size * 0.12) });
  ctx.beginPath();
  if (align !== 'left') {
    ctx.moveTo(left - size * 3.4, y - size * 0.35);
    ctx.lineTo(left - size * 0.8, y - size * 0.35);
  }
  ctx.moveTo(left + w + size * 0.5, y - size * 0.35);
  ctx.lineTo(left + w + size * 3.1, y - size * 0.35);
  ctx.stroke();
}

// The italic subtitle ribbon: a slanted enamel plate (or a glowing glass bar for Neon Tube).
function ribbon(ctx, text, y, h, grade, style, align) {
  const size = h * 0.56;
  setFont(ctx, '700', size, FONT.text, size * 0.08);
  const tw = ctx.measureText(text).width;
  const w = tw + h * 1.5;
  const slant = h * 0.34;
  const x = align === 'left' ? 0 : -w / 2;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-0.035);
  ctx.beginPath();
  ctx.moveTo(-w / 2 + slant, -h / 2);
  ctx.lineTo(w / 2 + slant * 0.4, -h / 2);
  ctx.lineTo(w / 2 - slant, h / 2);
  ctx.lineTo(-w / 2 - slant * 0.4, h / 2);
  ctx.closePath();
  const neon = style === 'neon';
  if (neon) {
    Object.assign(ctx, { fillStyle: 'rgba(6,8,30,0.78)', strokeStyle: grade.accent, lineWidth: h * 0.07, shadowColor: grade.accent, shadowBlur: h * 0.6 });
    ctx.fill();
    ctx.stroke();
  } else {
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, grade.accent);
    g.addColorStop(1, grade.accent2);
    Object.assign(ctx, { fillStyle: g, strokeStyle: '#0a0610', lineWidth: h * 0.1, lineJoin: 'round' });
    ctx.stroke();
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  ctx.transform(1, 0, -0.2, 1, 0, 0);
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'middle', fillStyle: neon ? '#e9fdff' : '#170a24' });
  if (neon) Object.assign(ctx, { shadowColor: grade.accent, shadowBlur: h * 0.3 });
  ctx.fillText(text, 0, h * 0.04);
  ctx.restore();
  return w;
}

function arcText(ctx, text, cx, cy, R, top, spacing) {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) / R;
  let a = top ? -Math.PI / 2 - total / 2 : Math.PI / 2 + total / 2;
  chars.forEach((c, i) => {
    const da = widths[i] / R;
    const mid = top ? a + da / 2 : a - da / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * R, cy + Math.sin(mid) * R);
    ctx.rotate(top ? mid + Math.PI / 2 : mid - Math.PI / 2);
    ctx.fillText(c, 0, 0);
    ctx.restore();
    a = top ? a + da : a - da;
  });
}

// The scalloped edition seal: a 24-point scalloped rim, an enamel disc, the edition words on two
// arcs and the VP monogram.
function seal(ctx, { cx, cy, r }, text, grade) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 288; i++) {
    const a = (i / 288) * Math.PI * 2;
    const rr = r * (0.94 + 0.06 * Math.cos(a * 24));
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  Object.assign(ctx, { fillStyle: grade.accent, strokeStyle: '#09060d', lineWidth: r * 0.06, shadowColor: 'rgba(0,0,0,0.6)', shadowBlur: r * 0.25, shadowOffsetY: r * 0.06 });
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.stroke();
  const disc = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.05, cx, cy, r * 0.8);
  disc.addColorStop(0, '#fff3cf');
  disc.addColorStop(0.55, grade.accent2);
  disc.addColorStop(1, '#b8452a');
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  Object.assign(ctx, { fillStyle: disc, strokeStyle: '#fff6e0', lineWidth: r * 0.04 });
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
  Object.assign(ctx, { strokeStyle: 'rgba(23,10,36,0.7)', lineWidth: r * 0.025 });
  ctx.stroke();
  const words = String(text || 'EDITION').toUpperCase().split(/\s+/).filter(Boolean);
  const topText = words.length > 1 ? words.slice(0, Math.ceil(words.length / 2)).join(' ') : words[0];
  const bottomText = words.length > 1 ? words.slice(Math.ceil(words.length / 2)).join(' ') : '';
  let size = r * 0.19;
  setFont(ctx, '900', size, FONT.text, 0);
  const longest = Math.max(ctx.measureText(topText).width, ctx.measureText(bottomText).width);
  if (longest / (r * 0.6) > 2.5) size *= 2.5 / (longest / (r * 0.6));
  setFont(ctx, '900', size, FONT.text, 0);
  Object.assign(ctx, { fillStyle: '#170a24', textAlign: 'center', textBaseline: 'middle' });
  arcText(ctx, topText, cx, cy, r * 0.6, true, size * 0.12);
  if (bottomText) arcText(ctx, bottomText, cx, cy, r * 0.6, false, size * 0.12);
  setFont(ctx, '900', r * 0.42, FONT.display, 0);
  Object.assign(ctx, { lineJoin: 'round', strokeStyle: '#fff6e0', lineWidth: r * 0.07 });
  ctx.strokeText('VP', cx, cy + r * 0.02);
  ctx.fillStyle = '#170a24';
  ctx.fillText('VP', cx, cy + r * 0.02);
  ctx.restore();
}

function agePlate(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(x - s * 0.06, y - s * 0.06, s * 1.12, s * 1.42);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, s, s);
  setFont(ctx, '900', s * 0.56, FONT.display, 0);
  Object.assign(ctx, { fillStyle: '#0a0a0d', textAlign: 'center', textBaseline: 'middle' });
  ctx.fillText('17+', x + s / 2, y + s * 0.53);
  setFont(ctx, '900', s * 0.15, FONT.text, s * 0.03);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('MATURE', x + s / 2, y + s * 1.17);
  ctx.restore();
}

function barcode(ctx, x, y, w, h, seedText) {
  let seed = [...seedText].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const next = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  const pad = w * 0.07;
  const barsH = h * 0.66;
  ctx.fillStyle = '#0a0a0d';
  for (let bx = x + pad; bx < x + w - pad;) {
    const bw = Math.max(1, (w * (0.006 + next() * 0.014)) | 0);
    if (next() > 0.38) ctx.fillRect(bx, y + h * 0.1, bw, barsH);
    bx += bw + Math.max(1, (w * 0.008) | 0);
  }
  const digits = Array.from({ length: 12 }, () => (next() * 10) | 0).join('');
  setFont(ctx, '700', h * 0.17, FONT.text, h * 0.02);
  Object.assign(ctx, { textAlign: 'center', textBaseline: 'alphabetic' });
  ctx.fillText(`${digits[0]} ${digits.slice(1, 6)} ${digits.slice(6, 11)} ${digits[11]}`, x + w / 2, y + h * 0.95);
  ctx.restore();
}

function platformBand(ctx, width, unit, text, grade) {
  const h = unit * 0.052;
  ctx.save();
  ctx.fillStyle = 'rgba(8,7,12,0.92)';
  ctx.fillRect(0, 0, width, h);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, h - Math.max(2, unit * 0.004), width, Math.max(2, unit * 0.004));
  setFont(ctx, '900', h * 0.46, FONT.text, h * 0.18);
  Object.assign(ctx, { fillStyle: '#fff6e8', textAlign: 'center', textBaseline: 'middle' });
  ctx.fillText(String(text || 'COLLECTOR EDITION').toUpperCase(), width / 2, h * 0.5);
  setFont(ctx, '900', h * 0.5, FONT.display, 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = grade.accent;
  ctx.fillText('VP', unit * 0.03, h * 0.52);
  ctx.restore();
}

// Letters the whole cover and returns the title box (for dragging) and the seal spot.
export function renderCoverTypography(ctx, { width, height, geometry, state, grade, heroRects = [] }) {
  const unit = Math.min(width, height);
  const cap = state.caption ?? {};
  const style = TITLE_STYLES[state.fontStyle] ? state.fontStyle : 'chrome';
  const stickers = state.stickers ?? {};
  if (stickers.header) platformBand(ctx, width, unit, cap.platform, grade);
  let zone = resolveTitleZone(geometry, state);
  const sealSpot = stickers.medallion ? placeSeal(geometry, zone, heroRects) : null;
  zone = yieldToSeal(zone, sealSpot);
  const title = String(cap.title || '').toUpperCase().trim();
  const sub = String(cap.subtitle || '').toUpperCase().trim();
  const kick = String(cap.tagline || '').toUpperCase().trim();
  const align = zone.align === 'left' ? 'left' : 'center';
  // fit the title: 56% of the zone height, at most 2.65 zone heights wide so it reads as a lockup
  let fs = zone.h * 0.56;
  const [weight, family, spacing] = titleFont(style, fs);
  setFont(ctx, weight, fs, family, spacing);
  const maxW = Math.min(zone.w * 0.94, zone.h * 2.65);
  const measured = title ? ctx.measureText(title).width : 0;
  if (measured > maxW) fs *= maxW / measured;
  const capH = fs * 0.74;
  const kh = kick ? fs * 0.17 : 0;
  const rh = sub ? fs * 0.3 : 0;
  const gap = fs * 0.14;
  const contentH = kh + (kh ? gap : 0) + capH + (rh ? gap * 1.3 + rh : 0);
  setFont(ctx, weight, fs, family, titleFont(style, fs)[2]);
  const titleW = title ? ctx.measureText(title).width : 0;
  const contentW = Math.max(titleW + fs * 0.3, sub ? rh * 0.56 * sub.length * 0.62 + rh * 1.5 : 0);
  const place = placeTitleZone(zone, state.title, { width, height, contentW, contentH });
  ctx.save();
  ctx.translate(place.cx, place.cy);
  ctx.rotate(place.tilt);
  ctx.scale(place.scale, place.scale);
  if (align === 'left') ctx.translate(-contentW / 2, 0);
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  let y = -contentH / 2;
  if (kh) {
    kicker(ctx, kick, y + kh * 0.8, kh, grade, align);
    y += kh + gap;
  }
  if (title) {
    ctx.save();
    const skew = SKEW[style];
    ctx.translate(0, y + capH / 2);
    ctx.transform(1, 0, skew, 1, 0, 0);
    ctx.translate(0, -(y + capH / 2));
    setFont(ctx, weight, fs, family, titleFont(style, fs)[2]);
    TITLE_STYLES[style](ctx, title, y + capH, fs, capH, grade, align);
    ctx.restore();
  }
  y += capH;
  if (rh) {
    y += gap * 1.3;
    ctx.textAlign = 'center';
    ribbon(ctx, sub, y, rh, grade, style, align);
  }
  ctx.restore();
  if (sealSpot) seal(ctx, sealSpot, cap.badge, grade);
  const m = unit * 0.045 + geometry.gutter;
  if (stickers.age) {
    const s = unit * 0.082;
    agePlate(ctx, m, height - m - s * 1.3, s);
  }
  if (stickers.barcode) {
    const bw = unit * 0.15;
    const bh = unit * 0.078;
    barcode(ctx, width - m - bw, height - m - bh, bw, bh, `${title}|${sub}`);
  }
  return { rect: place.rect, seal: sealSpot, zone };
}
