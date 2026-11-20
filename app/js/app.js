// Studio wiring: builds the rails, loads the eight sample photos and the user's own, keeps the
// controls, history and canvas in sync, and exports exact-size covers. The first load is this
// shell; the renderer and photo framing stream in with import() at boot, the exporter, quick
// covers and showcase on first use. ?shot=export shows nothing but the exported cover PNG.

import { buildGeometry, layoutById, LAYOUTS, panelAt, tracePanel } from './layouts.js';
import { FONT_STYLE_OPTIONS, FX_DEFAULTS, FX_META, GRADES, gradeById, swatchCss, TEXT_POSITIONS } from './looks.js';
import { assignMany, assignSource, createHistory, createState, mixSources, resetPanel, setLayout, setSize, SIZES, sizeOf, SOURCE_IDS, STICKERS, swapPanels } from './editor-state.js';

const $ = (id) => document.getElementById(id);
const [poster, overlay, stage, posterWrap, boxView, fillAll, compare] = ['poster', 'overlay', 'stage', 'poster-wrap', 'box-view', 'fill-all', 'compare'].map($);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const onClick = (id, fn) => ($(id).onclick = fn);
const assets = new Map();
const state = createState();
const history = createHistory(state);
const thumbs = new Map();
const lazy = {};
const uploads = [];
const CAPTION_FIELDS = { 'title-input': 'title', 'subtitle-input': 'subtitle', 'tagline-input': 'tagline', 'badge-input': 'badge', 'platform-input': 'platform' };
const MODULES = { renderer: () => import('./canvas-renderer.js'), subjects: () => import('./photo-subjects.js'), exporter: () => import('./exporter.js'), showcase: () => import('./showcase.js'), demos: () => import('./demos.js') };
let renderer = null;
let raf = 0;
let pending = 'preview';
let drag = null;
let swapFrom = null;
let busy = false;
let format = 'png';
let view = 'edit';
let split = 0.5;
const timers = {};

const setStatus = (text) => ($('status').textContent = text);
const labelOf = (id) => assets.get(id)?.label ?? id;
const later = (key, ms, fn) => (clearTimeout(timers[key]), (timers[key] = setTimeout(fn, ms)));
const load = (name) => (lazy[name] ??= MODULES[name]());
const fmtName = () => (format === 'jpeg' ? 'JPG' : 'PNG');
const NUDGE_STEP = 0.012;
const active = () => state.panels[state.activePanel];
const geometry = (w, h) => buildGeometry(layoutById(state.layout), w, h);
const sourceIds = () => [...uploads, ...SOURCE_IDS].filter((id) => assets.has(id));

// One small, self-dismissing card confirms what landed on disk: name, pixels and KB.
function dismissToast() {
  const toast = $('export-toast');
  if (!toast || toast.hidden) return;
  toast.classList.remove('is-in');
  later('toast', 180, () => (toast.hidden = true));
}

function showToast({ name, width, height, bytes }) {
  const toast = $('export-toast');
  if (!toast) return;
  $('toast-name').textContent = name;
  $('toast-meta').textContent = `${width} × ${height} · ${Math.max(1, Math.round(bytes / 1024))} KB`;
  toast.hidden = false;
  toast.classList.remove('is-in');
  void toast.offsetWidth; // restart the entrance animation on a repeat export
  toast.classList.add('is-in');
  later('toast', 3800, dismissToast);
}

function make(tag, cls = '', html = '') {
  const node = Object.assign(document.createElement(tag), { className: cls, innerHTML: html });
  if (tag === 'button') node.type = 'button';
  return node;
}

function rail(id, items, cls, paint, pick) {
  $(id).replaceChildren(...items.map((item) => {
    const button = make('button', cls);
    paint(button, item);
    button.onclick = () => pick(item);
    return button;
  }));
}

const loadImage = (src) => new Promise((resolve, reject) => Object.assign(new Image(), { onload: (e) => resolve(e.target), onerror: () => reject(new Error(`could not load ${src}`)), src }));

