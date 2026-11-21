// The v10 paint engine: one framed photo crop becomes hand-painted GTA box art on float planes
// (0..1). The stages, in order: guided-filter planar flattening (noise, pores and sky grain melt,
// edges stay); multi-scale smooth Kuwahara oil paint over eight summed-area regions; a structure-
// tensor flow brush that drags paint along each edge; chroma clean-up, capped clarity and soft cel
// bands; the grade (tone curve, vibrance, gradient map, split tone, sky relight, directional rim
// light); edge-gated two-scale XDoG comic ink, despeckled twice; halftone and luminance-only grain;
// a GPU bloom. Night grades get more flattening, a higher ink bar, less midtone ink, wider chroma
// smoothing and a day-for-night curve, so neon faces stay clean.

import { FX_DEFAULTS, GRADES } from './looks.js';

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const tripletOf = (list) => list.map((v) => v / 255);

// One knob set per panel from the six sliders, the grade and the working resolution. `unit` is
// the short side of the cover in working pixels, so a brush is the same size on every panel.
export function normalizePaintParams(fx = FX_DEFAULTS, grade = GRADES[0], { unit = 1080, quality = 'export' } = {}) {
  const f = { ...FX_DEFAULTS, ...fx };
  const night = !!grade.night;
  const draft = quality === 'draft';
  const paint = clamp(f.paint);
  const ink = clamp(f.ink);
  return {
    night, draft, unit,
    paint, ink,
    bands: clamp(f.bands) * (night ? 0.45 : 1),
    halftone: clamp(f.halftone) * (night ? 0.5 : 1),
    grain: clamp(f.grain) * (night ? 0.5 : 1),
    grade: clamp(f.grade),
    guidedRadius: Math.max(1, Math.round(unit * (night ? 0.0042 : 0.0032))),
    guidedEps: night ? 0.0032 : 0.0018,
    brushSmall: Math.max(2, Math.round(unit * 0.0042 * (0.6 + paint * 0.5))),
    brushLarge: Math.max(3, Math.round(unit * (night ? 0.008 : 0.0105) * (0.5 + paint * 0.7))),
    flowStep: Math.max(0.8, unit * 0.0017),
    chromaRadius: Math.max(1, Math.round(unit * (night ? 0.006 : 0.0035))),
    inkSigma: Math.max(0.7, unit * 0.00105 * (0.85 + ink * 0.35)),
    inkEps: night ? -0.013 : -0.0075,
    inkPhi: night ? 70 : 110,
    inkFine: night ? 0.75 : 0.9,
    preInk: night ? Math.max(1, unit * 0.0016) : 0,
    rimRadius: Math.max(1, Math.round(unit * 0.0035)),
    skyRadius: Math.max(2, Math.round(unit * 0.012)),
    halftoneCell: Math.max(3, unit * 0.0062),
    bloomRadius: Math.max(2, unit * 0.012),
    inkColor: night ? [0.02, 0.012, 0.07] : [0.03, 0.02, 0.035],
  };
}

// The grade as lookup tables: a 1024-step tone curve (exposure, gamma, filmic shoulder), the
// five-stop gradient map, split-tone ends, sky stops and the two rim accents, all 0..1.
export function buildColorGradeLut(grade = GRADES[0], strength = 1) {
  const N = 1024;
  const tone = new Float32Array(N);
  const map = new Float32Array(N * 3);
  const exposure = 1 + ((grade.exposure ?? 1) - 1) * strength;
  const gamma = 1 + ((grade.gamma ?? 1) - 1) * strength;
  const stops = grade.stops.map(rgbOf);
  for (let i = 0; i < N; i++) {
    let v = i / (N - 1);
    // day-for-night: midtones sink toward the navy shadows while the brightest lamps survive
    if (grade.night) v = (v * (1 - strength * 0.6) + Math.pow(v, 2.2) * strength * 0.6) * (1 - strength * 0.2);
    v = Math.pow(v * exposure, 1 / gamma);
    if (v > 0.72) v = 0.72 + 0.27 * Math.tanh((v - 0.72) / 0.27);
    tone[i] = clamp(v);
    const t = (i / (N - 1)) * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(t));
    const f = smooth(0, 1, t - k);
    for (let c = 0; c < 3; c++) map[i * 3 + c] = stops[k][c] + (stops[k + 1][c] - stops[k][c]) * f;
  }
  return {
    size: N, tone, map,
    shadow: tripletOf(grade.shadowTint), high: tripletOf(grade.highlightTint),
    sky: grade.sky.map(rgbOf), accent: rgbOf(grade.accent), accent2: rgbOf(grade.accent2),
    light: grade.light.split(',').map((v) => +v / 255),
  };
}

