// The single source of truth for the studio: the three post sizes, six layouts, six grades,
// the caption, per-panel crop state and the FX weights. app.js only reads and mutates this.

import { FX_DEFAULTS } from './filters.js';
import { layoutById } from './layouts.js';

export const SIZES = [
  { id: 'square', label: 'Square', ratio: '1:1', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait', ratio: '4:5', width: 1080, height: 1350 },
  { id: 'landscape', label: 'Landscape', ratio: '16:9', width: 1920, height: 1080 },
];

export const sizeOf = (state) => SIZES.find((s) => s.id === state.size) ?? SIZES[2];

export const SOURCE_IDS = ['sunset-city', 'sunset-cruise', 'coast-highway', 'neon-skyline', 'neon-strip', 'coastal-day', 'boulevard', 'pier'];

const DEFAULT_SOURCES = {
  classic6: ['sunset-city', 'boulevard', 'pier', 'coast-highway', 'neon-strip', 'sunset-cruise'],
  mosaic6: ['boulevard', 'neon-strip', 'neon-skyline', 'pier', 'coast-highway', 'sunset-city'],
  diagonal4: ['sunset-city', 'neon-skyline', 'sunset-cruise', 'pier'],
  triptych3: ['boulevard', 'coastal-day', 'pier'],
  'hero-strips': ['sunset-city', 'sunset-cruise', 'coast-highway', 'neon-strip'],
  minimal: ['sunset-city', 'pier'],
};

/** Ready-made sample sets, one click each, so a cover never starts empty. */
export const PACKS = [
  { id: 'sunset', label: 'Sunset Coast', sources: ['sunset-city', 'sunset-cruise', 'coast-highway'] },
  { id: 'neon', label: 'Neon Night', sources: ['neon-strip', 'neon-skyline', 'sunset-city'] },
  { id: 'coast', label: 'Daylight', sources: ['coastal-day', 'coast-highway', 'pier'] },
];

const ROTATIONS = [0, -1.4, 1.1, 0, -0.8, 1.5];

const panelConfig = (layout, index, source) => {
  const focal = layout.panels[index]?.focal ?? { zoom: 1.15, x: 0.5, y: 0.5 };
  return {
    source,
    zoom: focal.zoom,
    focusX: focal.x,
    focusY: focal.y,
    rotate: ROTATIONS[index % ROTATIONS.length],
    flip: index === 2,
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
    return {
      ...fresh,
      source: prev.source,
      flip: prev.flip,
      gradeOverride: prev.gradeOverride,
    };
  });
}

export function createState(overrides = {}) {
  const layoutId = overrides.layout ?? 'classic6';
  const state = {
    size: 'landscape',
    layout: layoutId,
    grade: 'vice-sunset',
    fontStyle: 'block',
    textPosition: 'auto',
    caption: {
      title: 'VICE PRISM',
      subtitle: 'A Sunset State Story',
      tagline: 'LEONIDA · EST. 2026',
      badge: 'SUNSET EDITION',
    },
    fx: { ...FX_DEFAULTS },
    panels: panelsFor(layoutId),
    activePanel: 0,
    ...overrides,
  };
  state.caption = { ...state.caption, ...(overrides.caption ?? {}) };
  state.fx = { ...FX_DEFAULTS, ...(overrides.fx ?? {}) };
  if (overrides.panels) state.panels = overrides.panels;
  return state;
}

export function setLayout(state, id) {
  const layout = layoutById(id);
  const previous = state.panels;
  state.layout = layout.id;
  state.panels = panelsFor(layout.id, previous);
  state.activePanel = Math.min(state.activePanel, state.panels.length - 1);
  return state;
}

export function setSize(state, id) {
  if (SIZES.some((s) => s.id === id)) state.size = id;
  return state;
}

export function assignSource(state, sourceId, { all = true, index = state.activePanel } = {}) {
  const layout = layoutById(state.layout);
  const targets = all ? state.panels.map((_, i) => i) : [index];
  for (const i of targets) {
    const panel = state.panels[i];
    if (!panel) continue;
    panel.source = sourceId;
    panel.manualFocus = false;
    const focal = layout.panels[i]?.focal ?? { zoom: 1.1, x: 0.5, y: 0.5 };
    panel.zoom = focal.zoom;
    panel.focusX = focal.x;
    panel.focusY = focal.y;
  }
  return state;
}

