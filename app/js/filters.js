// The paint engine: turns one framed photo crop into an illustrated GTA-style cover panel, in place,
// on plain Canvas 2D ImageData. One stylizePanelCanvas pass runs, in order:
//   1. sky relight     blue or washed-out skies take the grade's three-stop sunset or neon sky
//   2. oil paint       8-sector anisotropic Kuwahara: an elliptical brush window that follows the
//                      local edge direction (structure tensor), the flattest sectors winning
//   3. comic ink       multi-scale XDoG contours on the painted luminance, despeckled
//   4. colour          exposure, filmic shoulder, vibrance, smooth cel value bands, gradient map,
//                      split tone, night midtone curve, dual-tone rim light, bloom, clarity
//   5. print finish    45-degree halftone dot screen in the shadows and warm lithograph paper grain
// Every radius scales with the cover's short side, so the 0.34x draft, the half-size preview and
// the full-size export paint the same picture at their own sharpness.

import { FX_DEFAULTS, GRADES } from './looks.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const hexRgb = (hex) => {
  const n = parseInt(String(hex).replace('#', ''), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const unitRgb = (rgb) => rgb.map((v) => v / 255);
const lightRgb = (text, fallback = [255, 200, 140]) => {
  const parts = String(text ?? '').split(',').map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? parts : fallback;
};

// Clamps every ink-and-paint weight to 0..1, filling gaps from the house recipe.
export function normalizePaintParams(fx = FX_DEFAULTS) {
  const out = {};
  for (const key of Object.keys(FX_DEFAULTS)) {
    const v = Number(fx?.[key]);
    out[key] = Number.isFinite(v) ? clamp01(v) : FX_DEFAULTS[key];
  }
  return out;
}

const lutCache = new Map();

// A 256-entry RGB gradient map through the grade's stops, shadow to light, smooth between stops.
export function buildColorGradeLut(stops) {
  const list = stops?.length ? stops : GRADES[0].stops;
  const key = list.join('|');
  if (lutCache.has(key)) return lutCache.get(key);
  const rgb = list.map(hexRgb);
  const lut = new Uint8ClampedArray(256 * 3);
  const span = rgb.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * span;
    const k = Math.min(span - 1, Math.floor(t));
    const f = smooth(0, 1, t - k);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = rgb[k][c] + (rgb[k + 1][c] - rgb[k][c]) * f;
  }
  lutCache.set(key, lut);
  return lut;
}

// Separable box blur of a float plane, in place; three passes approach a Gaussian.
export function blurMask(mask, w, h, radius, passes = 1) {
  const r = Math.max(0, Math.round(radius));
  if (!r || w < 2 || h < 2) return mask;
  const line = new Float32Array(Math.max(w, h));
  const inv = 1 / (2 * r + 1);
  const run = (start, step, n) => {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += mask[start + clamp(k, 0, n - 1) * step];
    for (let i = 0; i < n; i++) {
      line[i] = acc * inv;
      acc += mask[start + Math.min(n - 1, i + r + 1) * step] - mask[start + Math.max(0, i - r) * step];
    }
    for (let i = 0; i < n; i++) mask[start + i * step] = line[i];
  };
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) run(y * w, 1, w);
    for (let x = 0; x < w; x++) run(x, w, h);
  }
  return mask;
}

function lumaPlane(data, w, h) {
  const n = w * h;
  const out = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) out[i] = (data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114) / 255;
  return out;
}

// XDoG ink: two differences of Gaussians (fine g1-g2, coarse g2-g3) mark the dark side of every
// edge; a soft tanh threshold turns them into confident ink, the stronger scale winning.
export function computeEdgeMask(g1, g2, g3, ink) {
  const k = clamp01(ink);
  const n = g1.length;
  const out = new Float32Array(n);
  if (k < 0.01) return out;
  const eps1 = 0.02 - 0.013 * k;
  const eps2 = eps1 * 1.5;
  const phi = 42 + 60 * k;
  const gain = 0.6 + 0.4 * k;
  for (let i = 0; i < n; i++) {
    const fine = g2[i] - g1[i] - eps1;
    const coarse = g3[i] - g2[i] - eps2;
    const a = fine > 0 ? Math.tanh(phi * fine) : 0;
    const b = coarse > 0 ? Math.tanh(phi * 0.7 * coarse) * 0.85 : 0;
    out[i] = (a > b ? a : b) * gain;
  }
  return out;
}

