// Studio wiring: build the rails, register the illustrated scenes and shipped photos, keep every
// control, the history and the canvas in sync, and export exact-size PNGs.
//
// First load is only the shell: this file, the layouts, the editor state and the look catalogue.
// The rails paint from those alone while the renderer (pixel pipeline + lettering), the inked art
// and the photo framing stream in with import(); the exporter and the showcase / 3D box module
// load on first use. No dependency, no fetch, no URL.

import { buildGeometry, layoutById, LAYOUTS, panelAt, tracePanel } from './layouts.js';
import { FONT_STYLE_OPTIONS, FX_DEFAULTS, FX_META, GRADES, gradeById, swatchCss, TEXT_POSITIONS } from './looks.js';
import {
  applyDemo, assignPack, assignSource, createHistory, createState, DEMOS, mixSources, PACKS, resetPanel,
  setLayout, setSize, SIZES, sizeOf, SOURCE_IDS, STICKERS, swapPanels,
} from './editor-state.js';

const $ = (id) => document.getElementById(id);
const poster = $('poster');
const overlay = $('overlay');
const stage = $('stage');
const posterWrap = $('poster-wrap');
const boxView = $('box-view');
const statusEl = $('status');
const fillAll = $('fill-all');

const assets = new Map();
const state = createState();
const history = createHistory(state);
const thumbs = new Map();

let raf = 0;
let pendingQuality = 'preview';
let drag = null;
let swapFrom = null;
let exportBusy = false;
let exportFormat = 'png';
let view = 'edit';
let boxTimer = 0;
let lazy = { exporter: null, showcase: null, subjects: null };
let renderer = null; // canvas-renderer.js once streamed in

const setStatus = (text) => (statusEl.textContent = text);
const labelOf = (id) => assets.get(id)?.label ?? id;
const loadExporter = () => (lazy.exporter ??= import('./exporter.js'));
const loadShowcase = () => (lazy.showcase ??= import('./showcase.js'));
const loadSubjects = () => (lazy.subjects ??= import('./photo-subjects.js'));

async function loadArt() {
  const { illustratedAssets } = await import('./art/scenes.js');
  for (const asset of illustratedAssets()) assets.set(asset.id, asset);
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
  const [boulevard, pier, { PHOTO_SUBJECTS }] = await Promise.all([loadImage(new URL('boulevard.jpg', base).href), loadImage(new URL('pier.jpg', base).href), loadSubjects()]);
  assets.set('boulevard', { id: 'boulevard', label: 'Boulevard photo', image: boulevard, version: 1, subject: PHOTO_SUBJECTS.boulevard });
  assets.set('pier', { id: 'pier', label: 'Pier photo', image: pier, version: 1, subject: PHOTO_SUBJECTS.pier });
}

async function ensureFonts() {
  if (!document.fonts?.load) return;
  try {
    await Promise.all(['900 100px "VP Display"', '700 100px "VP Text"', '400 100px "VP Text"', '700 100px "VP Editorial"'].map((f) => document.fonts.load(f)));
  } catch {
    // the lettering stacks fall back to system faces and still draw a complete cover
  }
}

function sourceThumb(id, w = 96, h = 62) {
  const key = `${id}:${assets.get(id)?.version ?? 0}:${w}`;
  if (!thumbs.has(key)) {
    const asset = assets.get(id);
    if (!asset) return null;
    thumbs.set(key, renderer.paintSourceThumb(document.createElement('canvas'), asset, w, h));
  }
  return thumbs.get(key);
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
  if (!renderer) return;
  const size = sizeOf(state);
  renderer.renderPoster(poster, { width: size.width, height: size.height, state, assets, quality });
  drawOverlay();
  if (view === 'box') {
    clearTimeout(boxTimer);
    boxTimer = setTimeout(refreshBox, quality === 'draft' ? 220 : 0);
  }
}

