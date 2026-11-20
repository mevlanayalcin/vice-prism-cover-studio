// The photo-to-GTA paint engine, plain Canvas 2D pixel work on one panel crop at a time:
//   1. bilateral denoise, a variance-weighted Kuwahara oil paint (two brush sizes) and an
//      unsharp pass that turns the soft brush edges back into crisp painted ones,
//   2. XDoG cel ink on the painted light: fine contours plus bold silhouettes, speckle-free,
//      thresholded into pen-crisp lines, with the deepest shadows spotted in flat ink,
//   3. hard-edged poster bands and an S-curve for flat comic value planes,
//   4. the grade: blue skies and sea relit with the grade's sunset or night sky by height,
//      a gradient map, split tone, key light and a rim on the bright side of every contour,
//      and at night a cyan sign-light fill opposite the magenta key,
//   5. bloom, deep violet ink, a halftone screen in the shadows and 35 mm grain.
// Skin is found per pixel and kept warm and natural through steps 3 and 4.
// `unit` is the short side of the whole cover at this render scale, so brush and line sizes
// match between the live preview and the full-size export.

import { FX_DEFAULTS, GRADES } from './looks.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const rgbOf = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const lumaOf = (c) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
const isSkin = (r, g, b) => {
  const l = r * 0.299 + g * 0.587 + b * 0.114;
  return l > 46 && l < 236 && r > 78 && r - g >= 12 && r - g <= 112 && r - b >= 22 && g >= b * 0.82 && r > b;
};
const tintMul = (c) => {
  const v = c.map((x) => x / 255);
  const l = Math.max(0.05, lumaOf(v));
  return v.map((x) => x / l);
};

// Paint sliders arrive from the UI as 0-100 values divided by 100; clamp every one so a
// half-written state or a hand-set __vp.fx value can never push the engine out of range.
export function normalizePaintOptions(fx = FX_DEFAULTS) {
  return {
    paint: clamp01(fx.paint ?? FX_DEFAULTS.paint),
    ink: clamp01(fx.ink ?? FX_DEFAULTS.ink),
    bands: clamp01(fx.bands ?? 0.5),
    amt: clamp01(fx.grade ?? FX_DEFAULTS.grade),
    halftone: clamp01(fx.halftone ?? 0),
    grain: clamp01(fx.grain ?? 0),
  };
}

// A grade's tone curve is its stop table read as a LUT: `at(t)` walks the control points and
// interpolates in the same linear space the renderer always used, so defaults stay byte-exact.
export function buildToneCurveLut(stops) {
  const palette = stops.map(rgbOf);
  const last = palette.length - 1;
  const at = (t) => {
    const x = clamp01(t) * last;
    const k = Math.min(last - 1, Math.floor(x));
    const f = x - k;
    const a = palette[k];
    const b = palette[k + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };
  return { palette, at };
}

// XDoG edge pass: fine contours draw features, the wide scale the bold silhouettes, and the
// bright side of the same edges carries the rim light. Pure mask work, no pixel writes.
export function computeEdgeMask(g1, g2, g3, ink) {
  const n = g1.length;
  const lines = new Float32Array(n);
  const rimMask = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const fine = (g2[p] - g1[p]) / (0.06 + g2[p]);
    const bold = (g3[p] - g1[p]) / (0.06 + g3[p]);
    lines[p] = Math.max(smooth(0.028, 0.075, fine), smooth(0.11, 0.28, bold) * 0.85) * ink;
    rimMask[p] = smooth(0.04, 0.2, (g1[p] - g3[p]) / (0.1 + g3[p]));
  }
  return { lines, rimMask };
}

