// Studio wiring: builds the rails, registers the shipped photos and inked scenes, keeps controls,
// history and canvas in sync, and exports exact-size covers. First load is this shell only: the
// renderer, art and photo framing stream in with import(), the exporter and showcase on first use.

import { buildGeometry, layoutById, LAYOUTS, panelAt, tracePanel } from './layouts.js';
import { FONT_STYLE_OPTIONS, FX_DEFAULTS, FX_META, GRADES, gradeById, swatchCss, TEXT_POSITIONS } from './looks.js';
import { assignPack, assignSource, createHistory, createState, mixSources, PACKS, resetPanel, setLayout, setSize, SIZES, sizeOf, SOURCE_IDS, STICKERS, swapPanels } from './editor-state.js';

const $ = (id) => document.getElementById(id);
const [poster, overlay, stage, posterWrap, boxView, fillAll] = ['poster', 'overlay', 'stage', 'poster-wrap', 'box-view', 'fill-all'].map($);
const assets = new Map();
const state = createState();
const history = createHistory(state);
const thumbs = new Map();
const lazy = {};
const CAPTION_FIELDS = { 'title-input': 'title', 'subtitle-input': 'subtitle', 'tagline-input': 'tagline', 'badge-input': 'badge', 'platform-input': 'platform' };
let renderer = null;
let raf = 0;
let pending = 'preview';
let drag = null;
let swapFrom = null;
let busy = false;
let format = 'png';
let view = 'edit';
let timers = {};

const setStatus = (text) => ($('status').textContent = text);
const labelOf = (id) => assets.get(id)?.label ?? id;
const later = (key, ms, fn) => (clearTimeout(timers[key]), (timers[key] = setTimeout(fn, ms)));
const MODULES = { renderer: () => import('./canvas-renderer.js'), scenes: () => import('./art/scenes.js'), subjects: () => import('./photo-subjects.js'), exporter: () => import('./exporter.js'), showcase: () => import('./showcase.js'), demos: () => import('./demos.js') };
const load = (name) => (lazy[name] ??= MODULES[name]());
const fmtName = () => (format === 'jpeg' ? 'JPG' : 'PNG');
const active = () => state.panels[state.activePanel];
const geometry = (w, h) => buildGeometry(layoutById(state.layout), w, h);

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

async function loadSources() {
  const [{ illustratedAssets }, { PHOTO_SUBJECTS }, ...photos] = await Promise.all([load('scenes'), load('subjects'), ...['boulevard', 'pier'].map((n) => loadImage(new URL(`../samples/${n}.jpg`, import.meta.url).href))]);
  for (const asset of illustratedAssets()) assets.set(asset.id, asset);
  ['boulevard', 'pier'].forEach((id, i) => assets.set(id, { id, label: `${id[0].toUpperCase()}${id.slice(1)} photo`, image: photos[i], version: 1, subject: PHOTO_SUBJECTS[id] }));
}

async function ensureFonts() {
  try {
    await Promise.all(['900 100px "VP Display"', '700 100px "VP Text"', '400 100px "VP Text"', '700 100px "VP Editorial"'].map((f) => document.fonts.load(f)));
  } catch {
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
  });
}

function draw(quality = 'preview') {
  if (!renderer) return;
  const { width, height } = sizeOf(state);
  renderer.renderPoster(poster, { width, height, state, assets, quality });
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
  const tag = Math.max(13, unit * 0.022);
  const label = `P${panel.index + 1}${swapFrom != null ? ' ⇄ ?' : ''}`;
  tracePanel(ctx, panel.points);
  Object.assign(ctx, { fillStyle: `${color}10`, strokeStyle: color, lineWidth: Math.max(2, unit * 0.0045), shadowColor: color, shadowBlur: unit * 0.02 });
  ctx.fill();
  ctx.setLineDash([unit * 0.014, unit * 0.009]);
  ctx.stroke();
  Object.assign(ctx, { shadowBlur: 0, font: `900 ${tag * 0.7}px 'VP Text', sans-serif`, textBaseline: 'middle', fillStyle: color });
  const tw = ctx.measureText(label).width + tag;
  const x = Math.min(Math.max(6, panel.points[0].x + tag * 0.4), width - tw - 6);
  const y = Math.min(Math.max(6, panel.points[0].y + tag * 0.4), height - tag * 2);
  ctx.beginPath();
  ctx.roundRect(x, y, tw, tag * 1.4, tag * 0.3);
  ctx.fill();
  ctx.fillStyle = '#0a0a0d';
  ctx.fillText(label, x + tag * 0.5, y + tag * 0.72);
}