// The finished ink layer: the XDoG mask, isolated specks dropped, pinholes in strokes closed, the
// lines thickened a touch at export scale and antialiased.
export function applyComicInkEdges(g1, g2, g3, w, h, s, ink) {
  const raw = computeEdgeMask(g1, g2, g3, ink);
  const out = new Float32Array(raw.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      let on = 0;
      let peak = 0;
      for (let dy = -w; dy <= w; dy += w) {
        for (let dx = -1; dx <= 1; dx++) {
          const v = raw[i + dy + dx];
          if (dx === 0 && dy === 0) continue;
          if (v > 0.3) on++;
          if (v > peak) peak = v;
        }
      }
      const v = raw[i];
      if (v > 0.3) out[i] = on < 2 ? 0 : on < 3 ? v * 0.55 : v;
      else out[i] = on >= 6 ? peak * 0.8 : v * 0.6;
    }
  }
  if (s > 0.85) {
    const thick = out.slice();
    for (let i = w; i < out.length - w; i++) {
      const m = Math.max(out[i - 1], out[i + 1], out[i - w], out[i + w]) * 0.62;
      if (m > thick[i]) thick[i] = m;
    }
    out.set(thick);
  }
  if (s > 0.6) blurMask(out, w, h, 1, 1);
  return out;
}

// Kuwahara kernels: one isotropic disc and four ellipses along 0, 45, 90 and 135 degrees. Every
// sample carries a Gaussian weight split between its two nearest of eight angular sectors.
const kernelCache = new Map();

function sectorKernel(radius, angle, ecc, w) {
  const key = `${radius}|${angle.toFixed(3)}|${ecc}|${w}`;
  if (kernelCache.has(key)) return kernelCache.get(key);
  const a = radius * ecc;
  const b = radius / ecc;
  const R = Math.ceil(Math.max(a, b));
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const rows = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (!dx && !dy) continue;
      const u = (dx * ca + dy * sa) / a;
      const v = (-dx * sa + dy * ca) / b;
      const rr = u * u + v * v;
      if (rr > 1) continue;
      const g = Math.exp(-rr * 2);
      const p = ((Math.atan2(v, u) / (Math.PI * 2)) * 8 + 8) % 8;
      const s0 = Math.floor(p) % 8;
      const f = p - Math.floor(p);
      rows.push([dx, dy, s0, g * (1 - f), (s0 + 1) % 8, g * f]);
    }
  }
  const n = rows.length;
  const kernel = { R, n, dx: new Int16Array(n), dy: new Int16Array(n), off: new Int32Array(n), s0: new Uint8Array(n), w0: new Float32Array(n), s1: new Uint8Array(n), w1: new Float32Array(n) };
  rows.forEach(([dx, dy, s0, w0, s1, w1], j) => {
    kernel.dx[j] = dx;
    kernel.dy[j] = dy;
    kernel.off[j] = (dy * w + dx) * 4;
    kernel.s0[j] = s0;
    kernel.w0[j] = w0;
    kernel.s1[j] = s1;
    kernel.w1[j] = w1;
  });
  if (kernelCache.size > 64) kernelCache.clear();
  kernelCache.set(key, kernel);
  return kernel;
}

// Structure tensor of the luminance (Sobel, smoothed): picks for every pixel the kernel whose long
// axis follows the edge, or the round one where the photo has no direction.
function orientationBins(lum, w, h, s) {
  const n = w * h;
  const E = new Float32Array(n);
  const F = new Float32Array(n);
  const G = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1];
      const gy = lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1] - lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1];
      E[i] = gx * gx;
      F[i] = gx * gy;
      G[i] = gy * gy;
    }
  }
  const r = Math.max(1, Math.round(2 * s));
  blurMask(E, w, h, r, 2);
  blurMask(F, w, h, r, 2);
  blurMask(G, w, h, r, 2);
  const bins = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const tr = E[i] + G[i];
    if (tr < 2e-4) continue;
    const d = E[i] - G[i];
    const aniso = Math.sqrt(d * d + 4 * F[i] * F[i]) / tr;
    if (aniso < 0.32) continue;
    const along = 0.5 * Math.atan2(2 * F[i], d) + Math.PI / 2;
    bins[i] = 1 + (((Math.round(along / (Math.PI / 4)) % 4) + 4) % 4);
  }
  return bins;
}