function drawOverlay() {
  const size = sizeOf(state);
  overlay.width = size.width;
  overlay.height = size.height;
  const ctx = overlay.getContext('2d');
  const geo = buildGeometry(layoutById(state.layout), size.width, size.height);
  const unit = Math.min(size.width, size.height);
  const mark = (panel, color, dash) => {
    ctx.save();
    tracePanel(ctx, panel.points);
    ctx.fillStyle = color.replace('1)', '0.06)');
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, unit * 0.0045);
    ctx.setLineDash(dash ? [unit * 0.014, unit * 0.009] : []);
    ctx.shadowColor = color;
    ctx.shadowBlur = unit * 0.02;
    ctx.stroke();
    ctx.restore();
  };
  const panel = geo.panels[state.activePanel];
  if (!panel) return;
  mark(panel, swapFrom != null ? 'rgba(80,232,255,1)' : 'rgba(255,73,151,1)', true);
  const tag = Math.max(13, unit * 0.022);
  const p0 = panel.points[0];
  const label = swapFrom != null ? `P${panel.index + 1} ⇄ ?` : `P${panel.index + 1}`;
  ctx.save();
  ctx.font = `900 ${tag * 0.7}px 'VP Text', sans-serif`;
  const tw = ctx.measureText(label).width + tag;
  const x = Math.min(Math.max(6, p0.x + tag * 0.4), size.width - tw - 6);
  const y = Math.min(Math.max(6, p0.y + tag * 0.4), size.height - tag * 1.4 - 6);
  ctx.fillStyle = swapFrom != null ? '#50e8ff' : '#ff3b8d';
  ctx.beginPath();
  ctx.roundRect(x, y, tw, tag * 1.4, tag * 0.3);
  ctx.fill();
  ctx.fillStyle = '#0a0a0d';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + tag * 0.5, y + tag * 0.72);
  ctx.restore();
}

function fitPoster() {
  const size = sizeOf(state);
  const rect = stage.getBoundingClientRect();
  const availW = Math.max(160, rect.width - 40);
  const availH = Math.max(160, rect.height - 44);
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

/* ---------------------------------------------------------------- history */

function syncHistory() {
  $('undo-btn').disabled = !history.canUndo;
  $('redo-btn').disabled = !history.canRedo;
}

function commit() {
  history.commit();
  syncHistory();
}

function travel(dir) {
  const moved = dir < 0 ? history.undo() : history.redo();
  if (!moved) return;
  syncAll();
  fitPoster();
  draw('preview');
  syncHistory();
  setStatus(dir < 0 ? 'Undone.' : 'Redone.');
}

/* ---------------------------------------------------------------- thumbs */

function paintLayoutThumb(canvas, layout, grade) {
  const w = (canvas.width = 120);
  const h = (canvas.height = 72);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(0, 0, w, h);
  layout.panels.forEach((panel, i) => {
    ctx.save();
    ctx.beginPath();
    panel.points.forEach((p, k) => (k ? ctx.lineTo(p.x * w, p.y * h) : ctx.moveTo(p.x * w, p.y * h)));
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, grade.stops[(i + 1) % 5]);
    g.addColorStop(1, grade.stops[(i + 3) % 5]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  });
  const tz = layout.zones.title;
  ctx.fillStyle = '#fff1d0';
  ctx.fillRect(tz.x * w, (tz.y + tz.h * 0.3) * h, tz.w * w * 0.7, 5);
  ctx.fillStyle = grade.accent;
  ctx.fillRect(tz.x * w, (tz.y + tz.h * 0.62) * h, tz.w * w * 0.45, 4);
}

/* ---------------------------------------------------------------- rails */

function buildLayouts() {
  const grid = $('layout-grid');
  grid.replaceChildren();
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
      afterChange(`${layout.name}: ${layout.panels.length} panels · drag any cut to reframe.`, true);
    });
    grid.append(button);
  }
}

function refreshLayoutThumbs() {
  const grade = gradeById(state.grade);
  for (const button of $('layout-grid').children) paintLayoutThumb(button.querySelector('canvas'), layoutById(button.dataset.layout), grade);
}

function buildSizes() {
  const grid = $('size-grid');
  grid.replaceChildren();
  for (const size of SIZES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'size-btn';
    button.dataset.size = size.id;
    const r = size.width / size.height;
    button.innerHTML = `<i style="width:${r >= 1 ? 20 : 16 * r}px;height:${r >= 1 ? 20 / r : 16}px"></i><strong>${size.ratio}</strong><em>${size.width}×${size.height}</em>`;
    button.addEventListener('click', () => {
      setSize(state, size.id);
      afterChange(`Post size ${size.width} × ${size.height} — export stays pixel-exact.`, true);
    });
    grid.append(button);
  }
}