// Separable running-sum box blur with clamped edges. `out` may be `src`.
function boxBlur(src, w, h, r, out = new Float32Array(src.length), tmp = new Float32Array(src.length)) {
  if (r < 1) {
    if (out !== src) out.set(src);
    return out;
  }
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + (k < 0 ? 0 : k >= w ? w - 1 : k)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * norm;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += tmp[(k < 0 ? 0 : k >= h ? h - 1 : k) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc * norm;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

// Three box passes approximate a Gaussian of the given sigma.
function gauss(src, w, h, sigma, out = new Float32Array(src.length)) {
  const r = Math.max(0, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  const tmp = new Float32Array(src.length);
  boxBlur(src, w, h, r, out, tmp);
  boxBlur(out, w, h, r, out, tmp);
  return boxBlur(out, w, h, r, out, tmp);
}

// A soft mask blur (two box passes, a tent): used for sky, protection and ink antialiasing.
export function blurMask(mask, w, h, r) {
  const tmp = new Float32Array(mask.length);
  const out = boxBlur(mask, w, h, Math.max(0, Math.round(r)), new Float32Array(mask.length), tmp);
  return boxBlur(out, w, h, Math.max(0, Math.round(r)), out, tmp);
}

const lumaOf = (R, G, B) => {
  const L = new Float32Array(R.length);
  for (let i = 0; i < L.length; i++) L[i] = R[i] * 0.299 + G[i] * 0.587 + B[i] * 0.114;
  return L;
};

// Guided filter with luminance as the guide: flat planes where the guide is flat, edges intact.
function guidedFlatten(I, chans, w, h, r, eps) {
  const n = I.length;
  const tmp = new Float32Array(n);
  const mI = boxBlur(I, w, h, r, new Float32Array(n), tmp);
  const varI = new Float32Array(n);
  for (let i = 0; i < n; i++) varI[i] = I[i] * I[i];
  boxBlur(varI, w, h, r, varI, tmp);
  for (let i = 0; i < n; i++) varI[i] -= mI[i] * mI[i];
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  const mp = new Float32Array(n);
  for (const p of chans) {
    boxBlur(p, w, h, r, mp, tmp);
    for (let i = 0; i < n; i++) a[i] = I[i] * p[i];
    boxBlur(a, w, h, r, a, tmp);
    for (let i = 0; i < n; i++) {
      const ai = (a[i] - mI[i] * mp[i]) / (varI[i] + eps);
      a[i] = ai;
      b[i] = mp[i] - ai * mI[i];
    }
    boxBlur(a, w, h, r, a, tmp);
    boxBlur(b, w, h, r, b, tmp);
    for (let i = 0; i < n; i++) p[i] = a[i] * I[i] + b[i];
  }
}

function summedArea(src, w, h) {
  const W = w + 1;
  const s = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += src[y * w + x];
      s[(y + 1) * W + x + 1] = s[y * W + x + 1] + row;
    }
  }
  return s;
}

// Multi-scale smooth Kuwahara. Each pixel looks at four quadrants and the four half discs they
// pair into, at a small and a large brush radius; every region votes with its mean colour,
// weighted by 1 / (floor + variance)^3 so the calmest side of an edge wins without the blocky
// hard switch of the classic filter. Flat areas take the large brush, detail and protected
// faces the small one.
export function applyKuwaharaOilPaint(R, G, B, w, h, { small = 3, large = 8, protect = null, amount = 1 } = {}) {
  const L = lumaOf(R, G, B);
  const LL = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) LL[i] = L[i] * L[i];
  const S = [R, G, B, L, LL].map((p) => summedArea(p, w, h));
  const W = w + 1;
  const out = [new Float32Array(L.length), new Float32Array(L.length), new Float32Array(L.length)];
  const q = new Float64Array(20);
  const counts = new Float64Array(4);
  const floor = 0.00035;
  const PAIRS = [0, -1, 1, -1, 2, -1, 3, -1, 0, 1, 2, 3, 0, 2, 1, 3];
  const quad = (k, x0, y0, x1, y1) => {
    counts[k] = (x1 - x0) * (y1 - y0);
    const a = y0 * W + x0;
    const b = y0 * W + x1;
    const c = y1 * W + x0;
    const d = y1 * W + x1;
    for (let p = 0; p < 5; p++) {
      const s = S[p];
      q[k * 5 + p] = s[d] - s[b] - s[c] + s[a];
    }
  };
  // quadrants 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right, then the four halves
  const scale = (r, x, y, result) => {
    const xa = Math.max(0, x - r);
    const xd = Math.min(w, x + r + 1);
    const ya = Math.max(0, y - r);
    const yd = Math.min(h, y + r + 1);
    quad(0, xa, ya, x + 1, y + 1);
    quad(1, x, ya, xd, y + 1);
    quad(2, xa, y, x + 1, yd);
    quad(3, x, y, xd, yd);
    let wsum = 0;
    let minVar = 1;
    let ar = 0;
    let ag = 0;
    let ab = 0;
    for (let k = 0; k < 8; k++) {
      const j0 = PAIRS[k * 2];
      const j1 = PAIRS[k * 2 + 1];
      let n = counts[j0];
      let sr = q[j0 * 5];
      let sg = q[j0 * 5 + 1];
      let sb = q[j0 * 5 + 2];
      let sl = q[j0 * 5 + 3];
      let sll = q[j0 * 5 + 4];
      if (j1 >= 0) {
        n += counts[j1];
        sr += q[j1 * 5];
        sg += q[j1 * 5 + 1];
        sb += q[j1 * 5 + 2];
        sl += q[j1 * 5 + 3];
        sll += q[j1 * 5 + 4];
      }
      const m = sl / n;
      const v = Math.max(0, sll / n - m * m);
      if (v < minVar) minVar = v;
      const inv = 1 / (floor + v);
      const wk = (inv * inv * inv) / n;
      wsum += wk * n;
      ar += sr * wk;
      ag += sg * wk;
      ab += sb * wk;
    }
    result[0] = ar / wsum;
    result[1] = ag / wsum;
    result[2] = ab / wsum;
    return minVar;
  };
  const fine = [0, 0, 0];
  const broad = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      scale(small, x, y, fine);
      const flatVar = scale(large, x, y, broad);
      const guard = protect ? protect[i] : 0;
      const t = (1 - smooth(0.0006, 0.007, flatVar)) * (1 - guard * 0.9);
      const keep = amount * (1 - guard * 0.45);
      out[0][i] = R[i] + (fine[0] + (broad[0] - fine[0]) * t - R[i]) * keep;
      out[1][i] = G[i] + (fine[1] + (broad[1] - fine[1]) * t - G[i]) * keep;
      out[2][i] = B[i] + (fine[2] + (broad[2] - fine[2]) * t - B[i]) * keep;
    }
  }
  return out;
}