// 8-sector anisotropic Kuwahara oil paint, in place on RGBA data. unit is the cover's short side
// in these pixels, paint the brush amount, s an optional scale override (unit / 1080 by default).
export function applyKuwaharaOilPaint(data, w, h, unit, paint, s = clamp(unit / 1080, 0.25, 1.6)) {
  const amt = clamp01(paint);
  if (amt < 0.02 || w < 6 || h < 6) return data;
  const radius = clamp(Math.round((1.2 + 3.3 * amt) * s), 1, 5);
  const src = new Uint8ClampedArray(data);
  const bins = orientationBins(lumaPlane(src, w, h), w, h, s);
  const kernels = [sectorKernel(radius, 0, 1, w), ...[0, 1, 2, 3].map((k) => sectorKernel(radius, (k * Math.PI) / 4, 1.5, w))];
  const acc = new Float64Array(40);
  const mean = new Float64Array(24);
  const vars = new Float64Array(8);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      const K = kernels[bins[i]];
      const inside = x >= K.R && x < w - K.R && y >= K.R && y < h - K.R;
      const cr = src[p];
      const cg = src[p + 1];
      const cb = src[p + 2];
      const cl = (cr + 2 * cg + cb) * 0.25;
      for (let k = 0; k < 8; k++) {
        const b = k * 5;
        acc[b] = 1;
        acc[b + 1] = cr;
        acc[b + 2] = cg;
        acc[b + 3] = cb;
        acc[b + 4] = cl * cl;
      }
      for (let j = 0; j < K.n; j++) {
        const o = inside ? p + K.off[j] : (clamp(y + K.dy[j], 0, h - 1) * w + clamp(x + K.dx[j], 0, w - 1)) * 4;
        const r = src[o];
        const g = src[o + 1];
        const bl = src[o + 2];
        const l = (r + 2 * g + bl) * 0.25;
        const ll = l * l;
        let b = K.s0[j] * 5;
        let wt = K.w0[j];
        acc[b] += wt;
        acc[b + 1] += wt * r;
        acc[b + 2] += wt * g;
        acc[b + 3] += wt * bl;
        acc[b + 4] += wt * ll;
        b = K.s1[j] * 5;
        wt = K.w1[j];
        acc[b] += wt;
        acc[b + 1] += wt * r;
        acc[b + 2] += wt * g;
        acc[b + 3] += wt * bl;
        acc[b + 4] += wt * ll;
      }
      let least = Infinity;
      for (let k = 0; k < 8; k++) {
        const b = k * 5;
        const iw = 1 / acc[b];
        const mr = acc[b + 1] * iw;
        const mg = acc[b + 2] * iw;
        const mb = acc[b + 3] * iw;
        const ml = (mr + 2 * mg + mb) * 0.25;
        const v = Math.max(0, acc[b + 4] * iw - ml * ml);
        mean[k * 3] = mr;
        mean[k * 3 + 1] = mg;
        mean[k * 3 + 2] = mb;
        vars[k] = v;
        if (v < least) least = v;
      }
      let sw = 0;
      let or = 0;
      let og = 0;
      let ob = 0;
      for (let k = 0; k < 8; k++) {
        const ratio = (vars[k] + 4) / (least + 4);
        const r2 = ratio * ratio;
        const wk = 1 / (1 + r2 * r2);
        sw += wk;
        or += wk * mean[k * 3];
        og += wk * mean[k * 3 + 1];
        ob += wk * mean[k * 3 + 2];
      }
      data[p] = or / sw;
      data[p + 1] = og / sw;
      data[p + 2] = ob / sw;
    }
  }
  return data;
}

// Sky relight: blue or blown-out low-texture areas in the upper part of the crop take the
// grade's sky gradient, keeping their own light and dark so clouds and palms survive.
function relightSky(data, w, h, grade, amount) {
  const mix = (grade.skyMix ?? 0.6) * amount;
  if (mix < 0.02 || !grade.sky?.length) return;
  const n = w * h;
  const mask = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const high = 1 - smooth(0.3, 0.78, y / h);
    if (high <= 0) continue;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const p = i * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const mx = Math.max(r, g, b);
      const sat = (mx - Math.min(r, g, b)) / 255;
      const blue = smooth(0.03, 0.2, (b - r) / 255) * smooth(-0.1, 0.04, (b - g * 0.92) / 255);
      const washed = smooth(0.66, 0.9, mx / 255) * (1 - smooth(0.06, 0.22, sat));
      mask[i] = Math.max(blue, washed) * high;
    }
  }
  blurMask(mask, w, h, Math.max(2, Math.round(Math.min(w, h) * 0.025)), 2);
  const sky = grade.sky.map(hexRgb);
  for (let y = 0; y < h; y++) {
    const t = clamp01((y / h) * 1.35) * (sky.length - 1);
    const k = Math.min(sky.length - 2, Math.floor(t));
    const f = smooth(0, 1, t - k);
    const sr = sky[k][0] + (sky[k + 1][0] - sky[k][0]) * f;
    const sg = sky[k][1] + (sky[k + 1][1] - sky[k][1]) * f;
    const sb = sky[k][2] + (sky[k + 1][2] - sky[k][2]) * f;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const m = mask[i] * mix;
      if (m < 0.01) continue;
      const p = i * 4;
      const detail = 0.62 + 0.62 * ((data[p] * 0.3 + data[p + 1] * 0.59 + data[p + 2] * 0.11) / 255);
      data[p] += (sr * detail - data[p]) * m;
      data[p + 1] += (sg * detail - data[p + 1]) * m;
      data[p + 2] += (sb * detail - data[p + 2]) * m;
    }
  }
}