async function loadSamples() {
  const { PHOTO_SAMPLES } = await load('subjects');
  await Promise.all(PHOTO_SAMPLES.map(async (s) => {
    const image = await loadImage(new URL(`../samples/${s.id}.jpg`, import.meta.url).href);
    assets.set(s.id, { ...s, image, version: 1 });
  }));
}

async function ensureFonts() {
  try {
    await Promise.all(['900 100px "VP Display"', '700 100px "VP Text"', '400 100px "VP Text"', '700 100px "VP Editorial"'].map((f) => document.fonts.load(f)));
  } catch {
    // the fallback stacks in lettering.js still letter the cover
  }
}

function thumbCanvas(id, w, h) {
  const asset = assets.get(id);
  const canvas = Object.assign(make('canvas'), { width: w, height: h });
  if (!asset) return canvas;
  const key = `${id}:${asset.version}:${w}`;
  if (!thumbs.has(key)) thumbs.set(key, renderer.paintSourceThumb(make('canvas'), asset, w, h));
  canvas.getContext('2d').drawImage(thumbs.get(key), 0, 0);
  return canvas;
}

function schedule(quality = 'preview') {
  pending = quality;
  raf ||= requestAnimationFrame(() => {
    raf = 0;
    draw(pending);
    if (pending === 'draft') later('settle', 260, () => draw('preview'));
  });
}

function draw(quality = 'preview') {
  if (!renderer) return;
  const { width, height } = sizeOf(state);
  renderer.renderPoster(poster, { width, height, state, assets, quality, record: true });
  drawOverlay();
  if (view === 'box') later('box', quality === 'draft' ? 220 : 0, refreshBox);
}

function drawOverlay() {
  const { width, height } = sizeOf(state);
  Object.assign(overlay, { width, height });
  const panel = geometry(width, height).panels[state.activePanel];
  if (!panel) return;
  const ctx = overlay.getContext('2d');
  const unit = Math.min(width, height);
  const color = swapFrom != null ? '#50e8ff' : '#ff3b8d';
  const tag = Math.max(14, unit * 0.024);
  const label = `P${panel.index + 1} · ${labelOf(active().source).toUpperCase()}${swapFrom != null ? ' ⇄ ?' : ''}`;
  tracePanel(ctx, panel.points);
  Object.assign(ctx, { fillStyle: `${color}12`, strokeStyle: color, lineWidth: Math.max(3, unit * 0.005), shadowColor: color, shadowBlur: unit * 0.02 });
  ctx.fill();
  ctx.setLineDash([unit * 0.016, unit * 0.01]);
  ctx.stroke();
  Object.assign(ctx, { shadowBlur: 0, font: `900 ${tag * 0.66}px 'VP Text', sans-serif`, textBaseline: 'middle', fillStyle: color });
  const tw = ctx.measureText(label).width + tag;
  const x = Math.min(Math.max(6, panel.box.x + tag * 0.5), width - tw - 6);
  const y = Math.min(Math.max(6, panel.box.y + tag * 0.5), height - tag * 2);
  ctx.beginPath();
  ctx.roundRect(x, y, tw, tag * 1.35, tag * 0.3);
  ctx.fill();
  ctx.fillStyle = '#0a0a0d';
  ctx.fillText(label, x + tag * 0.5, y + tag * 0.7);
}

function fitPoster() {
  const { width, height } = sizeOf(state);
  const rect = stage.getBoundingClientRect();
  const k = Math.min(Math.max(160, rect.width - 28) / width, Math.max(160, rect.height - 40) / height);
  posterWrap.style.width = `${Math.round(width * k)}px`;
  posterWrap.style.height = `${Math.round(height * k)}px`;
}

function refreshCompare(delay = 0) {
  later('compare', delay, () => {
    const panel = active();
    const asset = panel && assets.get(panel.source);
    if (!renderer || !asset) return;
    renderer.paintCompare(compare, asset, gradeById(panel.gradeOverride !== 'global' ? panel.gradeOverride : state.grade), state.fx, split);
    $('compare-note').textContent = `${asset.label} → GTA paint`;
  });
}

function commit() {
  history.commit();
  $('undo-btn').disabled = !history.canUndo;
  $('redo-btn').disabled = !history.canRedo;
}