// Structure-tensor flow brush: paint is smeared along the edge tangent where the image has one
// clear direction, which turns Kuwahara planes into strokes that follow the form.
function flowBrush(chans, w, h, step, protect) {
  const L = lumaOf(...chans);
  const n = L.length;
  const E = new Float32Array(n);
  const F = new Float32Array(n);
  const G = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = L[i - w + 1] + 2 * L[i + 1] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - 1] - L[i + w - 1];
      const gy = L[i + w - 1] + 2 * L[i + w] + L[i + w + 1] - L[i - w - 1] - 2 * L[i - w] - L[i - w + 1];
      E[i] = gx * gx;
      F[i] = gx * gy;
      G[i] = gy * gy;
    }
  }
  const r = Math.max(1, Math.round(step * 1.5));
  gauss(E, w, h, r, E);
  gauss(F, w, h, r, F);
  gauss(G, w, h, r, G);
  const src = chans.map((c) => c.slice());
  const sample = (plane, x, y) => {
    const xi = Math.max(0, Math.min(w - 2, Math.floor(x)));
    const yi = Math.max(0, Math.min(h - 2, Math.floor(y)));
    const fx = clamp(x - xi);
    const fy = clamp(y - yi);
    const i = yi * w + xi;
    const top = plane[i] + (plane[i + 1] - plane[i]) * fx;
    const bottom = plane[i + w] + (plane[i + w + 1] - plane[i + w]) * fx;
    return top + (bottom - top) * fy;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const e = E[i];
      const f = F[i];
      const g = G[i];
      const root = Math.sqrt((e - g) * (e - g) + 4 * f * f);
      const l1 = (e + g + root) / 2;
      const l2 = (e + g - root) / 2;
      const sum = l1 + l2;
      if (sum < 1e-6) continue;
      const aniso = (l1 - l2) / sum;
      let tx = l1 - e;
      let ty = -f;
      const len = Math.hypot(tx, ty);
      if (len < 1e-9) {
        tx = 0;
        ty = 1;
      } else {
        tx /= len;
        ty /= len;
      }
      const k = aniso * (protect ? 1 - protect[i] * 0.6 : 1);
      if (k < 0.05) continue;
      for (let c = 0; c < 3; c++) {
        let acc = src[c][i];
        const s = src[c];
        acc += (sample(s, x + tx * step, y + ty * step) + sample(s, x - tx * step, y - ty * step)) * 0.75;
        acc += (sample(s, x + tx * step * 2, y + ty * step * 2) + sample(s, x - tx * step * 2, y - ty * step * 2)) * 0.42;
        chans[c][i] = s[i] + (acc / 3.34 - s[i]) * k;
      }
    }
  }
}