export function paintPanel(imageData, { grade = GRADES[0], fx = FX_DEFAULTS, seed = 7, light = 1, unit: coverUnit } = {}) {
  const { data, width: w, height: h } = imageData;
  if (!w || !h) return imageData;
  const n = w * h;
  const unit = coverUnit || Math.min(w, h) * 1.6;
  const { paint, ink, bands, amt, halftone, grain } = normalizePaintOptions(fx);

  // Ink is traced on the denoised photo, before the paint, so contours follow the real shapes
  // and never the edges of brush blocks.
  bilateral(data, w, h, 2, 14 + paint * 10, 1.6);
  bilateral(data, w, h, 2, 12 + paint * 8, 1.6);
  const luma = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) luma[p] = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
  const s = Math.max(1, Math.round(unit * 0.0014));
  const g1 = blurMask(Float32Array.from(luma), w, h, s, 2);
  const g2 = blurMask(Float32Array.from(luma), w, h, Math.round(s * 1.6) + 1, 2);
  const g3 = blurMask(Float32Array.from(luma), w, h, s * 3 + 1, 2);

  if (paint > 0.04) {
    const r = Math.max(1, Math.round(0.6 + unit * 0.0019 * paint));
    kuwahara(data, w, h, r);
    kuwahara(data, w, h, Math.max(1, r - 1));
    bilateral(data, w, h, 3, 11, 2.2);
    // the brush leaves soft edges: an unsharp pass turns them back into crisp painted ones
    unsharp(data, w, h, Math.max(1, Math.round(s * 1.5)), 0.9 * paint);
  }

  const skin = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    luma[p] = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
    skin[p] = isSkin(data[i], data[i + 1], data[i + 2]) ? 1 : 0;
  }
  blurMask(skin, w, h, Math.max(1, Math.round(unit * 0.004)), 2);

  // XDoG: a pixel darker than its neighbourhood, relative to that neighbourhood's light, is ink.
  // The mask helper keeps the fine and wide scales side by side with their rim light.
  const { lines, rimMask } = computeEdgeMask(g1, g2, g3, ink);
  blurMask(rimMask, w, h, Math.max(1, s), 1);
  // speckle filter: where ink would cover much of a neighbourhood (spray, foliage, fabric
  // print) it is texture, not contour, so it fades and only clean outlines stay
  // and an isolated dot (a ripple, a pore) is no contour either: a line keeps enough of its
  // small neighbourhood inked, a speck does not
  const density = blurMask(Float32Array.from(lines), w, h, s * 4 + 2, 1);
  const near = blurMask(Float32Array.from(lines), w, h, s * 2, 1);
  const k = 1 / Math.max(0.05, ink);
  for (let p = 0; p < n; p++) lines[p] *= smooth(0.07, 0.18, near[p] * k) * (1 - smooth(0.18, 0.4, density[p] * k));

  const glow = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    // bloom comes from lamps, sun and chrome, not from a whole bright sky
    const sky = clamp01((data[i + 2] - data[i]) / 60);
    glow[p] = luma[p] > 0.72 ? Math.min(1, (luma[p] - 0.72) / 0.28) * (1 - sky * 0.8) : 0;
  }
  blurMask(glow, w, h, Math.max(2, Math.round(unit * 0.018)), 2);

  const palAt = buildToneCurveLut(grade.stops).at;
  const skyAt = buildToneCurveLut(grade.sky).at;
  const shadowMul = tintMul(grade.shadowTint);
  const highMul = tintMul(grade.highlightTint);
  const warm = rgbOf(grade.accent2);
  const cool = rgbOf(grade.accent);
  const inkCol = palAt(0).map((c) => c * 0.28);
  const mapMix = amt * (grade.map ?? 0.3);
  const skyMix = amt * (grade.skyMix ?? 0.6);
  const rimAmt = amt * (grade.rim ?? 0.4);
  const levels = 4 + Math.round((1 - bands) * 4);
  const gamma = grade.gamma ?? 1.06;
  const exposure = 1 + ((grade.exposure ?? 1.08) - 1) * amt;
  const bloom = grade.bloom ?? 0.28;
  const night = grade.night ? amt : 0;
  const dot = Math.max(3.2, unit * 0.0046);
  // under neon even skin takes the sign light, so the protection relaxes at night
  const skinKeep = 1 - night * 0.55;

  for (let y = 0, p = 0, i = 0; y < h; y++) {
    const fy = y / h;
    for (let x = 0; x < w; x++, p++, i += 4) {
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;
      const l0 = luma[p];
      const sk = skin[p] * skinKeep;

      // poster bands and the comic S-curve; skin keeps a gentler curve
      const q0 = l0 * levels;
      const k0 = Math.floor(q0);
      const f = q0 - k0;
      const q = (k0 + smooth(0.4 + sk * 0.1, 0.6 - sk * 0.1, f)) / levels;
      let t = l0 + (q - l0) * bands * (0.95 - sk * 0.45);
      t = clamp01((t - 0.5) * (1.32 - sk * 0.16) + 0.5);
      t = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
      t = Math.pow(t, 1 + (gamma - 1) * (1 - sk * 0.7));
      if (t > 0.86) t = 0.86 + (t - 0.86) * 0.6;
      t *= 1 - night * 0.22 * smooth(0.3, 0.8, t);
      const sc = l0 > 0.003 ? t / l0 : 1;
      r *= sc;
      g *= sc;
      b *= sc;
      const l = t;

      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      const sat = 1.3 + amt * 0.16 - sk * 0.32;
      r = gray + (r - gray) * sat;
      g = gray + (g - gray) * sat;
      b = gray + (b - gray) * sat;

      // blue skies and sea take the grade's own sky by height: a noon photo turns to dusk
      const blue = clamp01((b - r) * (2.4 + night * 2.6) + (b - g) * 1.4) * clamp01((l - 0.1) * 4) * (1 - sk) * (1 - smooth(0.3, 0.72, fy) * (0.75 - night * 0.5));
      if (blue > 0.01) {
        const c = skyAt(Math.min(1, fy * 1.25));
        const lift = night ? 0.4 + l * 0.55 : 0.45 + l * 0.85;
        const k = blue * skyMix;
        r += (c[0] * lift - r) * k;
        g += (c[1] * lift - g) * k;
        b += (c[2] * lift - b) * k;
      }

      const m = palAt(l);
      const mix = mapMix * (1 - sk * 0.7) + night * 0.12 * (1 - sk);
      r += (m[0] - r) * mix;
      g += (m[1] - g) * mix;
      b += (m[2] - b) * mix;

      const dark = clamp01((0.45 - l) / 0.45) * amt * 0.42 * (1 - sk * 0.5);
      const bright = clamp01((l - 0.55) / 0.45) * amt * 0.3;
      r += (r * shadowMul[0] - r) * dark + (r * highMul[0] - r) * bright;
      g += (g * shadowMul[1] - g) * dark + (g * highMul[1] - g) * bright;
      b += (b * shadowMul[2] - b) * dark + (b * highMul[2] - b) * bright;

      // key light from the panel's outer side, cool fill opposite, rim on bright contour sides
      const side = light > 0 ? x / w : 1 - x / w;
      const key = clamp01((side - 0.4) / 0.6) * (1 - fy * 0.45);
      const rim = rimMask[p] * rimAmt * (0.35 + key * 0.9);
      const rc = side > 0.5 || !night ? warm : cool;
      r += (rc[0] - r) * rim * 0.5 + rc[0] * rim * 0.3;
      g += (rc[1] - g) * rim * 0.5 + rc[1] * rim * 0.3;
      b += (rc[2] - b) * rim * 0.5 + rc[2] * rim * 0.3;
      // the fill side takes the cool accent; at night it is a full cyan sign-light split
      const fill = clamp01((0.5 + night * 0.15 - side) / 0.5 + night * 0.2) * (1 - l * (1 - night * 0.7)) * rimAmt * (0.55 + night * 0.5) * (1 - sk * 0.6);
      const fl = l * (1 + night * 0.5);
      r += (cool[0] * fl - r) * fill;
      g += (cool[1] * fl - g) * fill;
      b += (cool[2] * fl - b) * fill;

      if (sk > 0.05) {
        // natural warm skin: pull back toward the painted tone with a little sun in it
        const kk = sk * 0.42;
        const pr = (data[i] / 255) * sc * 1.04;
        const pg = (data[i + 1] / 255) * sc * 0.99;
        const pb = (data[i + 2] / 255) * sc * 0.92;
        r += (pr - r) * kk;
        g += (pg - g) * kk;
        b += (pb - b) * kk;
      }

      const gl = glow[p] * bloom;
      r = (r + gl * 1.3 * (0.6 + warm[0] * 0.4)) * exposure;
      g = (g + gl * 1.3 * (0.4 + warm[1] * 0.4)) * exposure;
      b = (b + gl * 1.3 * (0.3 + warm[2] * 0.5)) * exposure;

      // spotted blacks: the deepest shadows fill with flat ink, as a comic inker would
      const spot = smooth(0.15, 0.05, l) * (1 - sk) * ink * 0.85;
      if (spot > 0.01) {
        r += (inkCol[0] - r) * spot;
        g += (inkCol[1] - g) * spot;
        b += (inkCol[2] - b) * spot;
      }

      // ink lines are drawn with a pen, not a blur: the soft XDoG mask is thresholded crisp
      const e = smooth(0.08, 0.42, lines[p]);
      if (e > 0.02) {
        const k = e * 0.97;
        r += (inkCol[0] - r) * k;
        g += (inkCol[1] - g) * k;
        b += (inkCol[2] - b) * k;
      }

      if (halftone > 0.01 && l < 0.55) {
        const u = (x * 0.7071 - y * 0.7071) / dot;
        const v = (x * 0.7071 + y * 0.7071) / dot;
        const d = Math.hypot(u - Math.round(u), v - Math.round(v));
        const a = clamp01((0.12 + (0.55 - l) * 0.7 - d) / 0.1) * halftone * clamp01((0.55 - l) * 2.2) * 0.42;
        r *= 1 - a;
        g *= 1 - a;
        b *= 1 - a * 0.85;
      }

      if (grain > 0.01) {
        let hs = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
        hs = ((hs ^ (hs >>> 13)) * 1274126177) | 0;
        const k = 1 + ((((hs ^ (hs >>> 16)) >>> 0) % 1024) / 1023 - 0.5) * grain * 0.12;
        r *= k;
        g *= k;
        b *= k;
      }
      data[i] = clamp01(r) * 255;
      data[i + 1] = clamp01(g) * 255;
      data[i + 2] = clamp01(b) * 255;
      data[i + 3] = 255;
    }
  }
  return imageData;
}

