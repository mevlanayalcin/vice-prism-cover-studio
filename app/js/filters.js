// The painterly pipeline. This is not a tint over a photo: every panel runs through a real
// edge-preserving bilateral pass, a cel/posterize step, a five-stop print grade, a Sobel ink
// contour, a screen-angled halftone and deterministic film grain. All of it is plain Canvas 2D
// pixel work, so the app stays one offline static bundle.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const FX_DEFAULTS = {
  paint: 0.72,
  ink: 0.62,
  halftone: 0.36,
  grain: 0.4,
  grade: 0.94,
};

export const FX_META = [
  { key: 'paint', name: 'Posterise', hint: 'edge-preserving paint and tone steps' },
  { key: 'ink', name: 'Ink outline', hint: 'Sobel contour weight' },
  { key: 'halftone', name: 'Halftone', hint: 'print dot screen' },
  { key: 'grain', name: 'Film grain', hint: 'ISO 400 tooth' },
  { key: 'grade', name: 'Colour grade', hint: 'duotone mix' },
];

/**
 * Six original grades. Each has five luminance stops (shadow to specular), an accent and a
 * light-leak colour. The UI swatches are built from these same stops.
 */
export const GRADES = [
  {
    id: 'vice-sunset',
    name: 'Vice Sunset',
    accent: '#ff2f87',
    accent2: '#ffb347',
    light: '255, 128, 78',
    bloom: 0.24,
    edge: 0.34,
    exposure: 1.18,
    stops: ['#2a0b45', '#62187a', '#d92a86', '#ff8a55', '#ffeec0'],
  },
  {
    id: 'neon-midnight',
    name: 'Neon Midnight',
    accent: '#21e6ff',
    accent2: '#ff3ec8',
    light: '34, 224, 255',
    bloom: 0.36,
    edge: 0.58,
    exposure: 1.38,
    stops: ['#081031', '#27227e', '#6b3ada', '#3fe0f5', '#ff9fe8'],
  },
  {
    id: 'palm-gold',
    name: 'Palm Gold',
    accent: '#ffbf3c',
    accent2: '#ff7a32',
    light: '255, 198, 96',
    bloom: 0.26,
    edge: 0.36,
    exposure: 1.1,
    stops: ['#221007', '#5c250c', '#b45a16', '#ffb84a', '#fff5cf'],
  },
  {
    id: 'ocean-drive',
    name: 'Ocean Drive',
    accent: '#22d7c6',
    accent2: '#ffd27a',
    light: '86, 240, 220',
    bloom: 0.28,
    edge: 0.4,
    exposure: 1.06,
    stops: ['#03191f', '#084650', '#0e8c93', '#4fe0cb', '#ffefc2'],
  },
  {
    id: 'heatwave-coral',
    name: 'Heatwave Coral',
    accent: '#ff4f6d',
    accent2: '#ffa14a',
    light: '255, 120, 96',
    bloom: 0.24,
    edge: 0.36,
    exposure: 1.06,
    stops: ['#2c0717', '#6e1032', '#d32b55', '#ff8064', '#ffe3b0'],
  },
  {
    id: 'coastal-day',
    name: 'Coastal Day',
    accent: '#17d3c4',
    accent2: '#ff8a6a',
    light: '130, 246, 236',
    bloom: 0.3,
    edge: 0.44,
    exposure: 1.02,
    stops: ['#05343d', '#0d7f8a', '#3fd0c2', '#ffb98d', '#fff7e6'],
  },
];

export const gradeById = (id) => GRADES.find((g) => g.id === id) ?? GRADES[0];