function travel(dir) {
  if (!(dir < 0 ? history.undo() : history.redo())) return;
  refresh(dir < 0 ? 'Undone.' : 'Redone.', true);
}

function refresh(message, refit = false) {
  commit();
  if (!renderer) return;
  syncAll();
  if (refit) fitPoster();
  draw('preview');
  if (message) setStatus(message);
}

function paintLayoutThumb(canvas, layout, grade) {
  const [w, h] = [(canvas.width = 120), (canvas.height = 72)];
  const ctx = canvas.getContext('2d');
  const geo = buildGeometry(layout, w, h);
  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(0, 0, w, h);
  geo.panels.forEach((panel, i) => {
    const g = ctx.createLinearGradient(0, panel.box.y, 0, panel.box.y + panel.box.h);
    g.addColorStop(0, grade.sky[i % 3]);
    g.addColorStop(1, grade.stops[2 + (i % 3)]);
    tracePanel(ctx, panel.points);
    ctx.fillStyle = g;
    ctx.fill();
  });
  const tz = geo.zones.title;
  for (const [fill, dy, k, bh] of [['#fff1d0', 0.32, 0.72, 6], [grade.accent, 0.66, 0.42, 4]]) {
    ctx.fillStyle = fill;
    ctx.fillRect(tz.x + (tz.w * (1 - k)) / 2, tz.y + tz.h * dy, tz.w * k, bh);
  }
}

function buildRails() {
  rail('layout-grid', LAYOUTS, 'layout-card', (b, l) => {
    Object.assign(b, { title: `${l.name} — ${l.note}` });
    b.dataset.layout = l.id;
    b.append(make('canvas'), make('span', '', `${l.name}`));
  }, (l) => {
    setLayout(state, l.id);
    state.activePanel = 0;
    refresh(`${l.name}: ${l.panels.length} panels, each photo framed on its subject.`, true);
  });
  rail('size-grid', SIZES, 'size-btn', (b, s) => {
    const r = s.width / s.height;
    b.dataset.size = s.id;
    b.innerHTML = `<i style="width:${r >= 1 ? 20 : 16 * r}px;height:${r >= 1 ? 20 / r : 16}px"></i><strong>${s.ratio}</strong><em>${s.width}×${s.height}</em>`;
  }, (s) => refresh(`Post size ${setSize(state, s.id) && s.width} × ${s.height}: the export is pixel-exact.`, true));
  rail('export-sizes', SIZES, 'xs-btn', (b, s) => {
    b.dataset.size = s.id;
    b.title = `Export ${s.width} × ${s.height} in one click`;
    b.innerHTML = `<strong>${s.width}×${s.height}</strong><em>${s.ratio} ${s.label}</em>`;
  }, (s) => triggerExport(s.id));
  rail('grade-list', GRADES, 'grade-btn', (b, g) => {
    b.dataset.grade = g.id;
    b.innerHTML = `<i style="background:${swatchCss(g)}"></i><span>${g.name}</span>`;
  }, (g) => {
    state.grade = g.id;
    refreshLayoutThumbs();
    refresh(`${g.name} grade across every panel.`);
  });
  rail('sticker-list', STICKERS, 'sticker-btn', (b, s) => {
    Object.assign(b, { title: s.hint, innerHTML: `<i></i>${s.name}` });
    b.dataset.sticker = s.key;
  }, (s) => refresh(`${s.name} ${(state.stickers[s.key] = !state.stickers[s.key]) ? 'on' : 'off'}.`));
  $('fx-controls').replaceChildren(...FX_META.map((m) => {
    const row = make('label', 'fx-row', `<span title="${m.hint}">${m.name}</span><input type="range" min="0" max="100" data-fx="${m.key}"><output></output>`);
    const input = row.querySelector('input');
    input.oninput = () => {
      state.fx[m.key] = input.value / 100;
      input.nextSibling.textContent = input.value;
      schedule('draft');
    };
    input.onchange = () => (refresh(), refreshCompare());
    return row;
  }));
  const options = (id, list) => ($(id).innerHTML = list.map((o) => `<option value="${o.id}">${o.label ?? o.name}</option>`).join(''));
  options('font-select', FONT_STYLE_OPTIONS);
  options('position-select', TEXT_POSITIONS);
  options('panel-grade', [{ id: 'global', label: 'Cover grade' }, ...GRADES]);
  $('font-select').onchange = (e) => refresh(`${FONT_STYLE_OPTIONS.find((o) => o.id === (state.fontStyle = e.target.value)).label} lettering.`);
  $('position-select').onchange = (e) => refresh(`Title: ${TEXT_POSITIONS.find((o) => o.id === (state.textPosition = e.target.value)).label}.`);
  for (const [id, key] of Object.entries(CAPTION_FIELDS)) {
    $(id).oninput = (e) => {
      state.caption[key] = e.target.value;
      schedule('draft');
    };
    $(id).onchange = () => refresh('Caption updated.');
  }
}

