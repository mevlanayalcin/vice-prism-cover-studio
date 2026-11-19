// The single source of truth for the studio: post sizes, layouts, grades, the caption, per-panel
// crop state, FX weights and cover stickers, plus an undo/redo history of snapshots. app.js only
// reads and mutates this.

import { FX_DEFAULTS } from './looks.js';
import { layoutById } from './layouts.js';

export const SIZES = [
  { id: 'square', label: 'Square', ratio: '1:1', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait', ratio: '4:5', width: 1080, height: 1350 },
  { id: 'landscape', label: 'Landscape', ratio: '16:9', width: 1920, height: 1080 },
];

export const sizeOf = (state) => SIZES.find((s) => s.id === state.size) ?? SIZES[2];

/** Every source in gallery order: eight illustrated scenes, then the two shipped photos. */
export const SOURCE_IDS = ['vice-heiress', 'sunset-run', 'night-driver', 'neon-boulevard', 'harbor-chase', 'heli-search', 'flamingo-riviera', 'getaway-dusk', 'boulevard', 'pier'];

const DEFAULT_SOURCES = {
  classic7: ['vice-heiress', 'neon-boulevard', 'night-driver', 'sunset-run', 'harbor-chase', 'heli-search', 'getaway-dusk'],
  asym9: ['night-driver', 'neon-boulevard', 'heli-search', 'boulevard', 'vice-heiress', 'sunset-run', 'getaway-dusk', 'harbor-chase', 'flamingo-riviera'],
  panorama: ['harbor-chase', 'flamingo-riviera', 'pier'],
  classic6: ['vice-heiress', 'boulevard', 'pier', 'sunset-run', 'heli-search', 'getaway-dusk'],
  mosaic6: ['boulevard', 'neon-boulevard', 'heli-search', 'night-driver', 'sunset-run', 'getaway-dusk'],
  diagonal4: ['boulevard', 'neon-boulevard', 'sunset-run', 'vice-heiress'],
  triptych3: ['boulevard', 'flamingo-riviera', 'pier'],
  'hero-strips': ['sunset-run', 'vice-heiress', 'boulevard', 'night-driver'],
  minimal: ['getaway-dusk', 'boulevard'],
};

/** Ready-made sets, one click each, so a cover never starts empty. */
export const PACKS = [
  { id: 'sunset', label: 'Sunset Grid', sources: ['vice-heiress', 'sunset-run', 'getaway-dusk', 'boulevard'] },
  { id: 'neon', label: 'Neon Night', sources: ['night-driver', 'neon-boulevard', 'heli-search', 'boulevard'] },
  { id: 'coast', label: 'Coastal', sources: ['harbor-chase', 'flamingo-riviera', 'pier'] },
];

/** Cover stickers and lighting FX, each one toggle. */
export const STICKERS = [
  { key: 'header', name: 'Platform band', hint: 'original console-edition strip' },
  { key: 'age', name: 'Age badge', hint: 'original 17+ rating plate' },
  { key: 'medallion', name: 'Edition seal', hint: 'sunburst medallion' },
  { key: 'flare', name: 'Sun flare', hint: 'anamorphic light streak' },
  { key: 'neonEdge', name: 'Neon gutters', hint: 'glow bleeding into the ink' },
  { key: 'leak', name: 'Light leak', hint: 'warm film burn at the edge' },
];
export const STICKER_DEFAULTS = { header: true, age: true, medallion: true, flare: true, neonEdge: true, leak: true };

const ROTATIONS = [0, -1, 0.8, 0, -0.6, 1, 0, -0.8, 0.6];

const panelConfig = (layout, index, source) => {
  const focal = layout.panels[index]?.focal ?? { zoom: 1.15, x: 0.5, y: 0.5 };
  return {
    source,
    zoom: focal.zoom,
    focusX: focal.x,
    focusY: focal.y,
    rotate: ROTATIONS[index % ROTATIONS.length],
    flip: false,
    manualFocus: false,
    gradeOverride: 'global',
  };
};

export function panelsFor(layoutId, previous = []) {
  const layout = layoutById(layoutId);
  const defaults = DEFAULT_SOURCES[layoutId] ?? SOURCE_IDS;
  return layout.panels.map((_, index) => {
    const prev = previous[index];
    const fresh = panelConfig(layout, index, prev?.source ?? defaults[index % defaults.length]);
    if (!prev) return fresh;
    return { ...fresh, source: prev.source, flip: prev.flip, gradeOverride: prev.gradeOverride };
  });
}

export function createState(overrides = {}) {
  const layoutId = overrides.layout ?? 'classic7';
  const state = {
    size: 'landscape',
    layout: layoutId,
    grade: 'vice-sunset',
    fontStyle: 'chrome',
    textPosition: 'auto',
    caption: {
      title: 'VICE HORIZON',
      subtitle: 'A Leonida Story',
      tagline: 'LEONIDA · EST. 2026',
      badge: 'SUNSET EDITION',
      platform: 'CONSOLE EDITION',
    },
    fx: { ...FX_DEFAULTS },
    stickers: { ...STICKER_DEFAULTS },
    panels: panelsFor(layoutId),
    activePanel: 0,
    ...overrides,
  };
  state.caption = { ...state.caption, ...(overrides.caption ?? {}) };
  state.fx = { ...FX_DEFAULTS, ...(overrides.fx ?? {}) };
  state.stickers = { ...STICKER_DEFAULTS, ...(overrides.stickers ?? {}) };
  return state;
}

export function setLayout(state, id) {
  const layout = layoutById(id);
  state.layout = layout.id;
  state.panels = panelsFor(layout.id, []);
  state.activePanel = Math.min(state.activePanel, state.panels.length - 1);
  return state;
}

export function setSize(state, id) {
  if (SIZES.some((s) => s.id === id)) state.size = id;
  return state;
}

function refocus(state, i) {
  const panel = state.panels[i];
  const focal = layoutById(state.layout).panels[i]?.focal ?? { zoom: 1.1, x: 0.5, y: 0.5 };
  panel.manualFocus = false;
  panel.zoom = focal.zoom;
  panel.focusX = focal.x;
  panel.focusY = focal.y;
}

export function assignSource(state, sourceId, { all = true, index = state.activePanel } = {}) {
  const targets = all ? state.panels.map((_, i) => i) : [index];
  for (const i of targets) {
    if (!state.panels[i]) continue;
    state.panels[i].source = sourceId;
    refocus(state, i);
  }
  return state;
}

/** Lay a pack across every panel, repeating it with a fresh crop per cut. */
export function assignPack(state, sourceIds) {
  const ids = sourceIds.filter(Boolean);
  if (!ids.length) return state;
  state.panels.forEach((panel, i) => {
    panel.source = ids[i % ids.length];
    refocus(state, i);
  });
  return state;
}

/** Cycle the gallery across the panels: a different source per panel, no repeat until it wraps. */
export function mixSources(state, sourceIds) {
  const ids = sourceIds.filter(Boolean);
  if (!ids.length) return state;
  state.mixOffset = (state.mixOffset ?? 0) + 1;
  state.panels.forEach((panel, i) => {
    panel.source = ids[(i + state.mixOffset) % ids.length];
    refocus(state, i);
  });
  return state;
}

/** Swap two panels' whole cuts: source, crop, rotation, flip and grade travel together. */
export function swapPanels(state, a, b) {
  if (a === b || !state.panels[a] || !state.panels[b]) return state;
  const keep = state.panels[a];
  state.panels[a] = state.panels[b];
  state.panels[b] = keep;
  return state;
}

export function resetPanel(state, index = state.activePanel) {
  const panel = state.panels[index];
  if (!panel) return state;
  refocus(state, index);
  panel.rotate = ROTATIONS[index % ROTATIONS.length];
  panel.flip = false;
  panel.gradeOverride = 'global';
  return state;
}

/* ------------------------------------------------------------------ history */

const SNAP_KEYS = ['size', 'layout', 'grade', 'fontStyle', 'textPosition', 'caption', 'fx', 'stickers', 'panels', 'activePanel'];
const snapshot = (state) => JSON.stringify(SNAP_KEYS.map((k) => state[k]));

/** Undo/redo over whole-state snapshots, capped at 80 steps; identical commits are ignored. */
export function createHistory(state, limit = 80) {
  let past = [snapshot(state)];
  let future = [];
  const restore = (snap) => {
    JSON.parse(snap).forEach((v, i) => (state[SNAP_KEYS[i]] = v));
  };
  return {
    commit() {
      const snap = snapshot(state);
      if (snap === past[past.length - 1]) return false;
      past.push(snap);
      if (past.length > limit) past = past.slice(-limit);
      future = [];
      return true;
    },
    undo() {
      if (past.length < 2) return false;
      future.push(past.pop());
      restore(past[past.length - 1]);
      return true;
    },
    redo() {
      if (!future.length) return false;
      const snap = future.pop();
      past.push(snap);
      restore(snap);
      return true;
    },
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

/* ------------------------------------------------------------------ demos */

/** Named covers for demo links and deterministic screenshots. */
export const DEMOS = {
  cover: {
    size: 'landscape',
    layout: 'classic7',
    grade: 'vice-sunset',
    fontStyle: 'chrome',
    caption: { title: 'VICE HORIZON', subtitle: 'A Leonida Story', tagline: 'VICE PRISM · LEONIDA', badge: 'SUNSET EDITION', platform: 'CONSOLE EDITION' },
  },
  neon: {
    size: 'portrait',
    layout: 'asym9',
    grade: 'neon-midnight',
    fontStyle: 'neon',
    caption: { title: 'LEONIDA NIGHTS', subtitle: 'After Hours on Ocean Drive', tagline: 'OCEAN DRIVE · 02:14 AM', badge: 'MIDNIGHT CUT', platform: 'CONSOLE EDITION' },
  },
  coast: {
    size: 'square',
    layout: 'panorama',
    grade: 'coastal-day',
    fontStyle: 'riviera',
    caption: { title: 'MIAMI DRIFT', subtitle: 'Turquoise Season', tagline: 'PALM COAST · HIGH TIDE', badge: 'RIVIERA EDITION', platform: 'CONSOLE EDITION' },
  },
};

/** Apply a demo's look with the layout's own source assignment. */
export function applyDemo(state, name) {
  const demo = DEMOS[name];
  if (!demo) return state;
  state.size = demo.size;
  state.layout = demo.layout;
  state.panels = panelsFor(demo.layout, []);
  state.grade = demo.grade;
  state.fontStyle = demo.fontStyle;
  state.textPosition = 'auto';
  state.caption = { ...state.caption, ...demo.caption };
  state.stickers = { ...STICKER_DEFAULTS };
  state.activePanel = 1;
  return state;
}