function buildGrades() {
  const list = $('grade-list');
  list.replaceChildren();
  for (const grade of GRADES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'grade-btn';
    button.dataset.grade = grade.id;
    button.innerHTML = `<i style="background:${swatchCss(grade)}"></i><span>${grade.name}</span>`;
    button.addEventListener('click', () => {
      state.grade = grade.id;
      refreshLayoutThumbs();
      afterChange(`${grade.name} grade across every panel.`);
    });
    list.append(button);
  }
}

function buildStickers() {
  const list = $('sticker-list');
  list.replaceChildren();
  for (const s of STICKERS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sticker-btn';
    button.dataset.sticker = s.key;
    button.title = s.hint;
    button.innerHTML = `<i></i>${s.name}`;
    button.addEventListener('click', () => {
      state.stickers[s.key] = !state.stickers[s.key];
      afterChange(`${s.name} ${state.stickers[s.key] ? 'on' : 'off'}.`);
    });
    list.append(button);
  }
}

function buildFx() {
  const wrap = $('fx-controls');
  wrap.replaceChildren();
  for (const meta of FX_META) {
    const row = document.createElement('label');
    row.className = 'fx-row';
    const value = Math.round(state.fx[meta.key] * 100);
    row.innerHTML = `<span>${meta.name}</span><input type="range" min="0" max="100" step="1" value="${value}"><output>${value}</output>`;
    const input = row.querySelector('input');
    input.dataset.fx = meta.key;
    input.addEventListener('input', () => {
      state.fx[meta.key] = Number(input.value) / 100;
      row.querySelector('output').textContent = input.value;
      schedule('draft');
    });
    input.addEventListener('change', () => {
      commit();
      schedule('preview');
    });
    wrap.append(row);
  }
}

function syncFx() {
  for (const input of $('fx-controls').querySelectorAll('input')) {
    input.value = Math.round(state.fx[input.dataset.fx] * 100);
    input.nextElementSibling.textContent = input.value;
  }
}

const CAPTION_FIELDS = { 'title-input': 'title', 'subtitle-input': 'subtitle', 'tagline-input': 'tagline', 'badge-input': 'badge', 'platform-input': 'platform' };

function buildCaptionControls() {
  $('font-select').innerHTML = FONT_STYLE_OPTIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join('');
  $('position-select').innerHTML = TEXT_POSITIONS.map((o) => `<option value="${o.id}">${o.label}</option>`).join('');
  $('font-select').addEventListener('change', (e) => {
    state.fontStyle = e.target.value;
    afterChange(`${FONT_STYLE_OPTIONS.find((o) => o.id === state.fontStyle)?.label} lettering.`);
  });
  $('position-select').addEventListener('change', (e) => {
    state.textPosition = e.target.value;
    afterChange('Title moved.');
  });
  for (const [id, key] of Object.entries(CAPTION_FIELDS)) {
    $(id).addEventListener('input', (e) => {
      state.caption[key] = e.target.value;
      schedule('draft');
    });
    $(id).addEventListener('change', () => {
      commit();
      schedule('preview');
    });
  }
}

function buildGallery() {
  const gallery = $('gallery');
  gallery.replaceChildren();
  const ids = [...SOURCE_IDS, ...(assets.has('upload') ? ['upload'] : [])];
  for (const id of ids) {
    const asset = assets.get(id);
    if (!asset) continue;
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = `gallery-tile${asset.illustrated ? '' : ' is-photo'}`;
    tile.dataset.source = id;
    tile.title = `${asset.label} — click to place`;
    const label = document.createElement('span');
    label.textContent = asset.label;
    tile.append(sourceThumb(id).cloneNode(false), label);
    tile.querySelector('canvas').getContext('2d').drawImage(sourceThumb(id), 0, 0);
    tile.addEventListener('click', () => {
      assignSource(state, id, { all: fillAll.checked });
      state.lastSource = id;
      $('apply-all').disabled = false;
      afterChange(fillAll.checked ? `${asset.label} in every panel, each with its own crop.` : `${asset.label} → panel ${state.activePanel + 1}.`);
    });
    gallery.append(tile);
  }
}