const refreshLayoutThumbs = () => {
  for (const b of $('layout-grid').children) paintLayoutThumb(b.firstChild, layoutById(b.dataset.layout), gradeById(state.grade));
};

function placeSource(id) {
  assignSource(state, id, { all: fillAll.checked });
  refresh(fillAll.checked ? `${labelOf(id)} fills all ${state.panels.length} panels, each with its own shot.` : `${labelOf(id)} → panel ${state.activePanel + 1}.`);
}

function buildGallery() {
  rail('gallery', sourceIds(), 'gallery-tile', (b, id) => {
    const asset = assets.get(id);
    b.classList.toggle('is-upload', uploads.includes(id));
    Object.assign(b, { title: `${asset.label}${asset.note ? ` — ${asset.note}` : ''}. Click to place in the selected panel.` });
    b.dataset.source = id;
    b.append(thumbCanvas(id, 96, 64), make('span', '', asset.label));
  }, placeSource);
}

function pickPanel(index) {
  const from = swapFrom;
  swapFrom = null;
  $('swap-btn').classList.remove('on');
  state.activePanel = index;
  if (from != null && from !== index) return refresh(`Swapped panel ${swapPanels(state, from, index) && from + 1} with panel ${index + 1}.`);
  syncPanel();
  drawOverlay();
}

function syncAll() {
  const layout = layoutById(state.layout);
  const size = sizeOf(state);
  const grade = gradeById(state.grade);
  const mark = (id, key, on, cls = 'active') => {
    for (const b of $(id).children) b.classList.toggle(cls, on(b.dataset[key]));
  };
  mark('layout-grid', 'layout', (v) => v === layout.id);
  mark('size-grid', 'size', (v) => v === size.id);
  mark('export-sizes', 'size', (v) => v === size.id);
  mark('grade-list', 'grade', (v) => v === state.grade);
  mark('sticker-list', 'sticker', (v) => !!state.stickers[v], 'on');
  mark('format-row', 'format', (v) => v === format);
  const dims = `${size.width} × ${size.height}`;
  const text = {
    'layout-name': layout.name, 'grade-name': grade.name, 'size-note': `${size.ratio} · ${size.label}`, 'stage-size': `${dims} px`,
    'stage-spec': `${layout.panels.length} painted panels · ${grade.name}`, 'export-label': `Export ${fmtName()} · ${size.ratio}`,
    'export-dim': `${dims} px · straight from the canvas`, 'quick-export': `↓ Export ${fmtName()}`, 'font-note': FONT_STYLE_OPTIONS.find((o) => o.id === state.fontStyle)?.label,
  };
  for (const [id, value] of Object.entries(text)) $(id).textContent = value;
  for (const [id, key] of Object.entries(CAPTION_FIELDS)) if (document.activeElement !== $(id)) $(id).value = state.caption[key] ?? '';
  $('font-select').value = state.fontStyle;
  $('position-select').value = state.textPosition;
  for (const input of $('fx-controls').querySelectorAll('input')) input.nextSibling.textContent = input.value = Math.round(state.fx[input.dataset.fx] * 100);
  rail('panel-list', state.panels.map((p, i) => [p, i]), 'panel-chip', (b, [p, i]) => {
    b.dataset.panel = i;
    b.title = `Panel ${i + 1}: ${labelOf(p.source)}`;
    b.append(thumbCanvas(p.source, 64, 40), make('b', '', `P${i + 1}`));
  }, ([, i]) => pickPanel(i));
  syncPanel();
}