const R2 = Math.SQRT1_2;

// Print finish for one pixel. px is an [r, g, b] scratch triple in 0..1, changed in place; l its
// luminance; dot the screen pitch in pixels. The halftone is a 45-degree round-dot screen that
// only prints in the shadows and lower mids; the grain is hashed film tooth plus warm paper.
export function applyHalftoneAndGrain(px, x, y, l, dot, halftone, grain, seed) {
  if (halftone > 0.01) {
    const shade = 1 - smooth(0.14, 0.6, l);
    if (shade > 0.01) {
      const u = ((x + y) * R2) / dot;
      const v = ((x - y) * R2) / dot;
      const fu = u - Math.floor(u) - 0.5;
      const fv = v - Math.floor(v) - 0.5;
      const d = Math.sqrt(fu * fu + fv * fv);
      const rad = 0.6 * Math.sqrt(shade);
      const aa = 0.9 / dot;
      const ink = (1 - smooth(rad - aa, rad + aa, d)) * shade * halftone * 0.5;
      px[0] *= 1 - ink;
      px[1] *= 1 - ink;
      px[2] *= 1 - ink * 0.85;
    }
  }
  if (grain > 0.01) {
    let hsh = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed + 1, 1442695041);
    hsh = Math.imul(hsh ^ (hsh >>> 13), 1274126177);
    const noise = (((hsh ^ (hsh >>> 16)) & 1023) / 1023 - 0.5) * grain * (0.05 + 0.06 * (1 - Math.abs(l - 0.5) * 2));
    const paper = grain * 0.035 * l;
    px[0] += noise + paper * 0.6;
    px[1] += noise + paper * 0.25;
    px[2] += noise - paper * 0.5;
  }
  return px;
}

