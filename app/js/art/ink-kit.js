// The ink kit: the shared comic-noir primitives every illustration is built from. Shapes are
// Path2D outlines (SVG path data in local units), so one drawing renders crisp at any panel
// size; cel shadows and rim lights are carved from the shape itself with an even-odd offset,
// and halftone screens are one cached dot tile. Nothing here is traced from existing artwork.

export const INK = '#0a0a0d';
export const TAU = Math.PI * 2;

/** Deterministic PRNG (mulberry32): the same seed always paints the same city. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pathCache = new Map();
/** A cached Path2D from SVG path data. */
export function P(d) {
  let p = pathCache.get(d);
  if (!p) pathCache.set(d, (p = new Path2D(d)));
  return p;
}

/** Device pixels per local unit under the current transform, for blur and hairline sizes. */
export const unitScale = (ctx) => {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) || 1;
};

/** A gradient from evenly spaced colours, or [offset, colour] pairs. */
function stopsInto(g, stops) {
  stops.forEach((s, i) => (Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), s)));
  return g;
}
export const lin = (ctx, x0, y0, x1, y1, stops) => stopsInto(ctx.createLinearGradient(x0, y0, x1, y1), stops);
export const rad = (ctx, x, y, r0, r1, stops, fx = x, fy = y) => stopsInto(ctx.createRadialGradient(fx, fy, r0, x, y, r1), stops);

/** Fill a shape and lay a hand-inked keyline over it. */
export function inked(ctx, path, fill, line = 3, ink = INK) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill(path);
  }
  if (line > 0) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = ink;
    ctx.lineWidth = line;
    ctx.stroke(path);
  }
}

/**
 * Carve the part of `path` facing away from (dx, dy) and fill it: with a light colour it is a
 * rim light, with a dark one a cel form shadow. It is the shape minus itself shifted, so the
 * crescent always hugs the silhouette.
 */
export function crescent(ctx, path, dx, dy, fill, alpha = 1, screen = null) {
  const carve = new Path2D();
  carve.rect(-1e5, -1e5, 2e5, 2e5);
  carve.addPath(path, new DOMMatrix().translate(-dx, -dy));
  ctx.save();
  ctx.clip(path);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = fill;
  ctx.fill(carve, 'evenodd');
  if (screen) {
    // a halftone screen confined to the crescent: printed dots only in the shadow plane
    ctx.clip(carve, 'evenodd');
    halftone(ctx, null, screen, 0.55, 0.7);
  }
  ctx.restore();
}

/** Clip to a shape and run a painter inside it. */
export function within(ctx, path, paint) {
  ctx.save();
  ctx.clip(path);
  paint();
  ctx.restore();
}

/** A soft additive glow: neon, headlights, suns. Pure gradient, so it scales with the drawing. */
export function glow(ctx, x, y, r, color, alpha = 1, mode = 'lighter') {
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, color], [0.25, color.replace(/[\d.]+\)$/, '0.45)')], [1, color.replace(/[\d.]+\)$/, '0)')]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** A four-point lens flare with a hot core: headlights, chrome glints and the sun's kiss. */
export function flare(ctx, x, y, r, color = 'rgba(255,240,220,1)', alpha = 1) {
  glow(ctx, x, y, r, color, 0.55 * alpha);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
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
/** One halftone cell per ink colour, cached: the screenprint dot for shadows and skies. */
function halftoneTile(color) {
  let c = dotTiles.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 24;
  const x = c.getContext('2d');
  x.fillStyle = color;
  for (const [cx, cy] of [[6, 6], [18, 18]]) {
    x.beginPath();
    x.arc(cx, cy, 3.6, 0, TAU);
    x.fill();
  }
  dotTiles.set(color, c);
  return c;
}

/** Screen a halftone over a shape (or the current clip): `scale` sets the dot pitch in local units. */
export function halftone(ctx, path, color, alpha = 0.3, scale = 1, angle = 0.4) {
  const pat = ctx.createPattern(halftoneTile(color), 'repeat');
  pat.setTransform(new DOMMatrix().rotate((angle * 180) / Math.PI).scale(scale));
  ctx.save();
  if (path) ctx.clip(path);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = pat;
  ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
  ctx.restore();
}

/** Speed or hatch lines across a box: comic motion and engraved shade. */
export function hatch(ctx, x, y, w, h, gap, angle, color, width = 1.4, seed = 3) {
  const r = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  const len = Math.hypot(w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  for (let t = -len / 2; t < len / 2; t += gap) {
    const a = -len / 2 + r() * len * 0.2;
    const b = len / 2 - r() * len * 0.2;
    ctx.moveTo(a, t);
    ctx.lineTo(b, t);
  }
  ctx.stroke();
  ctx.restore();
}

/** A sky in bands: the posterised dusk gradient every cover sits in. */
export function sky(ctx, w, h, stops, bands = 0) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, h, stops);
  ctx.fillRect(0, 0, w, h);
  if (!bands) return;
  // screenprint banding: faint flat steps that read as inked colour separations
  for (let i = 1; i < bands; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.025 + (i % 2) * 0.02})`;
    ctx.fillRect(0, (h * i) / bands, w, h / bands / 2);
  }
}

/** Streaked cloud bank with lit undersides. */
export function cloudStreaks(ctx, x, y, w, rows, lit, dark, seed = 9) {
  const r = rng(seed);
  for (let i = 0; i < rows; i++) {
    const cx = x + r() * w;
    const cy = y + i * 26 + r() * 18;
    const cw = 160 + r() * 380;
    const ch = 10 + r() * 16;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, ch, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.ellipse(cx + cw * 0.04, cy + ch * 0.45, cw * 0.42, ch * 0.4, 0, 0, TAU);
    ctx.fill();
  }
}

/** A retro banded sun: hard horizontal cuts through a hot disc. */
export function bandedSun(ctx, x, y, r, stops, cuts = 6, gap = 0.5) {
  glow(ctx, x, y, r * 2.4, 'rgba(255,170,90,0.55)', 0.85);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  const disc = new Path2D();
  disc.arc(x, y, r, 0, TAU);
  ctx.clip(disc);
  ctx.fillStyle = lin(ctx, 0, y - r, 0, y + r, stops);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < cuts; i++) {
    const t = i / cuts;
    const by = y + r * 0.08 + t * r * 0.92;
    ctx.fillRect(x - r, by, r * 2, (r / cuts) * gap * (0.35 + t));
  }
  ctx.restore();
}

/** Mirror the lights above a waterline as wobbling streaks. */
export function reflections(ctx, x, y, w, h, colors, seed = 5, density = 70) {
  const r = rng(seed);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < density; i++) {
    const yy = y + Math.pow(r(), 1.4) * h;
    const ww = 20 + r() * 140 * (1 - (yy - y) / h * 0.4);
    const xx = x + r() * w;
    ctx.globalAlpha = 0.18 + r() * 0.5;
    ctx.fillStyle = colors[(r() * colors.length) | 0];
    ctx.fillRect(xx - ww / 2, yy, ww, 2 + r() * 4);
  }
  ctx.restore();
}

/** An even sprinkle of window lights across a facade box. */
export function windows(ctx, x, y, w, h, cols, rows, lit, dark, seed = 1, chance = 0.42) {
  const r = rng(seed);
  const cw = w / cols;
  const rh = h / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const on = r() < chance;
      ctx.fillStyle = on ? lit[(r() * lit.length) | 0] : dark;
      ctx.fillRect(x + i * cw + cw * 0.22, y + j * rh + rh * 0.24, cw * 0.56, rh * 0.5);
    }
  }
}