// Colour-difference smoothing, capped clarity and soft cel value bands, all on luminance.
function planarize([R, G, B], w, h, p) {
  const n = R.length;
  const Y = lumaOf(R, G, B);
  const Cb = new Float32Array(n);
  const Cr = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    Cb[i] = B[i] - Y[i];
    Cr[i] = R[i] - Y[i];
  }
  blurMask(Cb, w, h, p.chromaRadius).forEach((v, i) => (Cb[i] = v));
  blurMask(Cr, w, h, p.chromaRadius).forEach((v, i) => (Cr[i] = v));
  const soft = gauss(Y, w, h, Math.max(1, p.unit * 0.003));
  const levels = 5;
  const bandMix = p.bands * 0.62;
  for (let i = 0; i < n; i++) {
    let y = Y[i] + clamp((Y[i] - soft[i]) * 0.45, -0.06, 0.06);
    if (bandMix > 0) {
      const t = clamp(y) * levels;
      const base = Math.min(levels - 1, Math.floor(t));
      const q = (base + smooth(0.32, 0.68, t - base)) / levels;
      y += (q - y) * bandMix;
    }
    const r = y + Cr[i];
    const b = y + Cb[i];
    R[i] = r;
    B[i] = b;
    G[i] = (y - 0.299 * r - 0.114 * b) / 0.587;
  }
}