function syncPanel() {
  const panel = active();
  if (!panel) return;
  for (const b of $('panel-list').children) b.classList.toggle('active', +b.dataset.panel === state.activePanel);
  for (const b of $('gallery').children) b.classList.toggle('active', b.dataset.source === panel.source);
  $('active-label').textContent = `PANEL ${String(state.activePanel + 1).padStart(2, '0')} · ${labelOf(panel.source).toUpperCase()}`;
  const zoom = panel.manualFocus ? panel.zoom : renderer?.framing[state.activePanel]?.zoom ?? panel.zoom;
  $('zoom-range').value = zoom;
  $('zoom-out').textContent = `${zoom.toFixed(2)}×${panel.manualFocus ? '' : ' auto'}`;
  $('rotate-range').value = panel.rotate;
  $('rotate-out').textContent = `${panel.rotate}°`;
  $('flip-btn').classList.toggle('on', !!panel.flip);
  $('shot-select').value = panel.shot ?? 'medium';
  $('panel-grade').value = panel.gradeOverride || 'global';
  refreshCompare(120);
}

// A manual edit starts from the crop the smart framing chose, so nothing jumps.
function takeOver(panel, index) {
  const plan = renderer?.framing[index];
  if (!panel.manualFocus && plan) Object.assign(panel, { zoom: plan.fit ? 1 : plan.zoom, focusX: plan.fx, focusY: plan.fy });
  panel.manualFocus = true;
  return plan;
}

function eventPanel(event) {
  const rect = overlay.getBoundingClientRect();
  if (!rect.width) return null;
  return panelAt(geometry(overlay.width, overlay.height), ((event.clientX - rect.left) / rect.width) * overlay.width, ((event.clientY - rect.top) / rect.height) * overlay.height);
}

function bindCanvas() {
  overlay.onpointerdown = (event) => {
    const panel = eventPanel(event);
    if (!panel) return;
    const swapping = swapFrom != null;
    pickPanel(panel.index);
    if (swapping) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panel: panel.index, moved: false };
    overlay.setPointerCapture(event.pointerId);
    overlay.classList.add('dragging');
  };
  overlay.onpointermove = (event) => {
    if (event.pointerId !== drag?.id) return;
    const rect = overlay.getBoundingClientRect();
    const panel = state.panels[drag.panel];
    const plan = takeOver(panel, drag.panel) ?? { tw: 1, sw: 1, scale: 1, th: 1, sh: 1 };
    const { box } = geometry(overlay.width, overlay.height).panels[drag.panel];
    const scale = plan.fit || plan.scale;
    const viewW = plan.tw / (plan.sw * scale);
    const viewH = plan.th / (plan.sh * scale);
    const dx = (((event.clientX - drag.x) / rect.width) * overlay.width) / box.w;
    const dy = (((event.clientY - drag.y) / rect.height) * overlay.height) / box.h;
    panel.focusX = Math.max(0, Math.min(1, panel.focusX - dx * viewW * (panel.flip ? -1 : 1)));
    panel.focusY = Math.max(0, Math.min(1, panel.focusY - dy * viewH));
    Object.assign(drag, { x: event.clientX, y: event.clientY, moved: true });
    schedule('draft');
  };
  overlay.onpointerup = overlay.onpointercancel = (event) => {
    if (event.pointerId !== drag?.id) return;
    const { moved } = drag;
    drag = null;
    overlay.classList.remove('dragging');
    if (moved) refresh(`Panel ${state.activePanel + 1} reframed: the crop is kept per panel.`);
  };
  overlay.addEventListener('wheel', (event) => {
    const panel = eventPanel(event);
    if (panel) state.activePanel = panel.index;
    const cfg = active();
    if (!cfg) return;
    event.preventDefault();
    takeOver(cfg, state.activePanel);
    cfg.zoom = Math.min(3, Math.max(1, cfg.zoom * Math.exp(-event.deltaY * 0.0012)));
    syncPanel();
    schedule('draft');
    later('wheel', 220, () => refresh(`Panel ${state.activePanel + 1} zoom ${cfg.zoom.toFixed(2)}×.`));
  }, { passive: false });
  let comparing = false;
  const slide = (event) => {
    const r = compare.getBoundingClientRect();
    split = Math.max(0.05, Math.min(0.95, (event.clientX - r.left) / r.width));
    refreshCompare();
  };
  compare.onpointerdown = (event) => {
    comparing = true;
    compare.setPointerCapture(event.pointerId);
    slide(event);
  };
  compare.onpointermove = (event) => comparing && slide(event);
  compare.onpointerup = () => (comparing = false);
}

