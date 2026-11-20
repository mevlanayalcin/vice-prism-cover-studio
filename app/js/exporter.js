// Export path: paint one fresh canvas at the exact post size (the current one, or any of the
// three a one-click size button asks for) through the same renderer as the preview, encode it
// with the browser's own encoder (PNG lossless or JPG 92%), read the real pixel size back out of
// the encoded file and download it. Nothing leaves the machine. exportDataUrl hands the same PNG
// back as a data: URL for ?shot=export.

import { renderPoster } from './canvas-renderer.js';
import { SIZES, sizeOf } from './editor-state.js';

export const FORMATS = {
  png: { id: 'png', mime: 'image/png', ext: 'png' },
  jpeg: { id: 'jpeg', mime: 'image/jpeg', ext: 'jpg', quality: 0.92 },
};

const slug = (text) => (text || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'cover';
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

// The pixel size written in the file itself: a PNG's IHDR chunk, or a JPEG's first SOF marker.
// The readout in the studio shows this, not the size the canvas was asked for.
export async function encodedSize(blob) {
  const bytes = new Uint8Array(await blob.slice(0, 65536).arrayBuffer());
  const view = new DataView(bytes.buffer);
  if (PNG_SIGNATURE.every((b, i) => bytes[i] === b) && String.fromCharCode(...bytes.slice(12, 16)) === 'IHDR') {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  for (let i = 2; i + 9 < bytes.length;) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return { width: view.getUint16(i + 7), height: view.getUint16(i + 5) };
    i += 2 + view.getUint16(i + 2);
  }
  return null;
}

export async function exportCover(state, assets, { format = 'png', download = true, size } = {}) {
  const kind = FORMATS[format] ?? FORMATS.png;
  const target = SIZES.find((s) => s.id === size) ?? sizeOf(state);
  const { width, height } = target;
  const canvas = renderPoster(document.createElement('canvas'), { width, height, state: { ...state, size: target.id }, assets, quality: 'export' });
  const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`${kind.mime} encoding failed`))), kind.mime, kind.quality));
  const pixels = await encodedSize(blob);
  if (!pixels || pixels.width !== width || pixels.height !== height) throw new Error(`the encoder wrote ${pixels ? `${pixels.width} × ${pixels.height}` : 'an unreadable file'}, not ${width} × ${height}`);
  const name = `${slug(state.caption.title)}-${width}x${height}.${kind.ext}`;
  if (download) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name, rel: 'noopener' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  return { width, height, pixels, bytes: blob.size, name, format: kind.id, blob, canvas };
}

export async function exportDataUrl(state, assets, size) {
  const { blob, width, height } = await exportCover(state, assets, { format: 'png', download: false, size });
  const url = await new Promise((resolve) => Object.assign(new FileReader(), { onload: (e) => resolve(e.target.result) }).readAsDataURL(blob));
  return { url, width, height, bytes: blob.size };
}
