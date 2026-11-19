// Studio wiring: build the rails, load the offline samples, keep every control and the canvas in
// sync, and export exact-size PNGs. No dependency, no fetch, no external URL.

import { buildGeometry, layoutById, LAYOUTS, panelAt, tracePanel } from './layouts.js';
import { FX_DEFAULTS, FX_META, GRADES, gradeById, swatchCss } from './filters.js';
import { FONT_STYLE_OPTIONS, TEXT_POSITIONS } from './lettering.js';
import {
  applyDemo,
  assignPack,
  assignSource,
  createState,
  DEMOS,
  mixSources,
  PACKS,
  resetPanel,
  setLayout,
  setSize,
  SIZES,
  sizeOf,
} from './editor-state.js';
import { buildProceduralSamples } from './samples.js';
import { renderPoster } from './canvas-renderer.js';
import { exportCover, FORMATS, formatById } from './exporter.js';

const $ = (id) => document.getElementById(id);

const poster = $('poster');
const overlay = $('overlay');
const stage = $('stage');
const posterWrap = $('poster-wrap');
const statusEl = $('status');
const fileInput = $('file');
const fillAll = $('fill-all');

const assets = new Map();
for (const sample of buildProceduralSamples()) assets.set(sample.id, sample);
const state = createState();

let assetLabels = {
  'sunset-city': 'Sunset Strip',
  'sunset-cruise': 'Sunset Cruiser',
  'coast-highway': 'Coast Highway',
  'neon-skyline': 'Neon Skyline',
  'neon-strip': 'Neon Strip',
  'coastal-day': 'Coastal Day',
  boulevard: 'Boulevard',
  pier: 'Pier at Dusk',
};

let raf = 0;
let pendingQuality = 'preview';
let drag = null;
let exportBusy = false;
let exportFormat = 'png';
let fontSelect;
let positionSelect;

const galleryOrder = ['sunset-city', 'sunset-cruise', 'coast-highway', 'neon-strip', 'neon-skyline', 'coastal-day', 'boulevard', 'pier'];

function setStatus(text) {
  statusEl.textContent = text;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${src}`));
    image.src = src;
  });
}

async function loadStarterPhotos() {
  const base = new URL('../samples/', import.meta.url);
  const [boulevard, pier] = await Promise.all([loadImage(new URL('boulevard.jpg', base).href), loadImage(new URL('pier.jpg', base).href)]);
  assets.set('boulevard', { id: 'boulevard', label: 'Boulevard', image: boulevard, version: 1 });
  assets.set('pier', { id: 'pier', label: 'Pier at Dusk', image: pier, version: 1 });
}

/** Wait for the shipped display faces before the first paint, so canvas type never reflows. */
async function ensureFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load('900 100px "VP Display"'),
      document.fonts.load('700 100px "VP Text"'),
      document.fonts.load('400 100px "VP Text"'),
      document.fonts.load('700 100px "VP Editorial"'),
    ]);
    await document.fonts.ready;
  } catch {
    // the system fallbacks in the lettering stacks still draw a complete cover
  }
}

/* ---------------------------------------------------------------- canvas */

function schedule(quality = 'preview') {
  pendingQuality = quality;
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    draw(pendingQuality);
  });
}

function draw(quality = 'preview') {
  const size = sizeOf(state);
  renderPoster(poster, { width: size.width, height: size.height, state, assets, quality });
  drawOverlay();
}

function drawOverlay() {
  const size = sizeOf(state);
  overlay.width = size.width;
  overlay.height = size.height;
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, size.width, size.height);
  const geo = buildGeometry(layoutById(state.layout), size.width, size.height);
  const panel = geo.panels[state.activePanel];
  if (!panel) return;
  const unit = Math.min(size.width, size.height);
  ctx.save();
  tracePanel(ctx, panel.points);
  ctx.fillStyle = 'rgba(255,59,141,0.045)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,73,151,0.96)';
  ctx.lineWidth = Math.max(2, unit * 0.0042);
  ctx.setLineDash([unit * 0.013, unit * 0.008]);
  ctx.shadowColor = 'rgba(255,59,141,0.9)';
  ctx.shadowBlur = unit * 0.018;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = Math.max(1, unit * 0.0012);
  ctx.strokeStyle = 'rgba(255,244,230,0.9)';
  ctx.shadowBlur = 0;
  ctx.stroke();
  for (const point of panel.points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(3, unit * 0.0055), 0, Math.PI * 2);
    ctx.fillStyle = '#fff1dc';
    ctx.fill();
    ctx.lineWidth = Math.max(1, unit * 0.0012);
    ctx.strokeStyle = '#ff3b8d';
    ctx.stroke();
  }
  ctx.restore();

  // a small editor tag at the panel's leading corner
  const tagSize = Math.max(13, unit * 0.021);
  const p0 = panel.points[0];
  const label = `P${panel.index + 1}`;
  const tw = tagSize * 2.1;
  const th = tagSize * 1.35;
  const x = Math.min(Math.max(6, p0.x + tagSize * 0.35), size.width - tw - 6);
  const y = Math.min(Math.max(6, p0.y + tagSize * 0.35), size.height - th - 6);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = tagSize * 0.5;
  ctx.fillStyle = 'rgba(255,59,141,0.94)';
  roundRect(ctx, x, y, tw, th, th * 0.24);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1a0411';
  ctx.font = `900 ${tagSize * 0.68}px 'Lato', 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + tw / 2, y + th / 2 + tagSize * 0.02);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitPoster() {
  const size = sizeOf(state);
  const rect = stage.getBoundingClientRect();
  const availW = Math.max(160, rect.width - 48);
  const availH = Math.max(160, rect.height - 58);
  const ratio = size.width / size.height;
  let width = availW;
  let height = width / ratio;
  if (height > availH) {
    height = availH;
    width = height * ratio;
  }
  posterWrap.style.width = `${Math.round(width)}px`;
  posterWrap.style.height = `${Math.round(height)}px`;
}