// Selected-panel crop controls: shot, grade, zoom, rotate, flip, reset and the swap arming.
function bindPanelControls() {
  $('panel-grade').onchange = (e) => refresh(`Panel ${state.activePanel + 1} grade: ${(active().gradeOverride = e.target.value)}.`);
  $('shot-select').onchange = (e) => {
    Object.assign(active(), { shot: e.target.value, manualFocus: false });
    refresh(`Panel ${state.activePanel + 1}: ${e.target.selectedOptions[0].text.toLowerCase()}, framed on its subject.`);
  };
  $('zoom-range').oninput = () => {
    takeOver(active(), state.activePanel);
    active().zoom = +$('zoom-range').value;
    $('zoom-out').textContent = `${active().zoom.toFixed(2)}×`;
    schedule('draft');
  };
  $('rotate-range').oninput = () => {
    active().rotate = +$('rotate-range').value;
    $('rotate-out').textContent = `${active().rotate}°`;
    schedule('draft');
  };
  $('zoom-range').onchange = $('rotate-range').onchange = () => refresh();
  onClick('flip-btn', () => refresh(`Panel ${state.activePanel + 1} ${(active().flip = !active().flip) ? 'flipped' : 'unflipped'}.`));
  onClick('reset-panel', () => refresh(`Panel ${resetPanel(state) && state.activePanel + 1} back to its smart crop.`));
  onClick('swap-btn', () => {
    swapFrom = swapFrom == null ? state.activePanel : null;
    $('swap-btn').classList.toggle('on', swapFrom != null);
    drawOverlay();
    setStatus(swapFrom != null ? `Swap: pick the panel to trade with panel ${swapFrom + 1}.` : 'Swap cancelled.');
  });
  fillAll.onchange = () => fillAll.checked && placeSource(active().source);
}

// Export buttons, the PNG/JPG switch and the toast's own dismiss button.
function bindExportActions() {
  onClick('export-btn', () => triggerExport());
  onClick('quick-export', () => triggerExport());
  onClick('toast-close', dismissToast);
  for (const b of $('format-row').children) b.onclick = () => setFormat(b.dataset.format);
}

// One arrow press nudges the selected panel's crop; Shift takes a 5× step. Sliders and text
// fields keep their native arrow behaviour.
const nudgeLabel = (dx, dy) => `${dx ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'} ${((Math.abs(dx) + Math.abs(dy)) * NUDGE_STEP).toFixed(2)}`;

function nudgeCrop(dx, dy) {
  const panel = active();
  if (!panel) return;
  takeOver(panel, state.activePanel);
  panel.focusX = clamp01(panel.focusX + dx * NUDGE_STEP);
  panel.focusY = clamp01(panel.focusY + dy * NUDGE_STEP);
  schedule('draft');
  later('nudge', 280, () => refresh(`Panel ${state.activePanel + 1} crop nudged ${nudgeLabel(dx, dy)}.`));
}

function bindKeyboardShortcuts() {
  window.addEventListener('keydown', (event) => {
    const element = event.target;
    const typing = /INPUT|SELECT|TEXTAREA/.test(element.tagName) || element.isContentEditable;
    const key = event.key.toLowerCase();
    const n = state.panels.length;
    const command = event.metaKey || event.ctrlKey;
    if (command && (key === 'e' || (!typing && /^[zy]$/.test(key)))) {
      event.preventDefault();
      if (key === 'e') triggerExport();
      else travel(key === 'y' || event.shiftKey ? 1 : -1);
    } else if (!typing && event.key.startsWith('Arrow') && !command && !event.altKey) {
      const step = event.shiftKey ? 5 : 1;
      const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
      const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
      event.preventDefault();
      nudgeCrop(dx, dy);
    } else if (!typing && (key === '[' || key === ']')) pickPanel((state.activePanel + (key === ']' ? 1 : n - 1)) % n);
    else if (!typing && /^[1-9]$/.test(key) && +key <= n) pickPanel(key - 1);
  });
}