function buildPacks() {
  const row = $('pack-row');
  row.replaceChildren();
  for (const pack of PACKS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pack-btn';
    button.textContent = pack.label;
    button.addEventListener('click', () => {
      assignPack(state, pack.sources);
      afterChange(`${pack.label} pack across ${state.panels.length} panels.`);
    });
    row.append(button);
  }
}

function buildPanelChips() {
  const list = $('panel-list');
  list.replaceChildren();
  state.panels.forEach((panel, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'panel-chip';
    button.dataset.panel = String(i);
    const thumb = sourceThumb(panel.source, 64, 40);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 40;
    if (thumb) canvas.getContext('2d').drawImage(thumb, 0, 0);
    const label = document.createElement('b');
    label.textContent = `P${i + 1}`;
    button.append(canvas, label);
    button.title = `Panel ${i + 1}: ${labelOf(panel.source)}`;
    button.addEventListener('click', () => pickPanel(i));
    list.append(button);
  });
}

function pickPanel(index) {
  if (swapFrom != null) {
    const from = swapFrom;
    swapFrom = null;
    $('swap-btn').classList.remove('on');
    if (from !== index) {
      swapPanels(state, from, index);
      state.activePanel = index;
      afterChange(`Swapped panel ${from + 1} with panel ${index + 1}.`);
      return;
    }
  }
  state.activePanel = index;
  syncPanel();
  drawOverlay();
}

/** After any discrete edit: commit to history, resync the rails, redraw. */
function afterChange(message, refit = false) {
  commit();
  if (!renderer) return; // still streaming in: boot syncs and paints once it lands
  syncAll();
  if (refit) fitPoster();
  draw('preview');
  if (message) setStatus(message);
}

/* ---------------------------------------------------------------- sync */

function syncAll() {
  const layout = layoutById(state.layout);
  const size = sizeOf(state);
  for (const b of $('layout-grid').children) b.classList.toggle('active', b.dataset.layout === layout.id);
  for (const b of $('size-grid').children) b.classList.toggle('active', b.dataset.size === size.id);
  for (const b of $('grade-list').children) b.classList.toggle('active', b.dataset.grade === state.grade);
  for (const b of $('sticker-list').children) b.classList.toggle('on', !!state.stickers[b.dataset.sticker]);
  $('layout-name').textContent = layout.name;
  $('grade-name').textContent = gradeById(state.grade).name;
  $('size-note').textContent = `${size.ratio} · ${size.label.toLowerCase()}`;
  $('stage-size').textContent = `${size.width} × ${size.height} px`;
  $('stage-spec').textContent = `CANVAS 2D · ${layout.panels.length} CUTS · ${gradeById(state.grade).name.toUpperCase()}`;
  $('export-size-note').textContent = `${size.width} × ${size.height}`;
  $('export-label').textContent = `Export ${exportFormat === 'jpeg' ? 'JPG' : 'PNG'}`;
  $('export-dim').textContent = `${size.width} × ${size.height} · ${size.ratio} · offline`;
  $('quick-export').textContent = `↓ Export ${exportFormat === 'jpeg' ? 'JPG' : 'PNG'}`;
  for (const [id, key] of Object.entries(CAPTION_FIELDS)) if (document.activeElement !== $(id)) $(id).value = state.caption[key] ?? '';
  $('font-select').value = state.fontStyle;
  $('position-select').value = state.textPosition;
  $('font-note').textContent = FONT_STYLE_OPTIONS.find((o) => o.id === state.fontStyle)?.label ?? '';
  syncFx();
  buildPanelChips();
  syncPanel();
}

function syncPanel() {
  const panel = state.panels[state.activePanel];
  if (!panel) return;
  for (const b of $('panel-list').children) b.classList.toggle('active', Number(b.dataset.panel) === state.activePanel);
  $('active-label').textContent = `PANEL ${String(state.activePanel + 1).padStart(2, '0')} · ${labelOf(panel.source).toUpperCase()}`;
  $('zoom-range').value = panel.zoom;
  $('zoom-out').textContent = `${panel.zoom.toFixed(2)}×`;
  $('rotate-range').value = panel.rotate;
  $('rotate-out').textContent = `${panel.rotate}°`;
  $('flip-btn').classList.toggle('on', !!panel.flip);
  $('panel-grade').value = panel.gradeOverride || 'global';
  for (const tile of $('gallery').children) tile.classList.toggle('active', tile.dataset.source === panel.source);
}