/* ---------------------------------------------------------------- thumbs */

function paintLayoutThumb(canvas, layout, grade) {
  const w = (canvas.width = 210);
  const h = (canvas.height = 88);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#08040d';
  ctx.fillRect(0, 0, w, h);
  const colors = grade.stops;
  layout.panels.forEach((panel, i) => {
    ctx.save();
    ctx.beginPath();
    panel.points.forEach((p, index) => {
      const x = p.x * w;
      const y = p.y * h;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, colors[(i + 1) % colors.length]);
    g.addColorStop(0.52, colors[(i + 2) % colors.length]);
    g.addColorStop(1, colors[(i + 3) % colors.length]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = '#fff4dd';
    ctx.fillRect(i * 24 - 10, 0, 2, h);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    panel.points.forEach((p, index) => {
      const x = p.x * w;
      const y = p.y * h;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,247,231,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  });
  const tz = layout.zones.title;
  ctx.save();
  ctx.fillStyle = 'rgba(7,2,12,0.55)';
  ctx.fillRect(tz.x * w, tz.y * h, tz.w * w, tz.h * h);
  ctx.fillStyle = '#ffe3a3';
  ctx.fillRect(tz.x * w, (tz.y + 0.06) * h, tz.w * w * 0.72, 6);
  ctx.fillStyle = '#ff4f8f';
  ctx.fillRect(tz.x * w, (tz.y + 0.17) * h, tz.w * w * 0.54, 6);
  ctx.restore();
}

function paintPhotoThumb(canvas, image) {
  const w = (canvas.width = 96);
  const h = (canvas.height = 86);
  const ctx = canvas.getContext('2d');
  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;
  const cover = Math.max(w / sw, h / sh);
  const dw = sw * cover;
  const dh = sh * cover;
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
  const shade = ctx.createLinearGradient(0, h * 0.5, 0, h);
  shade.addColorStop(0, 'rgba(4,1,8,0)');
  shade.addColorStop(1, 'rgba(4,1,8,0.62)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
}

/* ---------------------------------------------------------------- rails */

function buildLayouts() {
  const grid = $('layout-grid');
  grid.innerHTML = '';
  for (const layout of LAYOUTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layout-card';
    button.dataset.layout = layout.id;
    button.title = `${layout.name} — ${layout.note}`;
    const canvas = document.createElement('canvas');
    paintLayoutThumb(canvas, layout, gradeById(state.grade));
    const label = document.createElement('span');
    label.textContent = layout.name;
    button.append(canvas, label);
    button.addEventListener('click', () => {
      setLayout(state, layout.id);
      state.activePanel = 0;
      refreshThumbs();
      syncAll();
      fitPoster();
      draw('preview');
      setStatus(`${layout.name}: ${layout.panels.length} panels · drag any cut to reframe.`);
    });
    grid.appendChild(button);
  }
}

function refreshThumbs() {
  const grid = $('layout-grid');
  const grade = gradeById(state.grade);
  for (const button of grid.querySelectorAll('.layout-card')) {
    const layout = layoutById(button.dataset.layout);
    paintLayoutThumb(button.querySelector('canvas'), layout, grade);
  }
}

function buildSizes() {
  const grid = $('size-grid');
  grid.innerHTML = '';
  for (const size of SIZES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'size-btn';
    button.dataset.size = size.id;
    const ratio = size.width / size.height;
    const shapeW = ratio >= 1 ? 20 : 18 * ratio;
    const shapeH = ratio >= 1 ? 20 / ratio : 18;
    button.innerHTML = `<span class="ratio-shape"><i style="width:${shapeW}px;height:${shapeH}px"></i></span><strong>${size.ratio}</strong><em>${size.width}×${size.height}</em>`;
    button.addEventListener('click', () => {
      setSize(state, size.id);
      syncSize();
      fitPoster();
      draw('preview');
      setStatus(`Post size ${size.width} × ${size.height} (${size.ratio}) — export stays pixel-perfect.`);
    });
    grid.appendChild(button);
  }
}

function buildGrades() {
  const list = $('grade-list');
  list.innerHTML = '';
  for (const grade of GRADES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grade-btn';
    button.dataset.grade = grade.id;
    button.title = grade.name;
    button.innerHTML = `<span class="grade-swatch" style="background:${swatchCss(grade)}"></span><span>${grade.name}</span>`;
    button.addEventListener('click', () => {
      state.grade = grade.id;
      syncGrades();
      refreshThumbs();
      draw('preview');
      setStatus(`${grade.name} grade applied to all panels.`);
    });
    list.appendChild(button);
  }
}

function buildFx() {
  const wrap = $('fx-controls');
  wrap.innerHTML = '';
  for (const meta of FX_META) {
    const row = document.createElement('div');
    row.className = 'fx-row';
    const value = Math.round(state.fx[meta.key] * 100);
    row.innerHTML = `<label for="fx-${meta.key}">${meta.name}</label><input id="fx-${meta.key}" type="range" min="0" max="100" step="1" value="${value}"><output>${value}%</output>`;
    const input = row.querySelector('input');
    const out = row.querySelector('output');
    input.addEventListener('input', () => {
      state.fx[meta.key] = Number(input.value) / 100;
      out.textContent = `${input.value}%`;
      schedule('draft');
    });
    input.addEventListener('change', () => schedule('preview'));
    wrap.appendChild(row);
  }
}

function buildCaptionControls() {
  fontSelect = $('font-select');
  fontSelect.innerHTML = FONT_STYLE_OPTIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join('');
  positionSelect = $('position-select');
  positionSelect.innerHTML = TEXT_POSITIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join('');

  fontSelect.addEventListener('change', () => {
    state.fontStyle = fontSelect.value;
    $('font-note').textContent = FONT_STYLE_OPTIONS.find((o) => o.id === state.fontStyle)?.label ?? '';
    schedule('preview');
  });
  positionSelect.addEventListener('change', () => {
    state.textPosition = positionSelect.value;
    schedule('preview');
  });
  $('title-input').addEventListener('input', (e) => { state.caption.title = e.target.value; schedule('draft'); });
  $('subtitle-input').addEventListener('input', (e) => { state.caption.subtitle = e.target.value; schedule('draft'); });
  $('tagline-input').addEventListener('input', (e) => { state.caption.tagline = e.target.value; schedule('draft'); });
  $('badge-input').addEventListener('input', (e) => { state.caption.badge = e.target.value; schedule('draft'); });
}

function buildPanelGradeSelect() {
  const select = $('panel-grade');
  select.innerHTML = `<option value="global">Global grade</option>` + GRADES.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
  select.addEventListener('change', () => {
    const panel = state.panels[state.activePanel];
    if (panel) panel.gradeOverride = select.value;
    syncPanel();
    schedule('preview');
  });
}

function buildGallery() {
  const gallery = $('gallery');
  gallery.innerHTML = '';
  for (const id of galleryOrder) {
    const asset = assets.get(id);
    if (!asset) continue;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'gallery-tile';
    tile.dataset.source = id;
    tile.title = `${asset.label || assetLabels[id]} — click to use`;
    const canvas = document.createElement('canvas');
    paintPhotoThumb(canvas, asset.image);
    const label = document.createElement('span');
    label.textContent = assetLabels[id] ?? asset.label ?? id;
    tile.append(canvas, label);
    tile.addEventListener('click', () => {
      assignSource(state, id, { all: fillAll.checked });
      state.lastSource = id;
      $('apply-all').disabled = false;
      clearPackSelection();
      syncPanel();
      syncGallery();
      draw('preview');
      setStatus(fillAll.checked ? `Filled every panel with ${label.textContent}.` : `Set ${label.textContent} on panel ${state.activePanel + 1}.`);
    });
    gallery.appendChild(tile);
  }
}

function clearPackSelection() {
  for (const button of $('pack-row').querySelectorAll('.pack-btn')) button.classList.remove('active');
}

function buildPacks() {
  const row = $('pack-row');
  row.innerHTML = '';
  for (const pack of PACKS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pack-btn';
    button.dataset.pack = pack.id;
    button.textContent = pack.label;
    button.title = `Lay the ${pack.label} sample pack across every panel`;
    button.addEventListener('click', () => {
      assignPack(state, pack.sources);
      state.lastSource = pack.sources[0];
      $('apply-all').disabled = false;
      for (const other of row.querySelectorAll('.pack-btn')) other.classList.toggle('active', other === button);
      syncPanel();
      syncGallery();
      draw('preview');
      setStatus(`${pack.label} pack laid across ${state.panels.length} panels with fresh crops.`);
    });
    row.appendChild(button);
  }
}

function syncGallery() {
  const current = state.panels[state.activePanel]?.source;
  for (const tile of $('gallery').querySelectorAll('.gallery-tile')) {
    tile.classList.toggle('active', tile.dataset.source === current);
  }
}

function syncGrades() {
  for (const button of $('grade-list').querySelectorAll('.grade-btn')) {
    button.classList.toggle('active', button.dataset.grade === state.grade);
  }
  $('grade-name').textContent = gradeById(state.grade).name;
}

function syncSize() {
  const size = sizeOf(state);
  for (const button of $('size-grid').querySelectorAll('.size-btn')) {
    button.classList.toggle('active', button.dataset.size === size.id);
  }
  for (const button of $('export-sizes').querySelectorAll('.export-size')) {
    button.classList.toggle('active', button.dataset.size === size.id);
  }
  $('size-note').textContent = `${size.ratio} · ${size.label.toLowerCase()}`;
  $('stage-size').textContent = `${size.width} × ${size.height} px`;
  $('export-size-note').textContent = `${size.width} × ${size.height}`;
  const kind = formatById(exportFormat);
  $('export-label').textContent = `Export ${kind.label}`;
  $('export-dim').textContent = `${size.width} × ${size.height} · ${kind.id === 'jpeg' ? 'JPG' : 'PNG'} · offline`;
}

function setFormat(id) {
  const kind = formatById(id);
  exportFormat = kind.id;
  for (const button of document.querySelectorAll('.format-btn')) {
    button.classList.toggle('active', button.dataset.format === kind.id);
  }
  syncSize();
  setStatus(kind.id === 'png' ? 'PNG selected: lossless, byte-crisp panels.' : 'JPG selected: 92% quality for a small share file.');
}

function buildFormats() {
  for (const button of document.querySelectorAll('.format-btn')) {
    button.addEventListener('click', () => setFormat(button.dataset.format));
  }
  for (const format of FORMATS) {
    const button = document.querySelector(`.format-btn[data-format="${format.id}"]`);
    if (button) button.title = `${format.label} export — ${format.note}`;
  }
  setFormat(exportFormat);
}

function syncLayout() {
  const layout = layoutById(state.layout);
  for (const button of $('layout-grid').querySelectorAll('.layout-card')) {
    button.classList.toggle('active', button.dataset.layout === layout.id);
  }
  $('layout-name').textContent = layout.name;
  $('stage-spec').textContent = `CANVAS 2D · sRGB · ${layout.panels.length} CUTS`;
}

function syncCaptionInputs() {
  $('title-input').value = state.caption.title;
  $('subtitle-input').value = state.caption.subtitle;
  $('tagline-input').value = state.caption.tagline;
  $('badge-input').value = state.caption.badge;
  fontSelect.value = state.fontStyle;
  positionSelect.value = state.textPosition;
  $('font-note').textContent = FONT_STYLE_OPTIONS.find((o) => o.id === state.fontStyle)?.label ?? '';
}

function buildPanelChips() {
  const list = $('panel-list');
  list.innerHTML = '';
  const count = layoutById(state.layout).panels.length;
  for (let i = 0; i < count; i++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'panel-btn';
    button.dataset.panel = String(i);
    button.textContent = `P${i + 1}`;
    button.addEventListener('click', () => {
      state.activePanel = i;
      syncPanel();
      drawOverlay();
    });
    list.appendChild(button);
  }
}

function syncPanel() {
  const panel = state.panels[state.activePanel];
  const layout = layoutById(state.layout);
  if (!panel) return;
  for (const button of $('panel-list').querySelectorAll('.panel-btn')) {
    button.classList.toggle('active', Number(button.dataset.panel) === state.activePanel);
  }
  const label = assetLabels[panel.source] ?? assets.get(panel.source)?.label ?? panel.source;
  $('active-label').textContent = `PANEL ${String(state.activePanel + 1).padStart(2, '0')} · ${label.toUpperCase()}`;
  $('panel-name').textContent = `P${state.activePanel + 1}`;
  $('zoom-range').value = panel.zoom;
  $('zoom-out').textContent = `${panel.zoom.toFixed(2)}×`;
  $('rotate-range').value = panel.rotate;
  $('rotate-out').textContent = `${panel.rotate}°`;
  $('flip-btn').classList.toggle('on', !!panel.flip);
  $('panel-grade').value = panel.gradeOverride || 'global';
  syncGallery();
  $('stage-spec').textContent = `CANVAS 2D · sRGB · ${layout.panels.length} CUTS`;
}

function syncAll() {
  syncLayout();
  syncSize();
  syncGrades();
  syncCaptionInputs();
  buildPanelChips();
  syncPanel();
}

function buildExportSizes() {
  const wrap = $('export-sizes');
  wrap.innerHTML = '';
  for (const size of SIZES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'export-size';
    button.dataset.size = size.id;
    button.innerHTML = `<strong>${size.ratio}</strong><em>${size.width}×${size.height}</em>`;
    button.addEventListener('click', () => {
      setSize(state, size.id);
      syncSize();
      fitPoster();
      draw('preview');
    });
    wrap.appendChild(button);
  }
}

/* ---------------------------------------------------------------- interaction */

function eventPanel(event) {
  const rect = overlay.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const x = ((event.clientX - rect.left) / rect.width) * overlay.width;
  const y = ((event.clientY - rect.top) / rect.height) * overlay.height;
  const geo = buildGeometry(layoutById(state.layout), overlay.width, overlay.height);
  return panelAt(geo, x, y);
}

const clampFocus = (v) => Math.max(-0.35, Math.min(1.35, v));

overlay.addEventListener('pointerdown', (event) => {
  const panel = eventPanel(event);
  if (!panel) return;
  state.activePanel = panel.index;
  syncPanel();
  drawOverlay();
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panel: panel.index };
  overlay.setPointerCapture(event.pointerId);
  overlay.classList.add('dragging');
  schedule('draft');
});

overlay.addEventListener('pointermove', (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  const rect = overlay.getBoundingClientRect();
  const panel = state.panels[drag.panel];
  const geo = buildGeometry(layoutById(state.layout), overlay.width, overlay.height).panels[drag.panel];
  if (!panel || !geo) return;
  const dx = ((event.clientX - drag.x) / rect.width) * overlay.width;
  const dy = ((event.clientY - drag.y) / rect.height) * overlay.height;
  const scale = Math.max(0.2, panel.zoom ?? 1);
  panel.focusX = clampFocus(panel.focusX - dx / (geo.box.w * scale));
  panel.focusY = clampFocus(panel.focusY - dy / (geo.box.h * scale));
  drag.x = event.clientX;
  drag.y = event.clientY;
  schedule('draft');
});

function endDrag(event) {
  if (!drag || (event && event.pointerId !== drag.id)) return;
  drag = null;
  overlay.classList.remove('dragging');
  if (overlay.hasPointerCapture?.(event?.pointerId)) overlay.releasePointerCapture(event.pointerId);
  schedule('preview');
  setStatus(`Panel ${state.activePanel + 1} reframed — the crop is remembered per panel.`);
}
overlay.addEventListener('pointerup', endDrag);
overlay.addEventListener('pointercancel', endDrag);

let wheelTimer = 0;
overlay.addEventListener(
  'wheel',
  (event) => {
    const panel = eventPanel(event);
    if (panel) state.activePanel = panel.index;
    const cfg = state.panels[state.activePanel];
    if (!cfg) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0012);
    cfg.zoom = Math.min(2.6, Math.max(1, cfg.zoom * factor));
    $('zoom-range').value = cfg.zoom;
    $('zoom-out').textContent = `${cfg.zoom.toFixed(2)}×`;
    syncPanel();
    schedule('draft');
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => schedule('preview'), 160);
  },
  { passive: false },
);

function bindPanelTools() {
  const zoom = $('zoom-range');
  zoom.addEventListener('input', () => {
    const panel = state.panels[state.activePanel];
    if (!panel) return;
    panel.zoom = Number(zoom.value);
    $('zoom-out').textContent = `${panel.zoom.toFixed(2)}×`;
    schedule('draft');
  });
  zoom.addEventListener('change', () => schedule('preview'));

  const rotate = $('rotate-range');
  rotate.addEventListener('input', () => {
    const panel = state.panels[state.activePanel];
    if (!panel) return;
    panel.rotate = Number(rotate.value);
    $('rotate-out').textContent = `${panel.rotate}°`;
    schedule('draft');
  });
  rotate.addEventListener('change', () => schedule('preview'));

  $('flip-btn').addEventListener('click', () => {
    const panel = state.panels[state.activePanel];
    if (!panel) return;
    panel.flip = !panel.flip;
    $('flip-btn').classList.toggle('on', panel.flip);
    schedule('preview');
    setStatus(`Panel ${state.activePanel + 1} flipped.`);
  });

  $('reset-panel').addEventListener('click', () => {
    resetPanel(state, state.activePanel);
    syncPanel();
    schedule('preview');
    setStatus(`Panel ${state.activePanel + 1} reset to its smart crop.`);
  });
}

function bindKeyboard() {
  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    const count = layoutById(state.layout).panels.length;
    if (event.key === '[' || event.key === ']') {
      state.activePanel = (state.activePanel + (event.key === ']' ? 1 : count - 1)) % count;
      syncPanel();
      drawOverlay();
      event.preventDefault();
    } else if (/^[1-6]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (index < count) {
        state.activePanel = index;
        syncPanel();
        drawOverlay();
        event.preventDefault();
      }
    } else if (event.key === 'e' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      triggerExport();
    }
  });
}