function fitPoster() {
  const { width, height } = sizeOf(state);
  const rect = stage.getBoundingClientRect();
  const k = Math.min(Math.max(160, rect.width - 40) / width, Math.max(160, rect.height - 44) / height);
  posterWrap.style.width = `${Math.round(width * k)}px`;
  posterWrap.style.height = `${Math.round(height * k)}px`;
}

function refreshCompare(delay = 0) {
  later('compare', delay, () => {
    const panel = active();
    const asset = panel && assets.get(panel.source);
    if (renderer && asset) renderer.paintCompare($('compare'), asset, gradeById(panel.gradeOverride !== 'global' ? panel.gradeOverride : state.grade), state.fx);
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
  ctx.fillStyle = '#0a0a0d';
  ctx.fillRect(0, 0, w, h);
  layout.panels.forEach((panel, i) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, grade.stops[(i + 1) % 5]);
    g.addColorStop(1, grade.stops[(i + 3) % 5]);
    tracePanel(ctx, panel.points.map((p) => ({ x: p.x * w, y: p.y * h })));
    ctx.fillStyle = g;
    ctx.fill();
  });
  const tz = layout.zones.title;
  for (const [fill, dy, k, bh] of [['#fff1d0', 0.3, 0.7, 5], [grade.accent, 0.62, 0.45, 4]]) {
    ctx.fillStyle = fill;
    ctx.fillRect(tz.x * w, (tz.y + tz.h * dy) * h, tz.w * w * k, bh);
  }
}

function buildRails() {
  rail('layout-grid', LAYOUTS, 'layout-card', (b, l) => {
    Object.assign(b, { title: `${l.name} — ${l.note}` });
    b.dataset.layout = l.id;
    b.append(make('canvas'), make('span', '', l.name));
  }, (l) => {
    setLayout(state, l.id);
    state.activePanel = 0;
    refresh(`${l.name}: ${l.panels.length} panels · drag any cut to reframe.`, true);
  });
  rail('size-grid', SIZES, 'size-btn', (b, s) => {
    const r = s.width / s.height;
    b.dataset.size = s.id;
    b.innerHTML = `<i style="width:${r >= 1 ? 20 : 16 * r}px;height:${r >= 1 ? 20 / r : 16}px"></i><strong>${s.ratio}</strong><em>${s.width}×${s.height}</em>`;
  }, (s) => refresh(`Post size ${setSize(state, s.id) && s.width} × ${s.height} — export stays pixel-exact.`, true));
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
  rail('pack-row', PACKS, 'pack-btn', (b, p) => (b.textContent = p.label), (p) => refresh(`${assignPack(state, p.sources) && p.label} pack across ${state.panels.length} panels.`));
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
  options('panel-grade', [{ id: 'global', label: 'Global grade' }, ...GRADES]);
  $('font-select').onchange = (e) => refresh(`${FONT_STYLE_OPTIONS.find((o) => o.id === (state.fontStyle = e.target.value)).label} lettering.`);
  $('position-select').onchange = (e) => refresh(`Title ${(state.textPosition = e.target.value)}.`);
  for (const [id, key] of Object.entries(CAPTION_FIELDS)) {
    $(id).oninput = (e) => {
      state.caption[key] = e.target.value;
      schedule('draft');
    };
    $(id).onchange = () => refresh();
  }
}

const refreshLayoutThumbs = () => {
  for (const b of $('layout-grid').children) paintLayoutThumb(b.firstChild, layoutById(b.dataset.layout), gradeById(state.grade));
};