const rgbOf = (hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** The grade's five stops as arrays, plus a CSS swatch for the picker. */
export const gradeColors = (grade) => grade.stops.map(rgbOf);

export const swatchCss = (grade) => `linear-gradient(135deg, ${grade.stops.join(', ')})`;

/** Paint one panel's pixels in place. */
export function paintPanel(imageData, { grade = GRADES[0], fx = FX_DEFAULTS, seed = 7 } = {}) {
  const { data, width, height } = imageData;
  if (!width || !height) return imageData;

  const original = new Uint8ClampedArray(data);
  const paint = clamp01(fx.paint);
  const doSmooth = paint > 0.02;

  if (doSmooth) {
    bilateral(data, width, height, 2, 30 + paint * 30, 1.7 + paint * 0.7);
    const keep = 0.5 - paint * 0.26;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i] * (1 - keep) + original[i] * keep;
      data[i + 1] = data[i + 1] * (1 - keep) + original[i + 1] * keep;
      data[i + 2] = data[i + 2] * (1 - keep) + original[i + 2] * keep;
      data[i + 3] = 255;
    }
  }

  // Luminance field for the ink pass, taken before the colour remap so edges stay photographic.
  const luma = new Float32Array(width * height);
  for (let p = 0, i = 0; p < luma.length; p++, i += 4) {
    luma[p] = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
  }

  // Warm bloom: blur only the highlights, then screen them back over the paint. It is what
  // makes a sun, a chrome bumper or a wet street read as light instead of pale pixels.
  const glow = new Float32Array(width * height);
  for (let p = 0; p < luma.length; p++) {
    const t = luma[p] - 0.7;
    glow[p] = t > 0 ? Math.min(1, t / 0.3) : 0;
  }
  const glowRadius = Math.max(3, Math.round(Math.min(width, height) * 0.018));
  blurMask(glow, width, height, glowRadius);
  blurMask(glow, width, height, glowRadius);

  const palette = gradeColors(grade).map((c) => c.map((v) => v / 255));
  const paletteAt = (t) => {
    const x = clamp01(t) * (palette.length - 1);
    const i = Math.min(palette.length - 2, Math.floor(x));
    const f = x - i;
    const a = palette[i];
    const b = palette[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  };

  const levels = Math.max(5, Math.round(10 - paint * 4));
  const gradeMix = clamp01(fx.grade);
  const celMix = 0.4 + paint * 0.36;
  const saturation = 1.24 + gradeMix * 0.34;

  for (let y = 0, p = 0, i = 0; y < height; y++) {
    for (let x = 0; x < width; x++, p++, i += 4) {
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;

      // cel quantisation of luminance, preserving the pixel's own chroma
      let l = r * 0.2126 + g * 0.7152 + b * 0.0722;
      const q = Math.round(l * levels) / levels;
      const target = l + (q - l) * celMix;
      const scale = l > 0.002 ? target / l : 1;
      r = clamp01(r * scale);
      g = clamp01(g * scale);
      b = clamp01(b * scale);
      l = target;

      // lifted print curve then the grade's five-stop map
      l = clamp01((l - 0.5) * 1.17 + 0.535);
      l = l * l * (3 - 2 * l) * 0.3 + l * 0.7;
      const pal = paletteAt(l);

      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      r = clamp01(gray + (r - gray) * saturation);
      g = clamp01(gray + (g - gray) * saturation);
      b = clamp01(gray + (b - gray) * saturation);

      const mix = gradeMix * 0.64;
      r = r * (1 - mix) + pal[0] * mix;
      g = g * (1 - mix) + pal[1] * mix;
      b = b * (1 - mix) + pal[2] * mix;

      // warm highlight bloom and a little specular heat
      const gl = glow[p];
      if (gl > 0.01) {
        r = clamp01(r + gl * 0.46);
        g = clamp01(g + gl * 0.25);
        b = clamp01(b + gl * 0.14);
      }
      if (l > 0.8) {
        const warm = (l - 0.8) / 0.2;
        r = clamp01(r + 0.18 * warm);
        g = clamp01(g + 0.08 * warm);
      }
      const exposure = grade.exposure ?? 1.06;
      r = clamp01(r * 1.045 * exposure + 0.008);
      g = clamp01(g * 1.035 * exposure + 0.006);
      b = clamp01(b * 1.04 * exposure + 0.008);

      // Sobel ink contour on the smoothed luminance field
      if (fx.ink > 0.01) {
        const xm = x > 0 ? x - 1 : x;
        const xp = x < width - 1 ? x + 1 : x;
        const ym = y > 0 ? y - 1 : y;
        const yp = y < height - 1 ? y + 1 : y;
        const gx =
          -luma[ym * width + xm] - 2 * luma[y * width + xm] - luma[yp * width + xm] +
          luma[ym * width + xp] + 2 * luma[y * width + xp] + luma[yp * width + xp];
        const gy =
          -luma[ym * width + xm] - 2 * luma[ym * width + x] - luma[ym * width + xp] +
          luma[yp * width + xm] + 2 * luma[yp * width + x] + luma[yp * width + xp];
        const mag = Math.hypot(gx, gy) * 0.7;
        const threshold = 0.075;
        const edge = clamp01((mag - threshold) / (threshold * 3.4)) * clamp01(fx.ink);
        if (edge > 0.01) {
          const k = 1 - edge * 0.84;
          r = r * k + 0.028 * edge;
          g = g * k + 0.008 * edge;
          b = b * k + 0.036 * edge;
        }
      }

      // halftone screen: darker mid-tones carry larger dots
      if (fx.halftone > 0.01) {
        const spacing = 4.1 + (1 - l) * 3.6;
        const ang = 0.785398;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const u = (x * ca - y * sa) / spacing;
        const v = (x * sa + y * ca) / spacing;
        const du = u - Math.round(u);
        const dv = v - Math.round(v);
        const d = Math.hypot(du, dv);
        const radius = 0.11 + (1 - l) * 0.3;
        const dot = clamp01((radius + 0.08 - d) / 0.16);
        const amt = dot * fx.halftone * (0.34 - l * 0.18);
        r *= 1 - amt;
        g *= 1 - amt;
        b *= 1 - amt;
      }

      // deterministic film grain: the same seed gives the same export bytes
      if (fx.grain > 0.01) {
        let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
        h = ((h ^ (h >>> 13)) * 1274126177) | 0;
        const n = (((h ^ (h >>> 16)) >>> 0) % 1024) / 1023 - 0.5;
        const k = 1 + n * fx.grain * 0.16;
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

/** True bilateral filter: 5x5 taps, range-weighted so edges survive the smoothing. */
function bilateral(data, width, height, radius, sigmaRange, sigmaSpace) {
  const src = new Uint8ClampedArray(data);
  const spatial = [];
  const spaceDen = 2 * sigmaSpace * sigmaSpace;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      spatial.push({ dx, dy, w: Math.exp(-(dx * dx + dy * dy) / spaceDen) });
    }
  }
  const range = new Float32Array(256);
  const rangeDen = 2 * sigmaRange * sigmaRange;
  for (let d = 0; d < 256; d++) range[d] = Math.exp(-(d * d) / rangeDen);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r0 = src[i];
      const g0 = src[i + 1];
      const b0 = src[i + 2];
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let sw = 0;
      for (const tap of spatial) {
        const yy = y + tap.dy;
        const xx = x + tap.dx;
        if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
        const j = (yy * width + xx) * 4;
        const dr = src[j] - r0;
        const dg = src[j + 1] - g0;
        const db = src[j + 2] - b0;
        const diff = ((dr < 0 ? -dr : dr) + (dg < 0 ? -dg : dg) + (db < 0 ? -db : db)) / 3;
        const w = tap.w * range[diff | 0];
        sr += src[j] * w;
        sg += src[j + 1] * w;
        sb += src[j + 2] * w;
        sw += w;
      }
      data[i] = sr / sw;
      data[i + 1] = sg / sw;
      data[i + 2] = sb / sw;
    }
  }
}