function bindTools() {
  bindPanelControls();
  bindExportActions();
  bindKeyboardShortcuts();
  onClick('undo-btn', () => travel(-1));
  onClick('redo-btn', () => travel(1));
  onClick('fx-reset', () => {
    state.fx = { ...FX_DEFAULTS };
    refresh('Ink and paint back to the house recipe.');
  });
  onClick('mix-btn', () => refresh(`Shuffled the photos across the panels${mixSources(state, sourceIds()) && '.'}`));
  for (const b of document.querySelectorAll('.quick-btn')) b.onclick = () => setDemo(b.dataset.demo);
  for (const b of $('view-row').children) b.onclick = () => setView(b.dataset.view);
}

// Reads every dropped or picked image on this machine, finds its subject and places it: one photo
// goes to the selected panel (or every panel with Fill on), several go to consecutive panels.
async function useFiles(list) {
  const files = [...(list ?? [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return setStatus('That is not an image. Choose a JPG, PNG or WEBP.');
  const { detectSubject } = await load('subjects');
  const added = [];
  for (const file of files.slice(0, 12)) {
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      const id = `upload-${uploads.length + 1}`;
      const label = file.name.replace(/\.[^.]+$/, '').slice(0, 22) || 'Your photo';
      assets.set(id, { id, label, note: 'your photo', image, version: 1, subject: detectSubject(image) });
      uploads.unshift(id);
      added.push(id);
    } catch {
      setStatus(`${file.name} could not be decoded.`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (!added.length) return;
  if (added.length === 1) assignSource(state, added[0], { all: fillAll.checked });
  else assignMany(state, added.reverse());
  buildGallery();
  const first = labelOf(added[0]);
  refresh(added.length > 1 ? `${added.length} photos placed from panel ${state.activePanel + 1} on.` : fillAll.checked ? `${first} fills all ${state.panels.length} panels, each with its own shot.` : `${first} → panel ${state.activePanel + 1}, framed on the face.`);
}

function bindPhoto() {
  const zone = $('dropzone');
  const files = (e) => e.dataTransfer?.types?.includes('Files');
  let depth = 0;
  $('file').onchange = async (e) => {
    await useFiles(e.target.files);
    e.target.value = '';
  };
  window.addEventListener('dragenter', (e) => files(e) && (e.preventDefault(), zone.classList.add('over'), depth++));
  window.addEventListener('dragover', (e) => files(e) && e.preventDefault());
  window.addEventListener('dragleave', () => (depth = Math.max(0, depth - 1)) || zone.classList.remove('over'));
  window.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    depth = 0;
    zone.classList.remove('over');
    const panel = eventPanel(e);
    if (panel) state.activePanel = panel.index;
    useFiles(e.dataTransfer.files);
  });
}

function coverAt(sizeId, quality = 'export') {
  const size = SIZES.find((s) => s.id === sizeId) ?? sizeOf(state);
  return renderer.renderPoster(make('canvas'), { width: size.width, height: size.height, state: { ...state, size: size.id }, assets, quality });
}

async function refreshBox() {
  if (view !== 'box') return;
  const { buildBoxCase } = await load('showcase');
  const rect = stage.getBoundingClientRect();
  const { width, height } = sizeOf(state);
  boxView.replaceChildren(buildBoxCase(poster, { title: (state.caption.title || '').toUpperCase(), grade: gradeById(state.grade), height: Math.min(rect.height * 0.72, (rect.width * 0.62 * height) / width) }));
}

async function setView(next) {
  if (next === 'showcase') {
    const layout = layoutById(state.layout);
    (await load('showcase')).openShowcase({ state, sizes: SIZES, renderCover: coverAt, grade: gradeById(state.grade), layoutName: layout.name, panels: layout.panels.length, onExport: triggerExport });
    return setStatus('Showcase: the cover at export resolution with all three post sizes. Esc to return.');
  }
  view = next;
  for (const b of $('view-row').children) b.classList.toggle('active', b.dataset.view === view);
  posterWrap.hidden = view === 'box';
  boxView.hidden = view !== 'box';
  if (view !== 'box') return fitPoster(), drawOverlay();
  await refreshBox();
  setStatus("3D box: the live cover wrapped on a collector's case. Edits update it.");
}

function setFormat(id) {
  format = id === 'jpeg' ? 'jpeg' : 'png';
  syncAll();
}

async function setDemo(name) {
  (await load('demos')).applyDemo(state, name);
  refreshLayoutThumbs();
  refresh(`${document.querySelector(`[data-demo="${name}"]`)?.textContent ?? name} loaded: every panel a different photo.`, true);
}

const exportNow = async (fmt = format, download = true, size) => (await load('exporter')).exportCover(state, assets, { format: fmt, download, size });

function triggerExport(size) {
  if (busy) return;
  busy = true;
  $('export-btn').classList.add('is-busy');
  const target = SIZES.find((s) => s.id === size) ?? sizeOf(state);
  setStatus(`Painting ${target.width} × ${target.height} at full resolution…`);
  requestAnimationFrame(async () => {
    try {
      const { width, height, bytes, name } = await exportNow(format, true, target.id);
      window.__lastExport = { width, height, bytes, name, format };
      setStatus(`Exported ${name} · ${(bytes / 1048576).toFixed(2)} MB · ${width} × ${height}.`);
      showToast({ name, width, height, bytes });
    } catch (error) {
      setStatus(`Export failed: ${error.message}`);
    } finally {
      busy = false;
      $('export-btn').classList.remove('is-busy');
    }
  });
}

// ?shot=export: the page becomes the exported PNG itself, full-bleed at its own pixel size.
async function showExport() {
  const { url, width, height, bytes } = await (await load('exporter')).exportDataUrl(state, assets);
  const img = Object.assign(new Image(), { src: url, width, height, alt: 'Exported cover' });
  await img.decode();
  document.body.replaceChildren(img);
  document.body.className = 'export-shot';
  window.__exportPng = { url, width, height, bytes };
}

async function boot() {
  const heavy = Promise.all([load('renderer'), loadSamples(), ensureFonts()]);
  buildRails();
  [renderer] = await heavy;
  buildGallery();
  bindCanvas();
  bindTools();
  bindPhoto();
  const params = new URLSearchParams(location.search);
  const param = (key, list) => list.some((item) => item.id === params.get(key)) && params.get(key);
  if (params.get('demo')) (await load('demos')).applyDemo(state, params.get('demo'));
  if (param('layout', LAYOUTS)) setLayout(state, params.get('layout'));
  if (param('size', SIZES)) setSize(state, params.get('size'));
  if (param('grade', GRADES)) state.grade = params.get('grade');
  const panel = +params.get('panel');
  if (panel >= 1 && panel <= state.panels.length) state.activePanel = panel - 1;
  window.__vp = {
    state, assets, history, setFormat, setView, pickPanel, setDemo, useFiles,
    swap: (a, b) => refresh(`Swapped panel ${swapPanels(state, a, b) && a + 1} with panel ${b + 1}.`),
    undo: () => travel(-1),
    redo: () => travel(1),
    exportImage: (fmt = format, size) => exportNow(fmt, false, size),
    render: (quality) => draw(quality),
  };
  if (params.get('shot') === 'export') {
    await showExport();
    window.__shotReady = true;
    return;
  }
  history.reset();
  commit();
  refreshLayoutThumbs();
  syncAll();
  fitPoster();
  draw();
  if (['box', 'showcase'].includes(params.get('view'))) await setView(params.get('view'));
  window.addEventListener('resize', () => (view === 'box' ? refreshBox() : (fitPoster(), drawOverlay())));
  window.__shotReady = true;
}

boot().catch((error) => {
  setStatus(`The studio could not start: ${error.message}`);
  console.error(error);
});