function buildGallery() {
  rail('gallery', ['upload', ...SOURCE_IDS].filter((id) => assets.has(id)), 'gallery-tile', (b, id) => {
    const asset = assets.get(id);
    b.classList.toggle('is-photo', !asset.illustrated);
    Object.assign(b, { title: `${asset.label} — click to place` });
    b.dataset.source = id;
    b.append(thumbCanvas(id, 96, 62), make('span', '', asset.label));
  }, (id) => {
    assignSource(state, (state.lastSource = id), { all: fillAll.checked });
    $('apply-all').disabled = false;
    refresh(fillAll.checked ? `${labelOf(id)} in every panel, each with its own crop.` : `${labelOf(id)} → panel ${state.activePanel + 1}.`);
  });
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
  mark('grade-list', 'grade', (v) => v === state.grade);
  mark('sticker-list', 'sticker', (v) => !!state.stickers[v], 'on');
  mark('format-row', 'format', (v) => v === format);
  const dims = `${size.width} × ${size.height}`;
  const text = {
    'layout-name': layout.name, 'grade-name': grade.name, 'size-note': `${size.ratio} · ${size.label}`, 'stage-size': `${dims} px`,
    'stage-spec': `CANVAS 2D · ${layout.panels.length} CUTS · ${grade.name}`, 'export-size-note': dims, 'export-label': `Export ${fmtName()}`,
    'export-dim': `${dims} · ${size.ratio} · offline`, 'quick-export': `↓ Export ${fmtName()}`, 'font-note': FONT_STYLE_OPTIONS.find((o) => o.id === state.fontStyle)?.label,
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
  $('zoom-range').value = panel.zoom;
  $('zoom-out').textContent = `${panel.zoom.toFixed(2)}×`;
  $('rotate-range').value = panel.rotate;
  $('rotate-out').textContent = `${panel.rotate}°`;
  $('flip-btn').classList.toggle('on', !!panel.flip);
  $('panel-grade').value = panel.gradeOverride || 'global';
  refreshCompare(120);
}

function eventPanel(event) {
  const rect = overlay.getBoundingClientRect();
  if (!rect.width) return null;
  return panelAt(geometry(overlay.width, overlay.height), ((event.clientX - rect.left) / rect.width) * overlay.width, ((event.clientY - rect.top) / rect.height) * overlay.height);
}

function bindCanvas() {
  const clampFocus = (v) => Math.max(-0.35, Math.min(1.35, v));
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
    const { box } = geometry(overlay.width, overlay.height).panels[drag.panel];
    const k = Math.max(0.2, panel.zoom) * 1.6;
    panel.focusX = clampFocus(panel.focusX - ((event.clientX - drag.x) / rect.width) * (overlay.width / (box.w * k)));
    panel.focusY = clampFocus(panel.focusY - ((event.clientY - drag.y) / rect.height) * (overlay.height / (box.h * k)));
    panel.manualFocus = true;
    Object.assign(drag, { x: event.clientX, y: event.clientY, moved: true });
    schedule('draft');
  };
  overlay.onpointerup = overlay.onpointercancel = (event) => {
    if (event.pointerId !== drag?.id) return;
    const { moved } = drag;
    drag = null;
    overlay.classList.remove('dragging');
    if (moved) refresh(`Panel ${state.activePanel + 1} reframed — the crop is kept per panel.`);
  };
  overlay.addEventListener('wheel', (event) => {
    const panel = eventPanel(event);
    if (panel) state.activePanel = panel.index;
    const cfg = active();
    if (!cfg) return;
    event.preventDefault();
    cfg.zoom = Math.min(2.6, Math.max(1, cfg.zoom * Math.exp(-event.deltaY * 0.0012)));
    cfg.manualFocus = true;
    syncPanel();
    schedule('draft');
    later('wheel', 200, () => refresh());
  }, { passive: false });
}

function bindTools() {
  const tool = (id, fn) => ($(id).onclick = fn);
  $('panel-grade').onchange = (e) => refresh(`Panel ${state.activePanel + 1} grade ${(active().gradeOverride = e.target.value)}.`);
  for (const [id, key, unit] of [['zoom-range', 'zoom', '×'], ['rotate-range', 'rotate', '°']]) {
    $(id).oninput = () => {
      const panel = active();
      panel[key] = +$(id).value;
      panel.manualFocus ||= key === 'zoom';
      $(id).nextElementSibling.textContent = `${key === 'zoom' ? panel.zoom.toFixed(2) : panel.rotate}${unit}`;
      schedule('draft');
    };
    $(id).onchange = () => refresh();
  }
  tool('flip-btn', () => refresh(`Panel ${state.activePanel + 1} ${(active().flip = !active().flip) ? 'flipped' : 'unflipped'}.`));
  tool('reset-panel', () => refresh(`Panel ${resetPanel(state) && state.activePanel + 1} back to its smart crop.`));
  tool('swap-btn', () => {
    swapFrom = swapFrom == null ? state.activePanel : null;
    $('swap-btn').classList.toggle('on', swapFrom != null);
    drawOverlay();
    setStatus(swapFrom != null ? `Swap: pick the panel to trade with panel ${swapFrom + 1}.` : 'Swap cancelled.');
  });
  tool('export-btn', triggerExport);
  tool('quick-export', triggerExport);
  tool('undo-btn', () => travel(-1));
  tool('redo-btn', () => travel(1));
  tool('fx-reset', () => {
    state.fx = { ...FX_DEFAULTS };
    refresh('Ink and paint back to the house recipe.');
  });
  tool('apply-all', () => state.lastSource && refresh(`${labelOf(assignSource(state, state.lastSource) && state.lastSource)} now fills every panel, each with its own crop.`));
  tool('mix-btn', () => refresh(`Mixed the gallery across the panels${mixSources(state, SOURCE_IDS) && '.'}`));
  for (const b of $('format-row').children) b.onclick = () => setFormat(b.dataset.format);
  for (const b of $('view-row').children) b.onclick = () => setView(b.dataset.view);
  window.addEventListener('keydown', (event) => {
    const typing = /INPUT|SELECT/.test(event.target.tagName);
    const key = event.key.toLowerCase();
    const n = state.panels.length;
    if ((event.metaKey || event.ctrlKey) && (key === 'e' || (!typing && /^[zy]$/.test(key)))) {
      event.preventDefault();
      if (key === 'e') triggerExport();
      else travel(key === 'y' || event.shiftKey ? 1 : -1);
    } else if (!typing && (key === '[' || key === ']')) pickPanel((state.activePanel + (key === ']' ? 1 : n - 1)) % n);
    else if (!typing && /^[1-9]$/.test(key) && +key <= n) pickPanel(key - 1);
  });
}