/** Lay a sample pack across every panel, repeating it with a fresh crop per cut. */
export function assignPack(state, sourceIds) {
  const ids = sourceIds.filter(Boolean);
  if (!ids.length) return state;
  const layout = layoutById(state.layout);
  state.panels.forEach((panel, i) => {
    panel.source = ids[i % ids.length];
    panel.manualFocus = false;
    const focal = layout.panels[i]?.focal;
    if (focal) {
      panel.zoom = focal.zoom;
      panel.focusX = focal.x;
      panel.focusY = focal.y;
    }
  });
  return state;
}

/** Cycle the gallery across the panels: different source per panel, no repeat until it wraps. */
export function mixSources(state, sourceIds) {
  const ids = sourceIds.filter(Boolean);
  if (!ids.length) return state;
  const offset = (state.mixOffset ?? 0) + 1;
  state.mixOffset = offset;
  state.panels.forEach((panel, i) => {
    panel.source = ids[(i + offset) % ids.length];
    panel.manualFocus = false;
    const focal = layoutById(state.layout).panels[i]?.focal;
    if (focal) {
      panel.zoom = focal.zoom;
      panel.focusX = focal.x;
      panel.focusY = focal.y;
    }
  });
  return state;
}

export function resetPanel(state, index = state.activePanel) {
  const panel = state.panels[index];
  if (!panel) return state;
  const focal = layoutById(state.layout).panels[index]?.focal;
  if (focal) {
    panel.zoom = focal.zoom;
    panel.focusX = focal.x;
    panel.focusY = focal.y;
  }
  panel.rotate = ROTATIONS[index % ROTATIONS.length];
  panel.flip = index === 2;
  panel.manualFocus = false;
  panel.gradeOverride = 'global';
  return state;
}

/** Named scenes for deterministic screenshots, demo links and the shot harness. */
export const DEMOS = {
  cover: {
    size: 'landscape',
    layout: 'classic6',
    grade: 'vice-sunset',
    fontStyle: 'block',
    textPosition: 'auto',
    sources: ['sunset-city', 'boulevard', 'pier', 'coast-highway', 'neon-strip', 'sunset-cruise'],
    caption: { title: 'SUNSET HEIST', subtitle: 'A Leonida Story', tagline: 'VICE PRISM · LEONIDA', badge: 'SUNSET EDITION' },
  },
  studio: {
    size: 'landscape',
    layout: 'classic6',
    grade: 'vice-sunset',
    fontStyle: 'block',
    textPosition: 'auto',
    sources: ['sunset-city', 'boulevard', 'pier', 'coast-highway', 'neon-strip', 'sunset-cruise'],
    caption: { title: 'SUNSET HEIST', subtitle: 'A Leonida Story', tagline: 'VICE PRISM · LEONIDA', badge: 'SUNSET EDITION' },
  },
  neon: {
    size: 'portrait',
    layout: 'mosaic6',
    grade: 'neon-midnight',
    fontStyle: 'narrow',
    textPosition: 'auto',
    sources: ['boulevard', 'neon-strip', 'neon-skyline', 'pier', 'coast-highway', 'sunset-city'],
    caption: { title: 'NEON HEIRESS', subtitle: 'After Hours in Leonida', tagline: 'OCEAN DRIVE · 02:14 AM', badge: 'MIDNIGHT CUT' },
  },
  coast: {
    size: 'square',
    layout: 'triptych3',
    grade: 'coastal-day',
    fontStyle: 'serif',
    textPosition: 'auto',
    sources: ['boulevard', 'coastal-day', 'pier'],
    caption: { title: 'COASTAL CLASSIC', subtitle: 'Turquoise Season', tagline: 'PALM COAST · HIGH TIDE', badge: 'CORAL EDITION' },
  },
};

/** Apply a demo's look, with the layout's own sample assignment, for deterministic captures. */
export function applyDemo(state, name) {
  const demo = DEMOS[name];
  if (!demo) return state;
  state.size = demo.size;
  setLayout(state, demo.layout);
  state.panels = panelsFor(demo.layout).map((panel, i) => ({
    ...panel,
    source: demo.sources?.[i] ?? panel.source,
    manualFocus: false,
  }));
  state.grade = demo.grade;
  state.fontStyle = demo.fontStyle;
  state.textPosition = demo.textPosition;
  state.caption = { ...state.caption, ...demo.caption };
  state.activePanel = 1;
  return state;
}