// Comic ink from painted luminance: two-scale XDoG (fine features, bold silhouettes), binarised,
// despeckled by an 8-neighbour test and a 5 x 5 cluster test, then re-antialiased.
export function computeEdgeMask(L, w, h, p, guard = null) {
  const n = L.length;
  const base = p.preInk ? gauss(L, w, h, p.preInk) : L;
  const ink = new Float32Array(n);
  // ink only where a real edge is: the luminance step across a few pixels, scale-free, with a
  // higher bar inside faces so soft cheek shading never turns into a blot
  const g = gauss(base, w, h, p.inkSigma * 1.2);
  const s = Math.max(1, Math.round(p.inkSigma * 1.5));
  const gate = new Float32Array(n);
  const [lo, hi] = p.night ? [0.032, 0.09] : [0.032, 0.085];
  for (let y = 0; y < h; y++) {
    const yu = Math.max(0, y - s) * w;
    const yd = Math.min(h - 1, y + s) * w;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dx = g[y * w + Math.min(w - 1, x + s)] - g[y * w + Math.max(0, x - s)];
      const dy = g[yd + x] - g[yu + x];
      const k = guard ? 1 + guard[i] * 0.7 : 1;
      gate[i] = smooth(lo * k, hi * k, Math.hypot(dx, dy));
    }
  }
  const xdog = (sigma, eps, weight) => {
    const g1 = gauss(base, w, h, sigma);
    const g2 = gauss(base, w, h, sigma * 1.6);
    for (let i = 0; i < n; i++) {
      const d = g1[i] - 0.985 * g2[i];
      if (d < eps) ink[i] = Math.max(ink[i], Math.tanh(p.inkPhi * (eps - d)) * weight);
    }
  };
  xdog(p.inkSigma, p.inkEps, p.inkFine);
  xdog(p.inkSigma * 1.8, p.inkEps * 1.5, 1);
  for (let i = 0; i < n; i++) {
    let v = ink[i] * gate[i];
    if (p.night) v *= 1 - 0.55 * smooth(0.28, 0.6, base[i]);
    ink[i] = v > 0.5 ? 1 : 0;
  }
  const keep = new Uint8Array(n);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!ink[i]) continue;
      const c = ink[i - w - 1] + ink[i - w] + ink[i - w + 1] + ink[i - 1] + ink[i + 1] + ink[i + w - 1] + ink[i + w] + ink[i + w + 1];
      keep[i] = c >= 2 ? 1 : 0;
    }
  }
  for (let i = 0; i < n; i++) ink[i] = keep[i];
  const cluster = boxBlur(ink, w, h, 2);
  const minCluster = (p.night ? 7 : 5) / 25;
  for (let i = 0; i < n; i++) if (cluster[i] < minCluster) ink[i] = 0;
  const aa = blurMask(ink, w, h, 1);
  for (let i = 0; i < n; i++) aa[i] = smooth(0.12, 0.7, aa[i]);
  return aa;
}

export function applyComicInkEdges([R, G, B], ink, strength, color = [0.03, 0.02, 0.035]) {
  const k = clamp(strength * 1.25);
  for (let i = 0; i < R.length; i++) {
    const a = ink[i] * k;
    if (a <= 0) continue;
    R[i] += (color[0] - R[i]) * a;
    G[i] += (color[1] - G[i]) * a;
    B[i] += (color[2] - B[i]) * a;
  }
}

