// Subject finding for photos: measured face boxes for the two shipped model-made photos, and a
// small skin-region detector for uploads, so the crop planner frames a head instead of centring
// blindly. It runs on a 64 × 64 thumbnail on the user's own machine.

export const PHOTO_SUBJECTS = {
  boulevard: { x: 0.571, y: 0.197, w: 0.192, h: 0.2 },
  pier: { x: 0.4215, y: 0.236, w: 0.215, h: 0.264 },
};

const isSkin = (r, g, b) => {
  const l = r * 0.299 + g * 0.587 + b * 0.114;
  return l > 55 && l < 238 && r > 84 && r - g >= 14 && r - g <= 110 && r - b >= 24 && g >= b * 0.82;
};

export function detectSubject(image) {
  const N = 64;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, N, N);
  let px;
  try {
    px = ctx.getImageData(0, 0, N, N).data;
  } catch {
    return null;
  }
  const rows = new Float32Array(N);
  const mask = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) if (isSkin(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])) rows[(i / N) | 0] += mask[i] = 1;
  const top = rows.findIndex((n, y) => y > 0 && n >= 3 && (rows[y + 1] ?? 0) >= 3);
  if (top >= 0 && top < N * 0.75) {
    const bottom = Math.min(N - 1, top + Math.round(N * 0.22));
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
    if (count > N * N * 0.006 && w < 0.6) {
      const h = (bottom - top + 1) / N;
      return { x: Math.min(0.92, Math.max(0.08, sx / count / N)), y: Math.min(0.9, Math.max(0.1, (top + bottom) / 2 / N)), w: Math.min(0.3, Math.max(0.14, w)), h: Math.min(0.3, Math.max(0.16, h)) };
    }
  }
  let ex = 0;
  let ey = 0;
  let ew = 0;
  for (let y = 1; y < N * 0.72; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = (y * N + x) * 4;
      const l = (j) => px[j] * 0.3 + px[j + 1] * 0.59 + px[j + 2] * 0.11;
      const e = Math.abs(l(i) - l(i + 4)) + Math.abs(l(i) - l(i - N * 4));
      if (e < 24) continue;
      const wgt = e * (mask[y * N + x] ? 2.6 : 0.12) * Math.max(0, 1 - y / (N * 0.62));
      ex += x * wgt;
      ey += y * wgt;
      ew += wgt;
    }
  }
  return ew ? { x: Math.min(0.86, Math.max(0.14, ex / ew / N)), y: Math.min(0.7, Math.max(0.14, ey / ew / N)), w: 0.24, h: 0.28 } : null;
}