/* ---------------------------------------------------------------- canvas gestures */

function eventPanel(event) {
  const rect = overlay.getBoundingClientRect();
  if (!rect.width) return null;
  const x = ((event.clientX - rect.left) / rect.width) * overlay.width;
  const y = ((event.clientY - rect.top) / rect.height) * overlay.height;
  return panelAt(buildGeometry(layoutById(state.layout), overlay.width, overlay.height), x, y);
}

function bindCanvas() {
  const clampFocus = (v) => Math.max(-0.35, Math.min(1.35, v));
  overlay.addEventListener('pointerdown', (event) => {
    const panel = eventPanel(event);
    if (!panel) return;
    if (swapFrom != null) return pickPanel(panel.index);
    state.activePanel = panel.index;
    syncPanel();
    drawOverlay();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panel: panel.index, moved: false };
    overlay.setPointerCapture(event.pointerId);
    overlay.classList.add('dragging');
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
    panel.focusX = clampFocus(panel.focusX - dx / (geo.box.w * scale * 1.6));
    panel.focusY = clampFocus(panel.focusY - dy / (geo.box.h * scale * 1.6));
    panel.manualFocus = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    drag.moved = true;
    schedule('draft');
  });
  const end = (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    overlay.classList.remove('dragging');
    if (moved) {
      commit();
      schedule('preview');
      setStatus(`Panel ${state.activePanel + 1} reframed — the crop is kept per panel.`);
    }
  };
  overlay.addEventListener('pointerup', end);
  overlay.addEventListener('pointercancel', end);
  let wheelTimer = 0;
  overlay.addEventListener('wheel', (event) => {
    const panel = eventPanel(event);
    if (panel) state.activePanel = panel.index;
    const cfg = state.panels[state.activePanel];
    if (!cfg) return;
    event.preventDefault();
    cfg.zoom = Math.min(2.6, Math.max(1, cfg.zoom * Math.exp(-event.deltaY * 0.0012)));
    cfg.manualFocus = true;
    syncPanel();
    schedule('draft');
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      commit();
      schedule('preview');
    }, 200);
  }, { passive: false });
}

function bindPanelTools() {
  $('panel-grade').innerHTML = `<option value="global">Global grade</option>${GRADES.map((g) => `<option value="${g.id}">${g.name}</option>`).join('')}`;
  $('panel-grade').addEventListener('change', (e) => {
    state.panels[state.activePanel].gradeOverride = e.target.value;
    afterChange(`Panel ${state.activePanel + 1} grade set.`);
  });
  for (const [id, key, out, fmt] of [['zoom-range', 'zoom', 'zoom-out', (v) => `${v.toFixed(2)}×`], ['rotate-range', 'rotate', 'rotate-out', (v) => `${v}°`]]) {
    $(id).addEventListener('input', () => {
      const panel = state.panels[state.activePanel];
      panel[key] = Number($(id).value);
      if (key === 'zoom') panel.manualFocus = true;
      $(out).textContent = fmt(panel[key]);
      schedule('draft');
    });
    $(id).addEventListener('change', () => {
      commit();
      schedule('preview');
    });
  }
  $('flip-btn').addEventListener('click', () => {
    const panel = state.panels[state.activePanel];
    panel.flip = !panel.flip;
    afterChange(`Panel ${state.activePanel + 1} flipped.`);
  });
  $('reset-panel').addEventListener('click', () => {
    resetPanel(state, state.activePanel);
    afterChange(`Panel ${state.activePanel + 1} back to its smart crop.`);
  });
  $('swap-btn').addEventListener('click', () => {
    swapFrom = swapFrom == null ? state.activePanel : null;
    $('swap-btn').classList.toggle('on', swapFrom != null);
    drawOverlay();
    setStatus(swapFrom != null ? `Swap: pick the panel to trade with panel ${swapFrom + 1}.` : 'Swap cancelled.');
  });
}