async function useFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) return setStatus('That file is not an image. Choose a JPG, PNG or WEBP.');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const label = file.name.replace(/\.[^.]+$/, '').slice(0, 24) || 'Your photo';
    const { detectSubject } = await load('subjects');
    assets.set('upload', { id: 'upload', label, image, version: (assets.get('upload')?.version ?? 0) + 1, subject: detectSubject(image) });
    assignSource(state, (state.lastSource = 'upload'), { all: fillAll.checked });
    $('apply-all').disabled = false;
    buildGallery();
    refresh(fillAll.checked ? `${label} fills all ${state.panels.length} panels with face-aware crops.` : `${label} → panel ${state.activePanel + 1}, framed on the face.`);
  } catch {
    setStatus('That image could not be decoded. Try another JPG, PNG or WEBP.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function bindPhoto() {
  const zone = $('dropzone');
  const files = (e) => e.dataTransfer?.types?.includes('Files');
  let depth = 0;
  $('file').onchange = async (e) => {
    await useFile(e.target.files[0]);
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
    useFile(e.dataTransfer.files[0]);
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
    return setStatus('Showcase: the cover at export resolution, with every post size. Esc to return.');
  }
  view = next;
  for (const b of $('view-row').children) b.classList.toggle('active', b.dataset.view === view);
  posterWrap.hidden = view === 'box';
  boxView.hidden = view !== 'box';
  if (view !== 'box') return fitPoster(), drawOverlay();
  await refreshBox();
  setStatus("3D box case: the live cover wrapped on a collector's case. Edits update it.");
}

function setFormat(id) {
  format = id === 'jpeg' ? 'jpeg' : 'png';
  syncAll();
}

const exportNow = async (fmt = format, download = true) => (await load('exporter')).exportCover(state, assets, { format: fmt, download });

function triggerExport() {
  if (busy) return;
  busy = true;
  $('export-btn').classList.add('is-busy');
  setStatus(`Painting ${sizeOf(state).width} × ${sizeOf(state).height} at export resolution…`);
  requestAnimationFrame(async () => {
    try {
      const { width, height, bytes, name } = await exportNow();
      window.__lastExport = { width, height, bytes, name, format };
      setStatus(`Exported ${name} · ${(bytes / 1048576).toFixed(2)} MB · ${width} × ${height}.`);
    } catch (error) {
      setStatus(`Export failed: ${error.message}`);
    } finally {
      busy = false;
      $('export-btn').classList.remove('is-busy');
    }
  });
}

async function boot() {
  const heavy = Promise.all([load('renderer'), loadSources(), ensureFonts()]);
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
  history.reset();
  commit();
  refreshLayoutThumbs();
  syncAll();
  fitPoster();
  draw();
  if (['box', 'showcase'].includes(params.get('view'))) await setView(params.get('view'));
  window.__vp = {
    state, assets, history, setFormat, setView, pickPanel,
    setDemo: async (name) => refresh(`${(await load('demos')).applyDemo(state, name) && name} demo loaded.`, true),
    swap: (a, b) => refresh(`Swapped panel ${swapPanels(state, a, b) && a + 1} with panel ${b + 1}.`),
    undo: () => travel(-1),
    redo: () => travel(1),
    exportImage: (fmt = format) => exportNow(fmt, false),
    render: (quality) => draw(quality),
  };
  window.addEventListener('resize', () => (view === 'box' ? refreshBox() : (fitPoster(), drawOverlay())));
  window.__shotReady = true;
}

boot().catch((error) => {
  setStatus(`The studio could not start: ${error.message}`);
  console.error(error);
});
