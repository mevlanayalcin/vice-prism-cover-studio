// Export path: paint one fresh canvas at the exact post size (the current one, or any of the
// three a one-click size button asks for) through the same renderer as the preview, encode it
// with the browser's own encoder (PNG lossless or JPG 92%) and download it. Nothing leaves the
// machine. exportDataUrl hands the same PNG back as a data: URL for ?shot=export.

import { renderPoster } from './canvas-renderer.js';
import { SIZES, sizeOf } from './editor-state.js';

export const FORMATS = {
  png: { id: 'png', mime: 'image/png', ext: 'png' },
  jpeg: { id: 'jpeg', mime: 'image/jpeg', ext: 'jpg', quality: 0.92 },
};

const slug = (text) => (text || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'cover';

export async function exportCover(state, assets, { format = 'png', download = true, size } = {}) {
  const kind = FORMATS[format] ?? FORMATS.png;
  const target = SIZES.find((s) => s.id === size) ?? sizeOf(state);
  const { width, height } = target;
  const canvas = renderPoster(document.createElement('canvas'), { width, height, state: { ...state, size: target.id }, assets, quality: 'export' });
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`${kind.mime} encoding failed`))), kind.mime, kind.quality));
  const name = `${slug(state.caption.title)}-${width}x${height}.${kind.ext}`;
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

export async function exportDataUrl(state, assets, size) {
  const { blob, width, height } = await exportCover(state, assets, { format: 'png', download: false, size });
  const url = await new Promise((resolve) => Object.assign(new FileReader(), { onload: (e) => resolve(e.target.result) }).readAsDataURL(blob));
  return { url, width, height, bytes: blob.size };
}