/* ---------------------------------------------------------------- photo input */

async function useFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('That file is not an image. Choose a JPG, PNG or WEBP.');
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const version = (assets.get('upload')?.version ?? 0) + 1;
    const label = file.name.replace(/\.[^.]+$/, '').slice(0, 28) || 'Your photo';
    assets.set('upload', { id: 'upload', label, image, version });
    assetLabels.upload = label;
    assignSource(state, 'upload', { all: fillAll.checked });
    state.lastSource = 'upload';
    $('apply-all').disabled = false;
    syncPanel();
    draw('preview');
    setStatus(fillAll.checked ? `Loaded ${label} into all ${state.panels.length} panels with smart crops.` : `Loaded ${label} into panel ${state.activePanel + 1}.`);
  } catch {
    setStatus('That image could not be decoded. Try another JPG, PNG or WEBP.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function bindPhoto() {
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    await useFile(file);
    fileInput.value = '';
  });

  $('apply-all').addEventListener('click', () => {
    if (!state.lastSource) return;
    assignSource(state, state.lastSource, { all: true });
    syncPanel();
    draw('preview');
    setStatus(`${assetLabels[state.lastSource] ?? state.lastSource} now fills every panel with a different crop.`);
  });

  $('mix-btn').addEventListener('click', () => {
    mixSources(state, galleryOrder);
    clearPackSelection();
    syncPanel();
    draw('preview');
    setStatus('Mixed the sample gallery across the panels.');
  });

  let dragDepth = 0;
  const dropzone = $('dropzone');
  window.addEventListener('dragenter', (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    dragDepth++;
    dropzone.classList.add('over');
    event.preventDefault();
  });
  window.addEventListener('dragover', (event) => {
    if (event.dataTransfer?.types?.includes('Files')) event.preventDefault();
  });
  window.addEventListener('dragleave', (event) => {
    if (!event.dataTransfer?.types?.includes('Files')) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) dropzone.classList.remove('over');
  });
  window.addEventListener('drop', async (event) => {
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    dragDepth = 0;
    dropzone.classList.remove('over');
    await useFile(event.dataTransfer.files[0]);
  });
}

