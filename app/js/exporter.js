// Export path: render one fresh canvas at the exact post size, encode it with the browser's
// own encoder (PNG for lossless, JPEG for a small share file) and hand it to the user. The
// preview and the export share the same renderer, so what is on screen is what the file holds.

import { renderPoster } from './canvas-renderer.js';
import { sizeOf } from './editor-state.js';

export const FORMATS = [
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png', note: 'lossless' },
  { id: 'jpeg', label: 'JPG', mime: 'image/jpeg', ext: 'jpg', note: '92% quality', quality: 0.92 },
];

export const formatById = (id) => FORMATS.find((f) => f.id === id) ?? FORMATS[0];

export function renderExportCanvas(state, assets) {
  const size = sizeOf(state);
  const canvas = document.createElement('canvas');
  renderPoster(canvas, { width: size.width, height: size.height, state, assets, quality: 'export' });
  return canvas;
}

export function canvasToBlob(canvas, mime = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(`${mime} encoding failed`))), mime, quality);
  });
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Render and download one cover file. Returns { width, height, bytes, name, format, blob,
 * canvas } once the browser has encoded it. Nothing is read from or written to the network.
 */
export async function exportCover(state, assets, { format = 'png', download = true } = {}) {
  const kind = formatById(format);
  const size = sizeOf(state);
  const canvas = renderExportCanvas(state, assets);
  const blob = await canvasToBlob(canvas, kind.mime, kind.quality);
  const name = `vice-prism-${size.width}x${size.height}.${kind.ext}`;
  if (download) downloadBlob(blob, name);
  return { width: size.width, height: size.height, bytes: blob.size, name, format: kind.id, blob, canvas };
}
