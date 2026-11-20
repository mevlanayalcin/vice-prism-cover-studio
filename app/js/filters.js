// GTA illustration engine: turns a photo crop into painted cover art in plain Canvas 2D pixel
// work. Photos run the full chain: bilateral denoise, Kuwahara oil-paint, XDoG ink contours,
// cel value planes, gradient-map grade with warm/cool split tone, rim light, bloom, halftone and
// grain. Inked vector scenes skip the paint and ink passes and take only the grade and finish.

import { FX_DEFAULTS, GRADES } from './looks.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const rgbOf = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const lumaOf = (c) => c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;

export function paintPanel(imageData, { grade = GRADES[0], fx = FX_DEFAULTS, seed = 7, illustrated = false, light = 1 } = {}) {
  const { data, width: w, height: h } = imageData;
  if (!w || !h) return imageData;
  const n = w * h;
  const paint = illustrated ? 0 : clamp01(fx.paint);
  const ink = illustrated ? 0 : clamp01(fx.ink);
  const unit = Math.min(w, h);

  if (!illustrated) {
    bilateral(data, w, h, 3, 18 + paint * 14, 2);
    if (paint > 0.05) {
      kuwahara(data, w, h, Math.max(2, Math.round(1 + unit * 0.006 * paint)));
      bilateral(data, w, h, 2, 14, 1.4);
    }
  }

  const luma = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) luma[p] = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;

  let lines = null;
  if (ink > 0.01) {
    const r1 = Math.max(1, Math.round(unit * 0.0016));
    const fine = blurMask(Float32Array.from(luma), w, h, r1, 2);
    const wide = blurMask(Float32Array.from(luma), w, h, r1 * 2 + 1, 2);
    lines = new Float32Array(n);
    for (let p = 0; p < n; p++) {
      const e = wide[p] - fine[p];
      lines[p] = clamp01((e - 0.006) / 0.028) * ink;
    }
  }

  const glow = new Float32Array(n);
  for (let p = 0; p < n; p++) glow[p] = luma[p] > 0.7 ? Math.min(1, (luma[p] - 0.7) / 0.3) : 0;
  blurMask(glow, w, h, Math.max(2, Math.round(unit * 0.02)), 2);

  const pal = grade.stops.map(rgbOf);
  const palAt = (t) => {
    const x = clamp01(t) * (pal.length - 1);
    const k = Math.min(pal.length - 2, Math.floor(x));
    const f = x - k;
    const a = pal[k];
    const b = pal[k + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };
  const tintMul = (c) => {
    const v = c.map((x) => x / 255);
    const l = Math.max(0.05, lumaOf(v));
    return v.map((x) => x / l);
  };
  const shadowMul = tintMul(grade.shadowTint);
  const highMul = tintMul(grade.highlightTint);
  const rim = rgbOf(grade.accent2);
  const cool = rgbOf(grade.accent);
  const gradeAmt = clamp01(fx.grade);
  const mapMix = gradeAmt * (illustrated ? 0.16 : grade.map ?? 0.34);
  const skyMix = (grade.sky ?? 0.55) * gradeAmt;
  const levels = 6;
  const celMix = paint * 0.32;
  const contrast = illustrated ? 1.04 : 1.3;
  const sat = illustrated ? 1.06 : 1.32 + gradeAmt * 0.2;
  const gamma = illustrated ? 1 : grade.gamma ?? 1.12;
  const exposure = illustrated ? 1 + ((grade.exposure ?? 1.1) - 1) * 0.25 : 1;
  const bloom = (grade.bloom ?? 0.26) * (illustrated ? 0.5 : 1);
  const tooth = illustrated ? 0.45 : 1;

  for (let y = 0, p = 0, i = 0; y < h; y++) {
    const fy = y / h;
    for (let x = 0; x < w; x++, p++, i += 4) {
      const fxp = x / w;
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;
      let l = r * 0.2126 + g * 0.7152 + b * 0.0722;

      const s = l * levels;
      const k0 = Math.floor(s);
      const f = s - k0;
      const q = (k0 + (f < 0.35 ? 0 : f > 0.65 ? 1 : (f - 0.35) / 0.3)) / levels;
      let t = l + (q - l) * celMix;
      t = clamp01((t - 0.5) * contrast + 0.5);
      t = t * t * (3 - 2 * t) * 0.3 + t * 0.7;
      if (gamma !== 1) t = Math.pow(t, gamma);
      if (t > 0.78) t = 0.78 + (t - 0.78) * 0.62;
      const sc = l > 0.003 ? t / l : 1;
      r *= sc;
      g *= sc;
      b *= sc;
      l = t;

      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      r = gray + (r - gray) * sat;
      g = gray + (g - gray) * sat;
      b = gray + (b - gray) * sat;

      // skies and sea (blue-dominant) take the grade far harder than skin, so a noon photo relights
      const m = palAt(l);
      const mix = illustrated ? mapMix : mapMix + (1 - mapMix) * clamp01((b - r) * 3) * skyMix;
      r += (m[0] - r) * mix;
      g += (m[1] - g) * mix;
      b += (m[2] - b) * mix;

      const dark = clamp01((0.45 - l) / 0.45) * gradeAmt * 0.42;
      const bright = clamp01((l - 0.55) / 0.45) * gradeAmt * 0.3;
      r += (r * shadowMul[0] - r) * dark + (r * highMul[0] - r) * bright;
      g += (g * shadowMul[1] - g) * dark + (g * highMul[1] - g) * bright;
      b += (b * shadowMul[2] - b) * dark + (b * highMul[2] - b) * bright;

      if (!illustrated) {
        const side = light > 0 ? fxp : 1 - fxp;
        const key = clamp01((side - 0.45) / 0.55) * (1 - fy * 0.5) * gradeAmt;
        const fill = clamp01((0.55 - side) / 0.55) * gradeAmt;
        const hot = key * clamp01((l - 0.25) / 0.5) * (grade.rim ?? 0.34);
        r += (rim[0] - r) * hot * 0.6 + rim[0] * hot * 0.25;
        g += (rim[1] - g) * hot * 0.6 + rim[1] * hot * 0.25;
        b += (rim[2] - b) * hot * 0.6 + rim[2] * hot * 0.25;
        const cf = fill * (1 - l) * (grade.rim ?? 0.34) * 0.9;
        r += (cool[0] * l - r) * cf;
        g += (cool[1] * l - g) * cf;
        b += (cool[2] * l - b) * cf;
      }

      const gl = glow[p];
      if (gl > 0.01) {
        r += gl * bloom * 1.5;
        g += gl * bloom * 0.9;
        b += gl * bloom * 0.55;
      }
      r *= exposure;
      g *= exposure;
      b *= exposure;

      if (lines) {
        const e = lines[p];
        if (e > 0.02) {
          const k = 1 - e * 0.94;
          r = r * k + 0.03 * e;
          g = g * k + 0.008 * e;
          b = b * k + 0.05 * e;
        }
      }

      if (fx.halftone > 0.01 && l < 0.6) {
        const sp = 4.2 + (1 - l) * 3;
        const u = (x * 0.7071 - y * 0.7071) / sp;
        const v = (x * 0.7071 + y * 0.7071) / sp;
        const d = Math.hypot(u - Math.round(u), v - Math.round(v));
        const dot = clamp01((0.18 + (1 - l) * 0.32 - d) / 0.14);
        const amt = dot * fx.halftone * clamp01((0.6 - l) * 1.6) * 0.5 * tooth;
        r *= 1 - amt;
        g *= 1 - amt;
        b *= 1 - amt;
      }

      if (fx.grain > 0.01) {
        let hs = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
        hs = ((hs ^ (hs >>> 13)) * 1274126177) | 0;
        const k = 1 + ((((hs ^ (hs >>> 16)) >>> 0) % 1024) / 1023 - 0.5) * fx.grain * 0.14 * tooth;
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

function blurMask(mask, w, h, radius, passes = 1) {
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
        const k = 1 / (c * (1 + v / 6) ** 2);
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