function bindKeyboard() {
  window.addEventListener('keydown', (event) => {
    const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement;
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 'z' && !typing) {
      event.preventDefault();
      travel(event.shiftKey ? 1 : -1);
    } else if (mod && event.key.toLowerCase() === 'y' && !typing) {
      event.preventDefault();
      travel(1);
    } else if (mod && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      triggerExport();
    } else if (typing) {
      return;
    } else if (event.key === '[' || event.key === ']') {
      const n = state.panels.length;
      pickPanel((state.activePanel + (event.key === ']' ? 1 : n - 1)) % n);
    } else if (/^[1-9]$/.test(event.key) && Number(event.key) <= state.panels.length) {
      pickPanel(Number(event.key) - 1);
    }
  });
}

/* ---------------------------------------------------------------- photo input */

async function useFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return setStatus('That file is not an image. Choose a JPG, PNG or WEBP.');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const version = (assets.get('upload')?.version ?? 0) + 1;
    const label = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Your photo';
    const { detectSubject } = await loadSubjects();
    assets.set('upload', { id: 'upload', label, image, version, subject: detectSubject(image) });
    assignSource(state, 'upload', { all: fillAll.checked });
    state.lastSource = 'upload';
    $('apply-all').disabled = false;
    buildGallery();
    afterChange(fillAll.checked ? `${label} fills all ${state.panels.length} panels with face-aware crops.` : `${label} → panel ${state.activePanel + 1}, framed on the face.`);
  } catch {
    setStatus('That image could not be decoded. Try another JPG, PNG or WEBP.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function bindPhoto() {
  $('file').addEventListener('change', async (e) => {
    await useFile(e.target.files?.[0]);
    e.target.value = '';
  });
  $('apply-all').addEventListener('click', () => {
    if (!state.lastSource) return;
    assignSource(state, state.lastSource, { all: true });
    afterChange(`${labelOf(state.lastSource)} now fills every panel, each with its own crop.`);
  });
  $('mix-btn').addEventListener('click', () => {
    mixSources(state, SOURCE_IDS);
    afterChange('Mixed the gallery across the panels.');
  });
  const dropzone = $('dropzone');
  let depth = 0;
  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    depth++;
    dropzone.classList.add('over');
    e.preventDefault();
  });
  window.addEventListener('dragover', (e) => e.dataTransfer?.types?.includes('Files') && e.preventDefault());
  window.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (!depth) dropzone.classList.remove('over');
  });
  window.addEventListener('drop', async (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    depth = 0;
    dropzone.classList.remove('over');
    await useFile(e.dataTransfer.files[0]);
  });
}

/* ---------------------------------------------------------------- views and export */

function coverAt(sizeId, quality = 'export') {
  const size = SIZES.find((s) => s.id === sizeId) ?? sizeOf(state);
  const canvas = document.createElement('canvas');
  return renderer.renderPoster(canvas, { width: size.width, height: size.height, state: { ...state, size: size.id }, assets, quality });
}

async function refreshBox() {
  if (view !== 'box') return;
  const { buildBoxCase } = await loadShowcase();
  const rect = stage.getBoundingClientRect();
  const size = sizeOf(state);
  const height = Math.min(rect.height * 0.72, (rect.width * 0.62 * size.height) / size.width);
  boxView.replaceChildren(buildBoxCase(poster, { title: (state.caption.title || '').toUpperCase(), grade: gradeById(state.grade), height }));
}

async function setView(next) {
  if (next === 'showcase') {
    const { openShowcase } = await loadShowcase();
    const layout = layoutById(state.layout);
    openShowcase({ state, sizes: SIZES, renderCover: coverAt, grade: gradeById(state.grade), layoutName: layout.name, panels: layout.panels.length, onExport: triggerExport });
    setStatus('Showcase: the cover at export resolution, with every post size. Esc to return.');
    return;
  }
  view = next;
  for (const b of $('view-row').children) b.classList.toggle('active', b.dataset.view === view);
  posterWrap.hidden = view === 'box';
  boxView.hidden = view !== 'box';
  if (view === 'box') {
    await refreshBox();
    setStatus('3D box case: the live cover wrapped on a collector\'s case. Edits update it.');
  } else {
    fitPoster();
    drawOverlay();
  }
}

