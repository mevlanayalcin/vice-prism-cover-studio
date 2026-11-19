// Subject finding for photos: the measured face boxes of the two shipped model-made photos, and
// a small skin-region detector for uploads, so the crop planner frames a head instead of
// centre-cropping blindly. Runs on a 64 × 64 thumbnail, on the user's own machine.

function canvas2d(width, height) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return { c, ctx: c.getContext('2d', { willReadFrequently: true }) };
}

/**
 * Face boxes for the two shipped model-made photos, found with a detector at build time and
 * stored as plain numbers so the crop planner never has to guess. `x`/`y` are the box centre in
 * normalised image space; `w`/`h` are its size. They are metadata, not pixels: no other file.
 */
export const PHOTO_SUBJECTS = {
  boulevard: { x: 0.571, y: 0.197, w: 0.192, h: 0.2 },
  pier: { x: 0.4215, y: 0.236, w: 0.215, h: 0.264 },
};

/**
 * Find the subject of an arbitrary upload: a skin-toned region high in the frame is treated as
 * a face, and the crop planner is handed its centre and size. A photo with no clear skin region
 * falls back to a saliency centroid, so the default crop is never a blindly centred one.
 */
export function detectSubject(image) {
  const N = 64;
  const { c, ctx } = canvas2d(N, N);
  ctx.drawImage(image, 0, 0, N, N);
  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, N, N).data;
  } catch {
    return null;
  }
  const mask = new Uint8Array(N * N);
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const i = (py * N + px) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const l = r * 0.299 + g * 0.587 + b * 0.114;
      if (l < 55 || l > 238) continue;
      if (r < 84 || r - g < 14 || r - b < 24 || g < b * 0.82) continue;
      if (r - g > 110) continue;
      mask[py * N + px] = 1;
    }
  }

  // Connected components, then pick the most face-like one: compact, in the upper frame,
  // and small enough to be a head rather than a sunlit wall or a forearm.
  const seen = new Uint8Array(N * N);
  let best = null;
  const stack = new Int32Array(N * N);
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let count = 0;
    let minX = N;
    let maxX = 0;
    let minY = N;
    let maxY = 0;
    const cells = [];
    while (top) {
      const p = stack[--top];
      const x = p % N;
      const y = (p / N) | 0;
      count++;
      cells.push(p);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
          const q = ny * N + nx;
          if (mask[q] && !seen[q]) {
            seen[q] = 1;
            stack[top++] = q;
          }
        }
      }
    }
    if (count < N * N * 0.006) continue;
    let w = maxX - minX + 1;
    let h = maxY - minY + 1;
    if (w * h > N * N * 0.4 || minY === 0) continue;
    let cx = (minX + maxX) / 2;
    let cy = (minY + maxY) / 2;
    if (h > N * 0.3) {
      // A head with a neck and chest: take the top band of the blob as the face.
      const band = Math.max(3, Math.round(h * 0.42));
      let bMinX = N;
      let bMaxX = 0;
      let bMaxY = minY;
      let bCount = 0;
      for (const p of cells) {
        const y = (p / N) | 0;
        if (y > minY + band) continue;
        const x = p % N;
        bCount++;
        if (x < bMinX) bMinX = x;
        if (x > bMaxX) bMaxX = x;
        if (y > bMaxY) bMaxY = y;
      }
      if (bCount > 4) {
        w = bMaxX - bMinX + 1;
        h = bMaxY - minY + 1;
        cx = (bMinX + bMaxX) / 2;
        cy = (minY + bMaxY) / 2;
      }
    }
    const compact = w / Math.max(1, h);
    if (compact < 0.45 || compact > 1.9) continue;
    // Prefer a compact head in the upper half of the frame, not a wide sunlit wall.
    const density = count / (Math.max(1, w * h));
    const areaPenalty = (w * h) / (N * N);
    const score = density * 1.2 + (1 - cy / N) * 4.6 + Math.min(1, 5 / compact) * 0.4 - areaPenalty * 2;
    if (!best || score > best.score) {
      best = {
        x: Math.min(1 - 0.08, Math.max(0.08, cx / N)),
        y: Math.min(1 - 0.1, Math.max(0.1, cy / N)),
        w: Math.min(0.3, Math.max(0.14, w / N)),
        h: Math.min(0.3, Math.max(0.16, h / N)),
        score,
      };
    }
  }
  if (best) return best;
  // Skin-weighted edge centroid in the upper frame: the strongest warm detail is the head,
  // even when a sunset makes the whole frame pass a naive skin test.
  let ex = 0;
  let ey = 0;
  let ew = 0;
  const limit = Math.floor(N * 0.72);
  for (let py = 1; py < limit; py++) {
    for (let px = 1; px < N - 1; px++) {
      const i = (py * N + px) * 4;
      const l = pixels[i] * 0.3 + pixels[i + 1] * 0.59 + pixels[i + 2] * 0.11;
      const lr = pixels[i + 4] * 0.3 + pixels[i + 5] * 0.59 + pixels[i + 6] * 0.11;
      const ld = pixels[i - N * 4] * 0.3 + pixels[i - N * 4 + 1] * 0.59 + pixels[i - N * 4 + 2] * 0.11;
      const e = Math.abs(l - lr) + Math.abs(l - ld);
      if (e < 24) continue;
      const warm = mask[py * N + px] ? 2.6 : 0.12;
      const upper = Math.max(0, 1 - py / (N * 0.62));
      const wgt = e * warm * upper;
      ex += px * wgt;
      ey += py * wgt;
      ew += wgt;
    }
  }
  if (!ew) return null;
  return { x: Math.min(0.86, Math.max(0.14, ex / ew / N)), y: Math.min(0.7, Math.max(0.14, ey / ew / N)), w: 0.24, h: 0.28 };
}