// Unsharp mask on RGB: adds back `amount` of the difference from a box-blurred copy.
function unsharp(data, w, h, radius, amount) {
  if (amount < 0.02) return;
  const n = w * h;
  const ch = [0, 1, 2].map((c) => {
    const m = new Float32Array(n);
    for (let p = 0; p < n; p++) m[p] = data[p * 4 + c];
    return blurMask(m, w, h, radius, 2);
  });
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) data[p * 4 + c] += (data[p * 4 + c] - ch[c][p]) * amount;
  }
}

// Separable box blur in place, `passes` times (three passes come close to a Gaussian).
export function blurMask(mask, w, h, radius, passes = 1) {
  const tmp = new Float32Array(mask.length);
  const inv = 1 / (radius * 2 + 1);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += mask[row + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = sum * inv;
        sum += mask[row + Math.min(w - 1, x + radius + 1)] - mask[row + Math.max(0, x - radius)];
      }
    }
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) sum += tmp[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        mask[y * w + x] = sum * inv;
        sum += tmp[Math.min(h - 1, y + radius + 1) * w + x] - tmp[Math.max(0, y - radius) * w + x];
      }
    }
  }
  return mask;
}

// Kuwahara oil paint over summed-area tables: each pixel takes the four quadrant means weighted by
// how flat each quadrant is, so strokes follow edges instead of smearing across them.
function kuwahara(data, w, h, r) {
  const W = w + 1;
  const size = W * (h + 1);
  const sR = new Float64Array(size);
  const sG = new Float64Array(size);
  const sB = new Float64Array(size);
  const sL = new Float64Array(size);
  const sQ = new Float64Array(size);
  for (let y = 0; y < h; y++) {
    let aR = 0, aG = 0, aB = 0, aL = 0, aQ = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const l = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      aR += data[i];
      aG += data[i + 1];
      aB += data[i + 2];
      aL += l;
      aQ += l * l;
      const o = (y + 1) * W + x + 1;
      const u = o - W;
      sR[o] = sR[u] + aR;
      sG[o] = sG[u] + aG;
      sB[o] = sB[u] + aB;
      sL[o] = sL[u] + aL;
      sQ[o] = sQ[u] + aQ;
    }
  }
  const box = (t, x0, y0, x1, y1) => t[y1 * W + x1] - t[y0 * W + x1] - t[y1 * W + x0] + t[y0 * W + x0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let wr = 0, wg = 0, wb = 0, ws = 0;
      for (let q = 0; q < 4; q++) {
        const x0 = q & 1 ? x : Math.max(0, x - r);
        const x1 = q & 1 ? Math.min(w, x + r + 1) : x + 1;
        const y0 = q & 2 ? y : Math.max(0, y - r);
        const y1 = q & 2 ? Math.min(h, y + r + 1) : y + 1;
        const c = (x1 - x0) * (y1 - y0);
        const mean = box(sL, x0, y0, x1, y1) / c;
        const v = Math.max(0, box(sQ, x0, y0, x1, y1) / c - mean * mean);
        const k = 1 / (c * (1 + v / 14) ** 2);
        wr += box(sR, x0, y0, x1, y1) * k;
        wg += box(sG, x0, y0, x1, y1) * k;
        wb += box(sB, x0, y0, x1, y1) * k;
        ws += c * k;
      }
      const i = (y * w + x) * 4;
      data[i] = wr / ws;
      data[i + 1] = wg / ws;
      data[i + 2] = wb / ws;
    }
  }
}

