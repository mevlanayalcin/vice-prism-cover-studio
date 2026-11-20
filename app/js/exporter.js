// Export path: render one fresh canvas at the exact post size through the same renderer as the
// preview, encode it with the browser's own encoder (PNG lossless or JPG 92%) and download it.

import { renderPoster } from './canvas-renderer.js';
import { sizeOf } from './editor-state.js';

export const FORMATS = {
  png: { id: 'png', mime: 'image/png', ext: 'png' },
  jpeg: { id: 'jpeg', mime: 'image/jpeg', ext: 'jpg', quality: 0.92 },
};

export async function exportCover(state, assets, { format = 'png', download = true } = {}) {
  const kind = FORMATS[format] ?? FORMATS.png;
  const { width, height } = sizeOf(state);
  const canvas = renderPoster(document.createElement('canvas'), { width, height, state, assets, quality: 'export' });
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`${kind.mime} encoding failed`))), kind.mime, kind.quality));
  const name = `vice-prism-${width}x${height}.${kind.ext}`;
  if (download) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name, rel: 'noopener' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  return { width, height, bytes: blob.size, name, format: kind.id, blob, canvas };
}