// Tone, vibrance, gradient map, split tone, sky relight and the directional rim light.
function gradePlanes([R, G, B], w, h, grade, p, guard) {
  const n = R.length;
  const lut = buildColorGradeLut(grade, p.grade);
  const top = lut.size - 1;
  const Y0 = lumaOf(R, G, B);
  const sky = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const fall = 1 - smooth(0.38, 0.72, y / h);
    const high = 1 - smooth(0.12, 0.34, y / h);
    if (fall <= 0) continue;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const mx = Math.max(R[i], G[i], B[i]);
      const sat = mx - Math.min(R[i], G[i], B[i]);
      const blue = smooth(0.03, 0.14, B[i] - R[i]) * smooth(0.3, 0.58, Y0[i]) * smooth(0.06, 0.16, sat);
      // pale haze only near the top of the cut, never skin-warm, never a protected face
      const haze = smooth(0.8, 0.95, Y0[i]) * (1 - smooth(0.06, 0.16, sat)) * (1 - smooth(0.02, 0.08, R[i] - B[i])) * high * 0.7;
      sky[i] = Math.max(blue, haze) * fall * (guard ? 1 - guard[i] : 1);
    }
  }
  const skyMask = blurMask(sky, w, h, p.skyRadius);
  const mapAmt = (grade.map ?? 0.25) * p.grade * (p.night ? 1.55 : 1);
  const skyAmt = (grade.skyMix ?? 0.6) * p.grade;
  const vib = (grade.vibrance ?? 0.3) * p.grade;
  const split = 0.45 * p.grade;
  for (let y = 0; y < h; y++) {
    const yn = y / Math.max(1, h - 1);
    const seg = yn < 0.5 ? 0 : 1;
    const f = smooth(0, 1, yn < 0.5 ? yn * 2 : yn * 2 - 1);
    const sc = [0, 1, 2].map((c) => lut.sky[seg][c] + (lut.sky[seg + 1][c] - lut.sky[seg][c]) * f);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let r = lut.tone[(clamp(R[i]) * top) | 0];
      let g = lut.tone[(clamp(G[i]) * top) | 0];
      let b = lut.tone[(clamp(B[i]) * top) | 0];
      const avg = (r + g + b) / 3;
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      const boost = 1 + vib * (1 - sat) * 1.3;
      r = avg + (r - avg) * boost;
      g = avg + (g - avg) * boost;
      b = avg + (b - avg) * boost;
      const yl = clamp(r * 0.299 + g * 0.587 + b * 0.114);
      const m = ((yl * top) | 0) * 3;
      r += (lut.map[m] - r) * mapAmt;
      g += (lut.map[m + 1] - g) * mapAmt;
      b += (lut.map[m + 2] - b) * mapAmt;
      const ws = (1 - yl) * (1 - yl) * split * 0.5;
      const wh = yl * yl * split * 0.32;
      r += (lut.shadow[0] - r) * ws + (lut.high[0] - r) * wh;
      g += (lut.shadow[1] - g) * ws + (lut.high[1] - g) * wh;
      b += (lut.shadow[2] - b) * ws + (lut.high[2] - b) * wh;
      const s = skyMask[i] * skyAmt;
      if (s > 0.002) {
        const lift = p.night ? 0.42 + 0.5 * yl : 0.6 + 0.5 * yl;
        r += (sc[0] * lift - r) * s;
        g += (sc[1] * lift - g) * s;
        b += (sc[2] * lift - b) * s;
      }
      R[i] = r;
      G[i] = g;
      B[i] = b;
    }
  }
  // rim light: a band-pass of luminance finds the lit side of every form; the gradient direction
  // picks the key accent on one side and the fill accent on the other
  const Y = lumaOf(R, G, B);
  const near = gauss(Y, w, h, p.rimRadius * 1.6);
  const far = gauss(Y, w, h, p.rimRadius * 5);
  const rim = (grade.rim ?? 0.4) * p.grade * (p.night ? 1.25 : 1.2);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = far[i + 1] - far[i - 1];
      const gy = far[i + w] - far[i - w];
      const mag = Math.hypot(gx, gy);
      const a = smooth(0.005, 0.045, near[i] - far[i]) * smooth(0.002, 0.014, mag) * rim;
      if (a < 0.004) continue;
      const side = clamp(0.5 + (0.5 * (gx - gy * 0.35)) / (mag + 1e-6));
      const cr = lut.accent2[0] + (lut.accent[0] - lut.accent2[0]) * side;
      const cg = lut.accent2[1] + (lut.accent[1] - lut.accent2[1]) * side;
      const cb = lut.accent2[2] + (lut.accent[2] - lut.accent2[2]) * side;
      R[i] = 1 - (1 - R[i]) * (1 - cr * a);
      G[i] = 1 - (1 - G[i]) * (1 - cg * a);
      B[i] = 1 - (1 - B[i]) * (1 - cb * a);
    }
  }
}

const hash = (x, y, seed) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