// Separable bilateral filter: smooths JPEG noise and skin texture while keeping edges.
function bilateral(data, w, h, radius, sigmaRange, sigmaSpace) {
  const space = Float32Array.from({ length: radius * 2 + 1 }, (_, k) => Math.exp(-((k - radius) ** 2) / (2 * sigmaSpace * sigmaSpace)));
  const range = Float32Array.from({ length: 256 }, (_, d) => Math.exp(-(d * d) / (2 * sigmaRange * sigmaRange)));
  const pass = (src, dst, dx, dy) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let sr = 0, sg = 0, sb = 0, sw = 0;
        for (let d = -radius; d <= radius; d++) {
          const xx = x + d * dx;
          const yy = y + d * dy;
          if (xx < 0 || xx >= w || yy < 0 || yy >= h) continue;
          const j = (yy * w + xx) * 4;
          const diff = (Math.abs(src[j] - src[i]) + Math.abs(src[j + 1] - src[i + 1]) + Math.abs(src[j + 2] - src[i + 2])) / 3;
          const wt = space[d + radius] * range[(diff + 0.5) | 0];
          sr += src[j] * wt;
          sg += src[j + 1] * wt;
          sb += src[j + 2] * wt;
          sw += wt;
        }
        dst[i] = sr / sw;
        dst[i + 1] = sg / sw;
        dst[i + 2] = sb / sw;
        dst[i + 3] = 255;
      }
    }
  };
  const tmp = new Uint8ClampedArray(data.length);
  pass(data, tmp, 1, 0);
  pass(tmp, data, 0, 1);
}
