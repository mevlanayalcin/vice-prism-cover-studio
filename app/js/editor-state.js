// The studio's single source of truth: post sizes, sources and packs, stickers, per-panel crops,
// the caption, FX weights, demo covers and an undo/redo history of snapshots. app.js only reads
// and mutates this state.

import { FX_DEFAULTS } from './looks.js';
import { layoutById } from './layouts.js';

export const SIZES = [
  { id: 'square', label: 'Square', ratio: '1:1', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait', ratio: '4:5', width: 1080, height: 1350 },
  { id: 'landscape', label: 'Landscape', ratio: '16:9', width: 1920, height: 1080 },
];
export const sizeOf = (state) => SIZES.find((s) => s.id === state.size) ?? SIZES[2];

export const SOURCE_IDS = ['boulevard', 'pier', 'sunset-run', 'neon-boulevard', 'harbor-chase', 'heli-search', 'flamingo-riviera', 'getaway-dusk'];

const DEFAULT_SOURCES = {
  classic7: ['boulevard', 'neon-boulevard', 'pier', 'sunset-run', 'harbor-chase', 'heli-search', 'getaway-dusk'],
  asym9: ['boulevard', 'neon-boulevard', 'heli-search', 'pier', 'boulevard', 'sunset-run', 'getaway-dusk', 'harbor-chase', 'flamingo-riviera'],
  panorama: ['harbor-chase', 'boulevard', 'pier'],
  classic6: ['boulevard', 'neon-boulevard', 'pier', 'sunset-run', 'heli-search', 'getaway-dusk'],
  mosaic6: ['boulevard', 'neon-boulevard', 'heli-search', 'pier', 'sunset-run', 'getaway-dusk'],
  diagonal4: ['boulevard', 'neon-boulevard', 'sunset-run', 'pier'],
  triptych3: ['boulevard', 'flamingo-riviera', 'pier'],
  'hero-strips': ['sunset-run', 'boulevard', 'pier', 'neon-boulevard'],
  minimal: ['getaway-dusk', 'boulevard'],
};

export const PACKS = [
  { id: 'sunset', label: 'Sunset Grid', sources: ['boulevard', 'sunset-run', 'pier', 'getaway-dusk'] },
  { id: 'neon', label: 'Neon Night', sources: ['boulevard', 'neon-boulevard', 'heli-search', 'pier'] },
  { id: 'coast', label: 'Coastal', sources: ['harbor-chase', 'pier', 'flamingo-riviera', 'boulevard'] },
];

export const STICKERS = [
  { key: 'header', name: 'Platform band', hint: 'original console-edition strip' },
  { key: 'age', name: 'Age badge', hint: 'original 17+ rating plate' },
  { key: 'medallion', name: 'Edition seal', hint: 'sunburst medallion' },
  { key: 'flare', name: 'Sun flare', hint: 'anamorphic light streak' },
  { key: 'neonEdge', name: 'Neon gutters', hint: 'glow bleeding into the ink' },
  { key: 'leak', name: 'Light leak', hint: 'warm film burn at the edge' },
];
export const STICKER_DEFAULTS = Object.fromEntries(STICKERS.map((s) => [s.key, true]));

const ROTATIONS = [0, -1, 0.8, 0, -0.6, 1, 0, -0.8, 0.6];

function refocus(state, i) {
  const focal = layoutById(state.layout).panels[i]?.focal ?? { zoom: 1.1, x: 0.5, y: 0.5 };
  Object.assign(state.panels[i], { manualFocus: false, zoom: focal.zoom, focusX: focal.x, focusY: focal.y });
}

export function panelsFor(layoutId) {
  const defaults = DEFAULT_SOURCES[layoutId] ?? SOURCE_IDS;
  return layoutById(layoutId).panels.map(({ focal }, i) => ({
    source: defaults[i % defaults.length], zoom: focal.zoom, focusX: focal.x, focusY: focal.y, rotate: ROTATIONS[i % 9], flip: false, manualFocus: false, gradeOverride: 'global',
  }));
}

export function createState() {
  return {
    size: 'landscape', layout: 'classic7', grade: 'vice-sunset', fontStyle: 'chrome', textPosition: 'auto', activePanel: 0,
    caption: { title: 'VICE HORIZON', subtitle: 'A Leonida Story', tagline: 'LEONIDA · EST. 2026', badge: 'SUNSET EDITION', platform: 'CONSOLE EDITION' },
    fx: { ...FX_DEFAULTS }, stickers: { ...STICKER_DEFAULTS }, panels: panelsFor('classic7'),
  };
}

export function setLayout(state, id) {
  state.layout = layoutById(id).id;
  state.panels = panelsFor(state.layout);
  state.activePanel = Math.min(state.activePanel, state.panels.length - 1);
  return state;
}

export function setSize(state, id) {
  if (SIZES.some((s) => s.id === id)) state.size = id;
  return state;
}

export function assignSource(state, sourceId, { all = true, index = state.activePanel } = {}) {
  for (const i of all ? state.panels.keys() : [index]) {
    if (!state.panels[i]) continue;
    state.panels[i].source = sourceId;
    refocus(state, i);
  }
  return state;
}

export function assignPack(state, ids, offset = 0) {
  if (!ids.length) return state;
  state.panels.forEach((panel, i) => {
    panel.source = ids[(i + offset) % ids.length];
    refocus(state, i);
  });
  return state;
}

export const mixSources = (state, ids) => assignPack(state, ids, (state.mixOffset = (state.mixOffset ?? 0) + 1));

export function swapPanels(state, a, b) {
  if (a !== b && state.panels[a] && state.panels[b]) [state.panels[a], state.panels[b]] = [state.panels[b], state.panels[a]];
  return state;
}

export function resetPanel(state, index = state.activePanel) {
  if (!state.panels[index]) return state;
  refocus(state, index);
  Object.assign(state.panels[index], { rotate: ROTATIONS[index % 9], flip: false, gradeOverride: 'global' });
  return state;
}

const SNAP_KEYS = ['size', 'layout', 'grade', 'fontStyle', 'textPosition', 'caption', 'fx', 'stickers', 'panels', 'activePanel'];
const snapshot = (state) => JSON.stringify(SNAP_KEYS.map((k) => state[k]));

export function createHistory(state, limit = 80) {
  let past = [snapshot(state)];
  let future = [];
  const restore = (snap) => JSON.parse(snap).forEach((v, i) => (state[SNAP_KEYS[i]] = v));
  return {
    commit() {
      const snap = snapshot(state);
      if (snap === past.at(-1)) return false;
      past = [...past, snap].slice(-limit);
      future = [];
      return true;
    },
    undo() {
      if (past.length < 2) return false;
      future.push(past.pop());
      restore(past.at(-1));
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(future.pop());
      restore(past.at(-1));
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