/* ---------------------------------------------------------------- export */

function triggerExport() {
  if (exportBusy) return;
  exportBusy = true;
  const button = $('export-btn');
  button.classList.add('is-busy');
  const size = sizeOf(state);
  setStatus(`Painting ${size.width} × ${size.height} at export resolution…`);
  requestAnimationFrame(async () => {
    try {
      const result = await exportCover(state, assets, { format: exportFormat });
      window.__lastExport = {
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        name: result.name,
        format: result.format,
      };
      setStatus(`Exported ${result.name} · ${(result.bytes / 1024 / 1024).toFixed(2)} MB · ${result.width} × ${result.height}.`);
    } catch (error) {
      setStatus(`Export failed: ${error.message}`);
    } finally {
      exportBusy = false;
      button.classList.remove('is-busy');
    }
  });
}

/* ---------------------------------------------------------------- boot */

function wireTopActions() {
  $('export-btn').addEventListener('click', triggerExport);
  $('fx-reset').addEventListener('click', () => {
    state.fx = { ...FX_DEFAULTS };
    buildFx();
    schedule('preview');
    setStatus('Painterly FX reset to the house recipe.');
  });
}

async function boot() {
  await Promise.all([ensureFonts(), loadStarterPhotos()]);
  buildLayouts();
  buildSizes();
  buildGrades();
  buildFx();
  buildCaptionControls();
  buildPanelGradeSelect();
  buildGallery();
  buildPacks();
  buildExportSizes();
  buildFormats();
  bindPanelTools();
  bindPhoto();
  bindKeyboard();
  wireTopActions();

  const params = new URLSearchParams(location.search);
  const demo = params.get('demo');
  if (demo && DEMOS[demo]) applyDemo(state, demo);
  if (params.get('layout') && LAYOUTS.some((l) => l.id === params.get('layout'))) setLayout(state, params.get('layout'));
  if (params.get('size') && SIZES.some((s) => s.id === params.get('size'))) setSize(state, params.get('size'));
  if (params.get('grade') && GRADES.some((g) => g.id === params.get('grade'))) state.grade = params.get('grade');

  syncAll();
  fitPoster();
  draw('preview');
  window.__shotReady = true;

  window.__vp = {
    state,
    assets,
    DEMOS,
    setDemo(name) {
      applyDemo(state, name);
      syncAll();
      fitPoster();
      draw('preview');
      window.__shotReady = true;
    },
    setFormat(id) {
      setFormat(id);
    },
    setPanel(index) {
      state.activePanel = Math.max(0, Math.min(state.panels.length - 1, index));
      syncPanel();
      drawOverlay();
    },
    exportImage: (format = exportFormat) => exportCover(state, assets, { format, download: false }),
    render: (quality = 'preview') => draw(quality),
  };

  window.addEventListener('resize', () => {
    fitPoster();
    drawOverlay();
  });
}

boot().catch((error) => {
  setStatus(`The studio could not start: ${error.message}`);
  // the page still fails visibly rather than silently
  console.error(error);
});
