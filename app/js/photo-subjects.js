// What each photo is about, so the crop planner frames it instead of centring blindly. The eight
// shipped photos carry boxes measured by hand (centre x, y and size w, h as fractions of the
// photo): a head box runs from the top of the hair or hat to the chin, and a scene box holds the
// whole vehicle with `lead` saying which way it faces, so it lands on a third with room ahead.
// Uploads get the same kind of head box from a small skin-region detector run on the user's
// own machine; a photo with no skin falls back to its strongest detail.

const head = (x, y, w, h) => ({ kind: 'face', x, y, w, h });
const scene = (x, y, w, h, lead = 0) => ({ kind: 'scene', x, y, w, h, lead });

export const PHOTO_SAMPLES = [
  { id: 'heli', label: 'Helicopter', note: 'Black utility helicopter over the skyline at sunset', subject: scene(0.44, 0.43, 0.6, 0.52, 1) },
  { id: 'boulevard', label: 'Boulevard', note: 'Woman in sunglasses on the palm boulevard', subject: head(0.585, 0.178, 0.235, 0.215) },
  { id: 'rooftop', label: 'Rooftop', note: 'Man in a coral floral shirt on a dusk rooftop', subject: head(0.515, 0.262, 0.215, 0.345) },
  { id: 'ocean-drive', label: 'Ocean Drive', note: 'Neon-wet Art Deco avenue at twilight', subject: scene(0.5, 0.58, 0.46, 0.5) },
  { id: 'coupe', label: '80s Coupe', note: 'Teal-and-white wedge coupe on the palm boulevard', subject: scene(0.525, 0.6, 0.6, 0.4, -1) },
  { id: 'speedboat', label: 'Speedboat', note: 'Offshore racer cutting turquoise spray', subject: scene(0.44, 0.555, 0.54, 0.3, -1) },
  { id: 'neon-street', label: 'Neon Street', note: 'Two friends on a rain-slick neon street', subject: head(0.535, 0.41, 0.36, 0.27) },
  { id: 'pier', label: 'Pier', note: 'Smiling fisherman on the turquoise pier', subject: head(0.405, 0.19, 0.4, 0.36) },
];
export const PHOTO_SUBJECTS = Object.fromEntries(PHOTO_SAMPLES.map((s) => [s.id, s.subject]));

const isSkin = (r, g, b) => {
  const l = r * 0.299 + g * 0.587 + b * 0.114;
  return l > 50 && l < 240 && r > 80 && r - g >= 12 && r - g <= 115 && r - b >= 20 && g >= b * 0.8;
};

function skinHead(px, N) {
  const rows = new Float32Array(N);
  const mask = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) if (isSkin(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])) rows[(i / N) | 0] += mask[i] = 1;
  const top = rows.findIndex((n, y) => y > 0 && n >= 3 && (rows[y + 1] ?? 0) >= 3);
  if (top < 0 || top > N * 0.75) return { mask, box: null };
  const bottom = Math.min(N - 1, top + Math.round(N * 0.2));
  let sx = 0;
  let count = 0;
  let minX = N;
  let maxX = 0;
  for (let y = top; y <= bottom; y++) {
    for (let x = 0; x < N; x++) {
      if (!mask[y * N + x]) continue;
      sx += x;
      count++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }
  const w = (maxX - minX + 1) / N;
  if (count < N * N * 0.006 || w > 0.6) return { mask, box: null };
  // the skin starts at the forehead: grow the box up for hair and down a touch for the chin
  const faceH = (bottom - top + 1) / N;
  const h = Math.min(0.42, Math.max(0.18, faceH * 1.45));
  const y = top / N - faceH * 0.38 + h / 2;
  return { mask, box: head(Math.min(0.9, Math.max(0.1, sx / count / N)), Math.min(0.85, Math.max(0.12, y)), Math.min(0.42, Math.max(0.16, w * 1.25)), h) };
}

export function detectSubject(image) {
  const N = 64;
  const c = Object.assign(document.createElement('canvas'), { width: N, height: N });
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, N, N);
  let px;
  try {
    px = ctx.getImageData(0, 0, N, N).data;
  } catch {
    return null;
  }
  const { mask, box } = skinHead(px, N);
  if (box) return box;
  let ex = 0;
  let ey = 0;
  let ew = 0;
  const l = (j) => px[j] * 0.3 + px[j + 1] * 0.59 + px[j + 2] * 0.11;
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = (y * N + x) * 4;
      const e = Math.abs(l(i) - l(i + 4)) + Math.abs(l(i) - l(i - N * 4));
      if (e < 24) continue;
      const wgt = e * (mask[y * N + x] ? 2 : 1) * (1 - Math.abs(x / N - 0.5));
      ex += x * wgt;
      ey += y * wgt;
      ew += wgt;
    }
  }
  return ew ? scene(Math.min(0.8, Math.max(0.2, ex / ew / N)), Math.min(0.75, Math.max(0.25, ey / ew / N)), 0.4, 0.4) : null;
}