// Print finish: a 45-degree dot screen only in the deep shadows (kept off protected faces) and a
// luminance-only paper grain with a slow fibre wave, so no chromatic noise is added.
export function applyHalftoneAndGrain([R, G, B], w, h, { halftone = 0.25, grain = 0.3, cell = 6, seed = 1, protect = null } = {}) {
  const inv = 1 / (cell * Math.SQRT2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let r = R[i];
      let g = G[i];
      let b = B[i];
      if (halftone > 0) {
        const yl = r * 0.299 + g * 0.587 + b * 0.114;
        const dark = smooth(0.4, 0.06, yl) * (protect ? 1 - protect[i] * 0.8 : 1);
        if (dark > 0.01) {
          const u = (x + y) * inv;
          const v = (x - y) * inv;
          const du = u - Math.round(u);
          const dv = v - Math.round(v);
          const d = Math.sqrt(du * du + dv * dv);
          const dot = smooth(dark * 0.5 + 0.06, dark * 0.5 - 0.06, d);
          const k = 1 - dot * halftone * 0.5;
          r *= k;
          g *= k;
          b *= k;
        }
      }
      if (grain > 0) {
        const fibre = Math.sin(x * 0.045 + Math.sin(y * 0.021 + seed) * 2.4) * 0.5;
        const n = ((hash(x, y, seed) - 0.5) * 0.7 + fibre * 0.3) * grain * 0.075;
        r += n;
        g += n;
        b += n;
      }
      R[i] = r;
      G[i] = g;
      B[i] = b;
    }
  }
}

// Feathered ellipses over the faces (in canvas pixels) keep the brush small and the ink fine.
function protectMask(rects, w, h) {
  if (!rects?.length) return null;
  const mask = new Float32Array(w * h);
  for (const r of rects) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const rx = Math.max(2, r.w * 0.62);
    const ry = Math.max(2, r.h * 0.66);
    const x0 = Math.max(0, Math.floor(cx - rx * 1.3));
    const x1 = Math.min(w, Math.ceil(cx + rx * 1.3));
    const y0 = Math.max(0, Math.floor(cy - ry * 1.3));
    const y1 = Math.min(h, Math.ceil(cy + ry * 1.3));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
        const v = smooth(1.3, 0.85, d);
        const i = y * w + x;
        if (v > mask[i]) mask[i] = v;
      }
    }
  }
  return mask;
}

// Paints one panel canvas in place: { grade, fx, quality, unit, protect: [{x, y, w, h}], seed }.
export function stylizePanelCanvas(canvas, { grade = GRADES[0], fx = FX_DEFAULTS, quality = 'export', unit, protect = [], seed = 1 } = {}) {
  const { width: w, height: h } = canvas;
  if (w < 4 || h < 4) return canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;
  const n = w * h;
  const p = normalizePaintParams(fx, grade, { unit: unit ?? Math.min(w, h), quality });
  let chans = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    chans[0][i] = px[i * 4] / 255;
    chans[1][i] = px[i * 4 + 1] / 255;
    chans[2][i] = px[i * 4 + 2] / 255;
  }
  const guard = protectMask(protect, w, h);
  guidedFlatten(lumaOf(...chans), chans, w, h, p.guidedRadius, p.guidedEps * (0.4 + p.paint));
  if (p.paint > 0.01) chans = applyKuwaharaOilPaint(...chans, w, h, { small: p.brushSmall, large: p.brushLarge, protect: guard, amount: clamp(p.paint * 1.2) });
  if (!p.draft && p.paint > 0.05) flowBrush(chans, w, h, p.flowStep, guard);
  planarize(chans, w, h, p);
  const ink = p.ink > 0.01 ? computeEdgeMask(lumaOf(...chans), w, h, p, guard) : null;
  gradePlanes(chans, w, h, grade, p, guard);
  if (ink) applyComicInkEdges(chans, ink, p.ink, p.inkColor);
  applyHalftoneAndGrain(chans, w, h, { halftone: p.halftone, grain: p.grain, cell: p.halftoneCell, seed, protect: guard });
  for (let i = 0; i < n; i++) {
    px[i * 4] = chans[0][i] * 255;
    px[i * 4 + 1] = chans[1][i] * 255;
    px[i * 4 + 2] = chans[2][i] * 255;
    px[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const bloom = (grade.bloom ?? 0.3) * p.grade;
  if (bloom > 0.02 && typeof ctx.filter === 'string') {
    const copy = Object.assign(document.createElement('canvas'), { width: w, height: h });
    const c2 = copy.getContext('2d');
    c2.filter = `brightness(0.7) contrast(2.6) blur(${p.bloomRadius.toFixed(1)}px)`;
    c2.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = clamp(bloom * 0.4);
    ctx.drawImage(copy, 0, 0);
    ctx.restore();
  }
  return canvas;
}
