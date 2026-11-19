// The painterly pipeline: an original gallery-grade illustration treatment, not a tint.
//
// Every panel runs through four real passes in plain Canvas 2D pixel work, so the app stays one
// offline static bundle: a separable edge-preserving bilateral smooth (twice, for wet-paint
// flatness), a luminance + chroma Sobel ink contour, a five-stop print grade with a violet /
// coral / gold split tone, and a warm highlight bloom over a screen-angled halftone and a
// deterministic grain. Faces keep their structure because the range weight guards every edge.

import { FX_DEFAULTS, GRADES } from './looks.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const rgbOf = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Paint one panel's pixels in place. A photo gets the full pipeline; an `illustrated` panel is
 * already inked and cel-shaded vector art, so it skips the smoothing and contour passes and takes
 * only a lighter grade, bloom, halftone and grain, which keeps its keylines razor sharp.
 */
export function paintPanel(imageData, { grade = GRADES[0], fx = FX_DEFAULTS, seed = 7, illustrated = false } = {}) {
  const { data, width, height } = imageData;
  if (!width || !height) return imageData;

  const paint = illustrated ? 0 : clamp01(fx.paint);
  const ink = illustrated ? 0 : clamp01(fx.ink);
  const inkOn = ink > 0.01;

  // Pass 1: two separable bilateral rounds. Round one flattens skin and glass into clean
  // values; round two knocks out the remaining photographic micro-detail inside each region.
  if (!illustrated) {
    bilateral(data, width, height, 2 + Math.round(paint * 3), 20 + paint * 26, 2.1 + paint);
    if (paint > 0.08) bilateral(data, width, height, 2, 11 + paint * 9, 1.5);
  }

  const luma = new Float32Array(width * height);
  for (let p = 0, i = 0; p < luma.length; p++, i += 4) {
    luma[p] = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
  }

  // Highlight bloom: blurred speculars, screened back so suns, chrome and neon beads glow.
  const glow = new Float32Array(width * height);
  for (let p = 0; p < luma.length; p++) {
    const t = luma[p] - 0.68;
    glow[p] = t > 0 ? Math.min(1, t / 0.32) : 0;
  }
  const glowRadius = Math.max(2, Math.round(Math.min(width, height) * 0.016));
  blurMask(glow, width, height, glowRadius);
  blurMask(glow, width, height, glowRadius);

  // Five-stop palette sampled by luminance, plus the split-tone ends in normalised RGB.
  const palette = grade.stops.map((hex) => rgbOf(hex).map((v) => v / 255));
  const shadow = grade.shadowTint.map((v) => v / 255);
  const high = grade.highlightTint.map((v) => v / 255);
  const paletteAt = (t) => {
    const x = clamp01(t) * (palette.length - 1);
    const k = Math.min(palette.length - 2, Math.floor(x));
    const f = x - k;
    const a = palette[k];
    const b = palette[k + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };

  const levels = Math.max(6, Math.round(12 - paint * 5));
  const gradeMix = clamp01(fx.grade) * (illustrated ? 0.55 : 1);
  const celMix = illustrated ? 0 : 0.34 + paint * 0.36;
  const saturation = illustrated ? 1.04 + gradeMix * 0.12 : 1.18 + gradeMix * 0.42;
  const exposure = 1 + ((grade.exposure ?? 1.1) - 1) * (illustrated ? 0.25 : 0.4);
  const bloom = (grade.bloom ?? 0.26) * (illustrated ? 0.5 : 1);
  const tooth = illustrated ? 0.45 : 1;
  const shadowLuma = Math.max(0.05, shadow[0] * 0.2126 + shadow[1] * 0.7152 + shadow[2] * 0.0722);
  const highLuma = Math.max(0.05, high[0] * 0.2126 + high[1] * 0.7152 + high[2] * 0.0722);
  const shadowMul = [shadow[0] / shadowLuma, shadow[1] / shadowLuma, shadow[2] / shadowLuma];
  const highMul = [high[0] / highLuma, high[1] / highLuma, high[2] / highLuma];

  for (let y = 0, p = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, p++, i += 4) {
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;

      // Soft cel quantisation of luminance, keeping the pixel's own chroma: this is the step
      // that turns photographic shading into painted value planes without flattening the face.
      let l = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const q = Math.round(l * levels) / levels;
      const target = l + (q - l) * celMix;
      const scale = l > 0.003 ? target / l : 1;
      r = clamp01(r * scale);
      g = clamp01(g * scale);
      b = clamp01(b * scale);
      l = target;

      // Print curve: lift the shadows, roll the highlights, then tint without moving the
      // value. Every step below restores the pixel's luminance, so contrast survives the grade.
      l = clamp01((l - 0.5) * (illustrated ? 1.04 : 1.34) + 0.5);
      if (!illustrated) l = Math.pow(l, 1.08);
      l = l * l * (3 - 2 * l) * 0.22 + l * 0.78;
      const pal = paletteAt(l);

      let gray = r * 0.299 + g * 0.587 + b * 0.114;
      r = clamp01(gray + (r - gray) * saturation);
      g = clamp01(gray + (g - gray) * saturation);
      b = clamp01(gray + (b - gray) * saturation);

      // Palette as a hue, not as a value map: rescale the stop to the pixel's own luminance.
      const pl = Math.max(0.04, pal[0] * 0.2126 + pal[1] * 0.7152 + pal[2] * 0.0722);
      const pk = l / pl;
      const mix = gradeMix * 0.36;
      r = clamp01(r * (1 - mix) + clamp01(pal[0] * pk) * mix);
      g = clamp01(g * (1 - mix) + clamp01(pal[1] * pk) * mix);
      b = clamp01(b * (1 - mix) + clamp01(pal[2] * pk) * mix);

      // Split tone: deep violet in the shadows, warm gold (or cold cyan) in the speculars,
      // applied as channel multipliers so the value stays put and the skin stays recognisable.
      const dark = clamp01((0.42 - l) / 0.46) * gradeMix;
      const bright = clamp01((l - 0.56) / 0.44) * gradeMix;
      if (dark > 0.01) {
        const k = dark * 0.26;
        r = clamp01(r + (r * shadowMul[0] - r) * k);
        g = clamp01(g + (g * shadowMul[1] - g) * k);
        b = clamp01(b + (b * shadowMul[2] - b) * k);
      }
      if (bright > 0.01) {
        const k = bright * 0.2;
        r = clamp01(r + (r * highMul[0] - r) * k);
        g = clamp01(g + (g * highMul[1] - g) * k);
        b = clamp01(b + (b * highMul[2] - b) * k);
      }

      // Brush relief: a low-frequency value wobble in the flat runs, never on an edge.
      const brush = (Math.sin(x * 0.19 + y * 0.11) + Math.sin(x * 0.07 - y * 0.23) * 0.62) * 0.016 * paint;
      r += brush;
      g += brush;
      b += brush;

      // Warm bloom and a specular heat kick.
      const gl = glow[p];
      if (gl > 0.01) {
        r = clamp01(r + gl * bloom * 1.7);
        g = clamp01(g + gl * bloom * 0.92);
        b = clamp01(b + gl * bloom * 0.5);
      }
      if (l > 0.84) {
        const warm = (l - 0.84) / 0.16;
        r = clamp01(r + 0.16 * warm);
        g = clamp01(g + 0.06 * warm);
      }

      r = clamp01(r * 1.02 * exposure + 0.004);
      g = clamp01(g * 1.015 * exposure + 0.003);
      b = clamp01(b * 1.02 * exposure + 0.005);

      // Ink contour on luminance and chroma gradients: a true comic line, not a photo edge.
      if (inkOn) {
        const xm = x > 0 ? x - 1 : x;
        const xp = x < width - 1 ? x + 1 : x;
        const ym = y > 0 ? y - 1 : y;
        const yp = y < height - 1 ? y + 1 : y;
        const p00 = ym * width + xm;
        const p10 = ym * width + x;
        const p20 = ym * width + xp;
        const p01 = y * width + xm;
        const p21 = y * width + xp;
        const p02 = yp * width + xm;
        const p12 = yp * width + x;
        const p22 = yp * width + xp;
        const gx = -luma[p00] - 2 * luma[p01] - luma[p02] + luma[p20] + 2 * luma[p21] + luma[p22];
        const gy = -luma[p00] - 2 * luma[p10] - luma[p20] + luma[p02] + 2 * luma[p12] + luma[p22];
        const lumEdge = Math.hypot(gx, gy) / 4;
        const jm = p01 * 4;
        const jp = p21 * 4;
        const vm = p10 * 4;
        const vp = p12 * 4;
        const chroma = (
          Math.abs(data[jp] - data[jm]) + Math.abs(data[jp + 1] - data[jm + 1]) + Math.abs(data[jp + 2] - data[jm + 2]) +
          Math.abs(data[vp] - data[vm]) + Math.abs(data[vp + 1] - data[vm + 1]) + Math.abs(data[vp + 2] - data[vm + 2])
        ) / 1530;
        const edge = (
          clamp01((lumEdge - 0.05) / 0.19) * 0.9 + clamp01((chroma - 0.055) / 0.24) * 0.32
        ) * ink;
        if (edge > 0.02) {
          const k = 1 - edge * 0.58;
          r = r * k + 0.022 * edge;
          g = g * k + 0.006 * edge;
          b = b * k + 0.04 * edge;
          // A cream rim just inside the dark line gives the ink a printed, lit edge.
          if (l > 0.6 && edge > 0.36) {
            const rim = (edge - 0.36) * 0.2;
            r = clamp01(r + rim);
            g = clamp01(g + rim * 0.92);
            b = clamp01(b + rim * 0.72);
          }
        }
      }

      // Halftone: screen dots only in the lower mid-tones, so faces keep clean planes.
      if (fx.halftone > 0.01) {
        const spacing = 4.4 + (1 - l) * 3.4;
        const ca = 0.785398;
        const sa = 0.707107;
        const u = (x * ca - y * sa) / spacing;
        const v = (x * sa + y * ca) / spacing;
        const du = u - Math.round(u);
        const dv = v - Math.round(v);
        const d = Math.hypot(du, dv);
        const radius = 0.1 + (1 - l) * 0.34;
        const dot = clamp01((radius + 0.08 - d) / 0.16);
        const amt = dot * fx.halftone * (0.4 - l * 0.24) * tooth;
        r *= 1 - amt;
        g *= 1 - amt;
        b *= 1 - amt;
      }

      // Deterministic film grain: the same seed gives the same export bytes.
      if (fx.grain > 0.01) {
        let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
        h = ((h ^ (h >>> 13)) * 1274126177) | 0;
        const n = (((h ^ (h >>> 16)) >>> 0) % 1024) / 1023 - 0.5;
        const k = 1 + n * fx.grain * 0.15 * tooth;
        r = clamp01(r * k);
        g = clamp01(g * k);
        b = clamp01(b * k);
      }

      data[i] = r * 255;
      data[i + 1] = g * 255;
      data[i + 2] = b * 255;
      data[i + 3] = 255;
    }
  }

  return imageData;
}