// One panel through the whole engine, in place. unit is the cover's short side in this
// texture's pixels; light scales rim and bloom (1 is the house strength).
export function stylizePanelCanvas(imageData, { grade = GRADES[0], fx = FX_DEFAULTS, seed = 7, light = 1, unit: coverUnit } = {}) {
  const { data, width: w, height: h } = imageData;
  if (w < 4 || h < 4) return imageData;
  const p = normalizePaintParams(fx);
  const unit = coverUnit ?? Math.min(w, h) * 2;
  const s = clamp(unit / 1080, 0.25, 2);
  const amt = p.grade;
  const n = w * h;

  relightSky(data, w, h, grade, amt);
  applyKuwaharaOilPaint(data, w, h, unit, p.paint, clamp(s, 0.25, 1.6));

  const L = lumaPlane(data, w, h);
  const g1 = s > 0.7 ? blurMask(L.slice(), w, h, 1, 1) : L;
  const g2 = blurMask(L.slice(), w, h, Math.max(1, Math.round(1.4 * s)), 2);
  const g3 = blurMask(g2.slice(), w, h, Math.max(1, Math.round(2.6 * s)), 2);
  const ink = applyComicInkEdges(g1, g2, g3, w, h, s, p.ink);
  const bloom = new Float32Array(n);
  for (let i = 0; i < n; i++) bloom[i] = smooth(0.66, 0.97, g2[i]);
  blurMask(bloom, w, h, Math.round(7 * s) + 1, 3);

  const lut = buildColorGradeLut(grade.stops);
  const shadowTint = unitRgb(grade.shadowTint ?? [40, 20, 70]);
  const highTint = unitRgb(grade.highlightTint ?? [255, 220, 170]);
  const glow = unitRgb(lightRgb(grade.light));
  const rimA = unitRgb(hexRgb(grade.accent2 ?? '#ffb347'));
  const rimB = unitRgb(hexRgb(grade.accent ?? '#ff2f87'));
  const inkRgb = [0.03 + shadowTint[0] * 0.08, 0.02 + shadowTint[1] * 0.06, 0.05 + shadowTint[2] * 0.1];
  const exposure = 1 + ((grade.exposure ?? 1.05) - 1) * amt;
  const invGamma = 1 / (1 + ((grade.gamma ?? 1.05) - 1) * amt);
  const tone = new Float32Array(256);
  for (let v = 0; v < 256; v++) tone[v] = ((v / 255) * exposure) ** invGamma;
  const vib = (grade.vibrance ?? 0.3) * amt;
  const mapAmt = (grade.map ?? 0.25) * amt;
  const rimAmt = (grade.rim ?? 0.4) * amt * light;
  const bloomAmt = (grade.bloom ?? 0.3) * amt * light;
  const night = !!grade.night;
  const levels = 9 - 5 * p.bands;
  const edge = 0.5 - 0.42 * p.bands;
  const rimStep = Math.max(1, Math.round(2.5 * s));
  const dot = Math.max(3, 4.6 * s);
  const clarity = 0.35 + 0.4 * p.paint;
  const px = new Float32Array(3);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const o = i * 4;
      let r = tone[data[o]];
      let g = tone[data[o + 1]];
      let b = tone[data[o + 2]];
      const detail = (L[i] - g3[i]) * clarity;
      r += detail;
      g += detail;
      b += detail;
      if (r > 0.82) r = 0.82 + (r - 0.82) / (1 + (r - 0.82) * 3);
      if (g > 0.82) g = 0.82 + (g - 0.82) / (1 + (g - 0.82) * 3);
      if (b > 0.82) b = 0.82 + (b - 0.82) / (1 + (b - 0.82) * 3);
      let l = r * 0.299 + g * 0.587 + b * 0.114;
      const mx = Math.max(r, g, b);
      const sat = mx - Math.min(r, g, b);
      const boost = 1 + vib * 1.5 * (1 - clamp01(sat * 1.6));
      r = l + (r - l) * boost;
      g = l + (g - l) * boost;
      b = l + (b - l) * boost;
      if (p.bands > 0.01) {
        const v = clamp01(l) * levels;
        const base = Math.floor(v);
        const lq = (base + smooth(edge, 1 - edge, v - base)) / levels;
        const ratio = 1 + ((lq + 0.03) / (l + 0.03) - 1) * p.bands;
        r *= ratio;
        g *= ratio;
        b *= ratio;
        l *= ratio;
      }
      const li = clamp(Math.round(l * 255), 0, 255) * 3;
      r += (lut[li] / 255 - r) * mapAmt;
      g += (lut[li + 1] / 255 - g) * mapAmt;
      b += (lut[li + 2] / 255 - b) * mapAmt;
      const lo = (1 - clamp01(l)) ** 2 * 0.3 * amt;
      const hi = clamp01(l) ** 2 * 0.22 * amt;
      r += (shadowTint[0] - r) * lo + (highTint[0] - r) * hi;
      g += (shadowTint[1] - g) * lo + (highTint[1] - g) * hi;
      b += (shadowTint[2] - b) * lo + (highTint[2] - b) * hi;
      if (night) {
        const keep = 0.5 + 0.5 * smooth(0.08, 0.72, l);
        r *= keep;
        g *= keep;
        b *= keep * 1.04;
      }
      if (rimAmt > 0.01 && x >= rimStep) {
        const grad = (g2[i] - g2[i - rimStep]) * 7;
        const up = clamp01(grad) * rimAmt;
        const down = night ? clamp01(-grad) * rimAmt : 0;
        r += rimA[0] * up + rimB[0] * down;
        g += rimA[1] * up + rimB[1] * down;
        b += rimA[2] * up + rimB[2] * down;
      }
      const bl = bloom[i] * bloomAmt;
      if (bl > 0.002) {
        r = 1 - (1 - clamp01(r)) * (1 - glow[0] * bl);
        g = 1 - (1 - clamp01(g)) * (1 - glow[1] * bl);
        b = 1 - (1 - clamp01(b)) * (1 - glow[2] * bl);
      }
      const e = ink[i];
      if (e > 0.004) {
        r += (inkRgb[0] - r) * e;
        g += (inkRgb[1] - g) * e;
        b += (inkRgb[2] - b) * e;
      }
      px[0] = r;
      px[1] = g;
      px[2] = b;
      applyHalftoneAndGrain(px, x, y, clamp01(l), dot, p.halftone, p.grain, seed);
      data[o] = px[0] * 255;
      data[o + 1] = px[1] * 255;
      data[o + 2] = px[2] * 255;
    }
  }
  return imageData;
}
