// The studio's single source of truth: post sizes, the photo cast of every layout, stickers,
// per-panel crops, the photo mode (multi-photo or 1-Photo Auto-Slice), the caption and its
// title transform (drag offset, size, tilt), FX weights and an undo/redo history of snapshots. app.js only
// reads and mutates this state; the renderer only reads it.

import { FX_DEFAULTS, gradeById } from './looks.js';
import { layoutById, panelRoles } from './layouts.js';

export const SIZES = [
  { id: 'square', label: 'Square', ratio: '1:1', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait', ratio: '4:5', width: 1080, height: 1350 },
  { id: 'landscape', label: 'Landscape', ratio: '16:9', width: 1920, height: 1080 },
];
export const sizeOf = (state) => SIZES.find((s) => s.id === state.size) ?? SIZES[2];

// The eight shipped photos, in gallery order. Every default cast below uses each at most once.
export const SOURCE_IDS = ['heli', 'boulevard', 'rooftop', 'ocean-drive', 'coupe', 'speedboat', 'neon-street', 'pier'];

const CAST = {
  classic7: ['heli', 'boulevard', 'rooftop', 'ocean-drive', 'coupe', 'speedboat', 'pier'],
  mosaic8: ['heli', 'boulevard', 'rooftop', 'pier', 'ocean-drive', 'coupe', 'speedboat', 'neon-street'],
  'hero-split': ['boulevard', 'heli', 'coupe', 'speedboat'],
  asym7: ['heli', 'rooftop', 'neon-street', 'boulevard', 'ocean-drive', 'coupe', 'speedboat'],
  diagonal5: ['speedboat', 'coupe', 'heli', 'boulevard', 'pier'],
  tower5: ['boulevard', 'heli', 'rooftop', 'ocean-drive', 'coupe'],
  triptych3: ['boulevard', 'rooftop', 'pier'],
  'hero-strips': ['ocean-drive', 'heli', 'boulevard', 'speedboat'],
  split4: ['heli', 'boulevard', 'speedboat', 'coupe'],
};

export const STICKERS = [
  { key: 'age', name: '17+ plate', hint: 'original mature rating plate', on: true },
  { key: 'medallion', name: 'VP seal', hint: 'compact sunset edition seal', on: true },
  { key: 'barcode', name: 'Barcode', hint: 'box-art barcode corner', on: true },
  { key: 'keyline', name: 'White keyline', hint: 'crisp white inner line round every panel', on: false },
  { key: 'bevel', name: 'Neon bevel', hint: 'sunset or neon inner edge on every panel', on: false },
  { key: 'flare', name: 'Sun flare', hint: 'anamorphic light streak', on: false },
  { key: 'header', name: 'Platform band', hint: 'original edition strip across the top', on: false },
];
export const STICKER_DEFAULTS = Object.fromEntries(STICKERS.map((s) => [s.key, s.on]));

// 1-Photo Auto-Slice: one photo across every panel still reads as a sequence. Each cut takes the
// shot its role asks for (layouts.panelRoles), detail cuts zoom into the photo's own strongest
// details, alternate cuts mirror, and every third takes the grade's sister for a second light.
const ROLE_SHOT = { hero: 'medium', close: 'close', wide: 'wide', detail: 'close' };
export const DEFAULT_TITLE = { dx: 0, dy: 0, scale: 1, tilt: 0 };

const fresh = (source, shot = 'medium') => ({ source, shot, zoom: 1, focusX: 0.5, focusY: 0.5, rotate: 0, flip: false, manualFocus: false, gradeOverride: 'global' });

export function panelsFor(layoutId, cast = CAST[layoutId] ?? SOURCE_IDS) {
  return layoutById(layoutId).panels.map((_, i) => fresh(cast[i % cast.length]));
}

export function createState() {
  return {
    size: 'landscape', layout: 'classic7', grade: 'vice-sunset', fontStyle: 'chrome', textPosition: 'auto', activePanel: 0, mode: 'multi', title: { ...DEFAULT_TITLE },
    caption: { title: 'VICE HORIZON', subtitle: 'A Leonida Story', tagline: 'Vice Prism presents', badge: 'SOLARIS EDITION', platform: 'COLLECTOR EDITION' },
    fx: { ...FX_DEFAULTS }, stickers: { ...STICKER_DEFAULTS }, panels: panelsFor('classic7'),
  };
}

// Keeps the photos already placed when the layout changes, topping up from the layout's own cast.
export function setLayout(state, id) {
  const placed = [...new Set(state.panels.map((p) => p.source))];
  state.layout = layoutById(id).id;
  const cast = CAST[state.layout] ?? SOURCE_IDS;
  const keep = placed.some((s) => !SOURCE_IDS.includes(s)) ? [...placed, ...cast.filter((s) => !placed.includes(s))] : cast;
  state.panels = panelsFor(state.layout, keep);
  state.activePanel = Math.min(state.activePanel, state.panels.length - 1);
  return state;
}

export function setSize(state, id) {
  if (SIZES.some((s) => s.id === id)) state.size = id;
  return state;
}

export function assignSource(state, sourceId, { all = false, index = state.activePanel, details = [] } = {}) {
  const sister = gradeById(state.grade).sister;
  if (!all) {
    if (state.panels[index]) state.panels[index] = fresh(sourceId);
    return state;
  }
  const { width, height } = sizeOf(state);
  const roles = panelRoles(layoutById(state.layout), width, height);
  let detail = 0;
  state.panels = state.panels.map((_, i) => {
    const role = roles[i] ?? 'detail';
    const panel = { ...fresh(sourceId, ROLE_SHOT[role]), flip: i % 2 === 1, gradeOverride: i % 3 === 2 && sister ? sister : 'global' };
    const point = role === 'detail' && details[detail++ % Math.max(1, details.length)];
    // a detail cut is a fixed zoom on its point; the planner still clamps it inside the photo
    return point ? { ...panel, manualFocus: true, zoom: 2.1 + (detail % 2) * 0.35, focusX: point.x, focusY: point.y } : panel;
  });
  return state;
}

// Several uploads at once land on consecutive panels from the active one.
export function assignMany(state, ids, start = state.activePanel) {
  ids.forEach((id, k) => assignSource(state, id, { index: (start + k) % state.panels.length }));
  return state;
}

export function mixSources(state, ids) {
  state.mixOffset = ((state.mixOffset ?? 0) + 1) % ids.length;
  state.panels = state.panels.map((_, i) => fresh(ids[(i + state.mixOffset) % ids.length]));
  return state;
}

export function swapPanels(state, a, b) {
  if (a !== b && state.panels[a] && state.panels[b]) [state.panels[a], state.panels[b]] = [state.panels[b], state.panels[a]];
  return state;
}

export function resetPanel(state, index = state.activePanel) {
  const panel = state.panels[index];
  if (panel) state.panels[index] = fresh(panel.source, panel.shot);
  return state;
}

const SNAP_KEYS = ['size', 'layout', 'grade', 'fontStyle', 'textPosition', 'caption', 'fx', 'stickers', 'panels', 'activePanel', 'mode', 'title'];
const snapshot = (state) => JSON.stringify(SNAP_KEYS.map((k) => state[k]));

export function createHistory(state, limit = 80) {
  let past = [snapshot(state)];
  let future = [];
  const restore = (snap) => JSON.parse(snap).forEach((v, i) => (state[SNAP_KEYS[i]] = v));
  const step = (from, to) => {
    if (from === past ? past.length < 2 : !future.length) return false;
    to.push(from.pop());
    restore(from === past ? past.at(-1) : to.at(-1));
    return true;
  };
  return {
    commit() {
      const snap = snapshot(state);
      if (snap === past.at(-1)) return false;
      past = [...past, snap].slice(-limit);
      future = [];
      return true;
    },
    undo: () => step(past, future),
    redo: () => step(future, past),
    reset() {
      past = [snapshot(state)];
      future = [];
    },
    get canUndo() {
      return past.length > 1;
    },
    get canRedo() {
      return future.length > 0;
    },
  };
}