function setFormat(id) {
  exportFormat = id === 'jpeg' ? 'jpeg' : 'png';
  for (const b of $('format-row').children) b.classList.toggle('active', b.dataset.format === exportFormat);
  syncAll();
}

async function exportNow(format = exportFormat, download = true) {
  const { exportCover } = await loadExporter();
  return exportCover(state, assets, { format, download });
}

function triggerExport() {
  if (exportBusy) return;
  exportBusy = true;
  $('export-btn').classList.add('is-busy');
  const size = sizeOf(state);
  setStatus(`Painting ${size.width} × ${size.height} at export resolution…`);
  requestAnimationFrame(async () => {
    try {
      const result = await exportNow();
      window.__lastExport = { width: result.width, height: result.height, bytes: result.bytes, name: result.name, format: result.format };
      setStatus(`Exported ${result.name} · ${(result.bytes / 1048576).toFixed(2)} MB · ${result.width} × ${result.height}.`);
    } catch (error) {
      setStatus(`Export failed: ${error.message}`);
    } finally {
      exportBusy = false;
      $('export-btn').classList.remove('is-busy');
    }
  });
}

/* ---------------------------------------------------------------- boot */

async function boot() {
  // Stream the heavy modules in while the rails paint from the shell's own data.
  const heavy = Promise.all([
    import('./canvas-renderer.js'),
    loadArt(),
    ensureFonts(),
    loadStarterPhotos(),
  ]);
  buildLayouts();
  buildSizes();
  buildGrades();
  buildStickers();
  buildFx();
  buildCaptionControls();
  buildPacks();
  [renderer] = await heavy;
  buildGallery();
  bindPanelTools();
  bindCanvas();
  bindPhoto();
  bindKeyboard();
  $('export-btn').addEventListener('click', triggerExport);
  $('quick-export').addEventListener('click', triggerExport);
  $('undo-btn').addEventListener('click', () => travel(-1));
  $('redo-btn').addEventListener('click', () => travel(1));
  for (const b of $('format-row').children) b.addEventListener('click', () => setFormat(b.dataset.format));
  for (const b of $('view-row').children) b.addEventListener('click', () => setView(b.dataset.view));
  $('fx-reset').addEventListener('click', () => {
    state.fx = { ...FX_DEFAULTS };
    afterChange('Ink and paint back to the house recipe.');
  });

  const params = new URLSearchParams(location.search);
  if (DEMOS[params.get('demo')]) applyDemo(state, params.get('demo'));
  if (LAYOUTS.some((l) => l.id === params.get('layout'))) setLayout(state, params.get('layout'));
  if (SIZES.some((s) => s.id === params.get('size'))) setSize(state, params.get('size'));
  if (GRADES.some((g) => g.id === params.get('grade'))) state.grade = params.get('grade');
  const panel = Number(params.get('panel'));
  if (panel >= 1 && panel <= state.panels.length) state.activePanel = panel - 1;
  history.reset();
  syncHistory();
  refreshLayoutThumbs();
  syncAll();
  fitPoster();
  draw('preview');
  if (params.get('view') === 'box' || params.get('view') === 'showcase') await setView(params.get('view'));

  window.__vp = {
    state,
    assets,
    history,
    setDemo(name) {
      applyDemo(state, name);
      afterChange(`${name} demo loaded.`, true);
    },
    setFormat,
    setView,
    pickPanel,
    swap(a, b) {
      swapPanels(state, a, b);
      afterChange(`Swapped panel ${a + 1} with panel ${b + 1}.`);
    },
    undo: () => travel(-1),
    redo: () => travel(1),
    exportImage: (format = exportFormat) => exportNow(format, false),
    render: (quality = 'preview') => draw(quality),
  };
  window.addEventListener('resize', () => {
    if (view === 'box') refreshBox();
    else {
      fitPoster();
      drawOverlay();
    }
  });
  window.__shotReady = true;
}

boot().catch((error) => {
  setStatus(`The studio could not start: ${error.message}`);
  console.error(error);
});