/**
 * A separable box blur over a one-channel mask, in place. It is used only on the bloom mask,
 * so it can be O(n) with a sliding window and clamped edges.
 */
function blurMask(mask, width, height, radius) {
  const tmp = new Float32Array(mask.length);
  const inv = 1 / (radius * 2 + 1);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += mask[row + Math.min(width - 1, Math.max(0, k))];
    for (let x = 0; x < width; x++) {
      tmp[row + x] = sum * inv;
      const add = Math.min(width - 1, x + radius + 1);
      const sub = Math.max(0, x - radius);
      sum += mask[row + add] - mask[row + sub];
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += tmp[Math.min(height - 1, Math.max(0, k)) * width + x];
    for (let y = 0; y < height; y++) {
      mask[y * width + x] = sum * inv;
      const add = Math.min(height - 1, y + radius + 1);
      const sub = Math.max(0, y - radius);
      sum += tmp[add * width + x] - tmp[sub * width + x];
    }
  }
}

/**
 * Separable bilateral: a horizontal range-weighted pass then a vertical one. Range weights are
 * looked up from the channel difference, so a face's cheek to hairline edge survives while the
 * skin inside the cheek becomes one clean plane.
 */
function bilateral(data, width, height, radius, sigmaRange, sigmaSpace) {
  const space = new Float32Array(radius * 2 + 1);
  const spaceDen = 2 * sigmaSpace * sigmaSpace;
  for (let d = -radius; d <= radius; d++) space[d + radius] = Math.exp(-(d * d) / spaceDen);
  const range = new Float32Array(256);
  const rangeDen = 2 * sigmaRange * sigmaRange;
  for (let d = 0; d < 256; d++) range[d] = Math.exp(-(d * d) / rangeDen);

  const tmp = new Uint8ClampedArray(data.length);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = (row + x) * 4;
      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sw = 0;
      for (let d = -radius; d <= radius; d++) {
        const xx = x + d;
        if (xx < 0 || xx >= width) continue;
        const j = (row + xx) * 4;
        const diff = (Math.abs(data[j] - r0) + Math.abs(data[j + 1] - g0) + Math.abs(data[j + 2] - b0)) / 3;
        const w = space[d + radius] * range[(diff + 0.5) | 0];
        sr += data[j] * w;
        sg += data[j + 1] * w;
        sb += data[j + 2] * w;
        sw += w;
      }
      tmp[i] = sr / sw;
      tmp[i + 1] = sg / sw;
      tmp[i + 2] = sb / sw;
      tmp[i + 3] = 255;
    }
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      const r0 = tmp[i];
      const g0 = tmp[i + 1];
      const b0 = tmp[i + 2];
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sw = 0;
      for (let d = -radius; d <= radius; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= height) continue;
        const j = (yy * width + x) * 4;
        const diff = (Math.abs(tmp[j] - r0) + Math.abs(tmp[j + 1] - g0) + Math.abs(tmp[j + 2] - b0)) / 3;
        const w = space[d + radius] * range[(diff + 0.5) | 0];
        sr += tmp[j] * w;
        sg += tmp[j + 1] * w;
        sb += tmp[j + 2] * w;
        sw += w;
      }
      data[i] = sr / sw;
      data[i + 1] = sg / sw;
      data[i + 2] = sb / sw;
      data[i + 3] = 255;
    }
  }
}
