// Ink kit: the comic-noir primitives every Leonida illustration is built from. Shapes are Path2D
// outlines in local units, so one drawing renders crisp at any panel size; cel shadows and rim
// lights are carved from the shape itself, and halftone screens are one cached dot tile.

export const INK = '#0a0a0d';
export const TAU = Math.PI * 2;
const fade = (color, a) => color.replace(/[\d.]+\)$/, `${a})`);

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const paths = new Map();
export const P = (d) => paths.get(d) ?? paths.set(d, new Path2D(d)).get(d);

function stopsInto(g, stops) {
  stops.forEach((s, i) => (Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), s)));
  return g;
}
export const lin = (ctx, x0, y0, x1, y1, stops) => stopsInto(ctx.createLinearGradient(x0, y0, x1, y1), stops);
export const rad = (ctx, x, y, r0, r1, stops) => stopsInto(ctx.createRadialGradient(x, y, r0, x, y, r1), stops);

export function inked(ctx, path, fill, line = 3) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(path);
  }
  Object.assign(ctx, { lineJoin: 'round', lineCap: 'round', strokeStyle: INK, lineWidth: line });
  ctx.stroke(path);
}

export function crescent(ctx, path, dx, dy, fill, alpha = 1) {
  const carve = new Path2D();
  carve.rect(-1e5, -1e5, 2e5, 2e5);
  carve.addPath(path, new DOMMatrix().translate(-dx, -dy));
  ctx.save();
  ctx.clip(path);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = fill;
  ctx.fill(carve, 'evenodd');
  ctx.restore();
}

export function glow(ctx, x, y, r, color, alpha = 1) {
  ctx.save();
  Object.assign(ctx, { globalCompositeOperation: 'lighter', globalAlpha: ctx.globalAlpha * alpha });
  ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, color], [0.25, fade(color, 0.45)], [1, fade(color, 0)]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

export function flare(ctx, x, y, r, color = 'rgba(255,240,220,1)', alpha = 1) {
  glow(ctx, x, y, r, color, 0.55 * alpha);
  ctx.save();
  Object.assign(ctx, { globalCompositeOperation: 'lighter', globalAlpha: ctx.globalAlpha * alpha, fillStyle: color });
  for (const [sx, sy] of [[1, 0.035], [0.035, 0.55]]) {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.6 * sx, r * 1.6 * sy, 0, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, r * 0.12, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}

const dotTiles = new Map();
function halftoneTile(color) {
  if (dotTiles.has(color)) return dotTiles.get(color);
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const x = c.getContext('2d');
  x.fillStyle = color;
  for (const k of [6, 18]) {
    x.beginPath();
    x.arc(k, k, 3.6, 0, TAU);
    x.fill();
  }
  dotTiles.set(color, c);
  return c;
}

export function halftone(ctx, path, color, alpha = 0.3, scale = 1, angle = 0.4) {
  const pat = ctx.createPattern(halftoneTile(color), 'repeat');
  pat.setTransform(new DOMMatrix().rotate((angle * 180) / Math.PI).scale(scale));
  ctx.save();
  if (path) ctx.clip(path);
  Object.assign(ctx, { globalAlpha: ctx.globalAlpha * alpha, fillStyle: pat });
  ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
  ctx.restore();
}

export function hatch(ctx, x, y, w, h, gap, angle, color, width = 1.4, seed = 3) {
  const r = rng(seed);
  const len = Math.hypot(w, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  Object.assign(ctx, { strokeStyle: color, lineWidth: width, lineCap: 'round' });
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  ctx.beginPath();
  for (let t = -len / 2; t < len / 2; t += gap) {
    ctx.moveTo(-len / 2 + r() * len * 0.2, t);
    ctx.lineTo(len / 2 - r() * len * 0.2, t);
  }
  ctx.stroke();
  ctx.restore();
}

export function sky(ctx, w, h, stops, bands = 0) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, h, stops);
  ctx.fillRect(0, 0, w, h);
  for (let i = 1; i < bands; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.025 + (i % 2) * 0.02})`;
    ctx.fillRect(0, (h * i) / bands, w, h / bands / 2);
  }
}

export function cloudStreaks(ctx, x, y, w, rows, lit, dark, seed = 9) {
  const r = rng(seed);
  for (let i = 0; i < rows; i++) {
    const cx = x + r() * w;
    const cy = y + i * 26 + r() * 18;
    const cw = 160 + r() * 380;
    const ch = 10 + r() * 16;
    for (const [fill, ox, oy, rx, ry] of [[dark, 0, 0, cw / 2, ch], [lit, cw * 0.04, ch * 0.45, cw * 0.42, ch * 0.4]]) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(cx + ox, cy + oy, rx, ry, 0, 0, TAU);
      ctx.fill();
    }
  }
}

export function bandedSun(ctx, x, y, r, stops, cuts = 6, gap = 0.5) {
  glow(ctx, x, y, r * 2.4, 'rgba(255,170,90,0.55)', 0.85);
  ctx.save();
  const disc = new Path2D();
  disc.arc(x, y, r, 0, TAU);
  ctx.clip(disc);
  ctx.fillStyle = lin(ctx, 0, y - r, 0, y + r, stops);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < cuts; i++) ctx.fillRect(x - r, y + r * 0.08 + (i / cuts) * r * 0.92, r * 2, (r / cuts) * gap * (0.35 + i / cuts));
  ctx.restore();
}

export function reflections(ctx, x, y, w, h, colors, seed = 5, density = 70) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < density; i++) {
    const yy = y + Math.pow(r(), 1.4) * h;
    const ww = 20 + r() * 140 * (1 - ((yy - y) / h) * 0.4);
    const xx = x + r() * w;
    ctx.globalAlpha = 0.18 + r() * 0.5;
    ctx.fillStyle = colors[(r() * colors.length) | 0];
    ctx.fillRect(xx - ww / 2, yy, ww, 2 + r() * 4);
  }
  ctx.restore();
}

export function windows(ctx, x, y, w, h, cols, rows, lit, dark, seed = 1, chance = 0.42) {
  const r = rng(seed);
  const cw = w / cols;
  const rh = h / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      ctx.fillStyle = r() < chance ? lit[(r() * lit.length) | 0] : dark;
      ctx.fillRect(x + i * cw + cw * 0.22, y + j * rh + rh * 0.24, cw * 0.56, rh * 0.5);
    }
  }
}
