// The look catalogue: the six grades, the ink-and-paint recipe and the lettering choices, as
// plain data. It is all the studio rails need on first paint; the pixel pipeline (filters.js),
// the lettering engine (lettering.js) and the art load afterwards with import().

export const FX_DEFAULTS = {
  paint: 0.86,
  ink: 0.7,
  halftone: 0.3,
  grain: 0.34,
  grade: 0.9,
};

export const FX_META = [
  { key: 'paint', name: 'Oil paint', hint: 'edge-preserving brush smoothing' },
  { key: 'ink', name: 'Ink contour', hint: 'luminance and chroma outlines' },
  { key: 'halftone', name: 'Halftone', hint: 'print dot screen' },
  { key: 'grain', name: 'Film grain', hint: 'ISO 400 tooth' },
  { key: 'grade', name: 'Colour grade', hint: 'split-tone strength' },
];

/**
 * Six original grades. Each carries five luminance stops for the posterise map, an accent and a
 * light-leak colour for the renderer, and the two split-tone ends (shadow / highlight) that keep
 * skin alive: violet in the darks, gold or cyan in the lights. Swatches use the same stops.
 */
export const GRADES = [
  {
    id: 'vice-sunset',
    name: 'Vice Sunset',
    accent: '#ff2f87',
    accent2: '#ffb347',
    light: '255, 128, 78',
    shadowTint: [58, 12, 78],
    highlightTint: [255, 214, 132],
    bloom: 0.26,
    edge: 0.34,
    exposure: 1.16,
    stops: ['#2a0b45', '#62187a', '#d92a86', '#ff8a55', '#ffeec0'],
  },
  {
    id: 'neon-midnight',
    name: 'Neon Midnight',
    time: 'night',
    accent: '#21e6ff',
    accent2: '#ff3ec8',
    light: '34, 224, 255',
    shadowTint: [10, 22, 72],
    highlightTint: [150, 246, 255],
    bloom: 0.38,
    edge: 0.58,
    exposure: 1.34,
    stops: ['#081031', '#27227e', '#6b3ada', '#3fe0f5', '#ff9fe8'],
  },
  {
    id: 'palm-gold',
    name: 'Palm Gold',
    accent: '#ffbf3c',
    accent2: '#ff7a32',
    light: '255, 198, 96',
    shadowTint: [56, 24, 14],
    highlightTint: [255, 236, 178],
    bloom: 0.28,
    edge: 0.36,
    exposure: 1.14,
    stops: ['#221007', '#5c250c', '#b45a16', '#ffb84a', '#fff5cf'],
  },
  {
    id: 'ocean-drive',
    name: 'Ocean Drive',
    accent: '#22d7c6',
    accent2: '#ffd27a',
    light: '86, 240, 220',
    shadowTint: [6, 36, 48],
    highlightTint: [222, 255, 232],
    bloom: 0.3,
    edge: 0.4,
    exposure: 1.12,
    stops: ['#03191f', '#084650', '#0e8c93', '#4fe0cb', '#ffefc2'],
  },
  {
    id: 'heatwave-coral',
    name: 'Heatwave Coral',
    accent: '#ff4f6d',
    accent2: '#ffa14a',
    light: '255, 120, 96',
    shadowTint: [64, 10, 40],
    highlightTint: [255, 216, 168],
    bloom: 0.26,
    edge: 0.36,
    exposure: 1.12,
    stops: ['#2c0717', '#6e1032', '#d32b55', '#ff8064', '#ffe3b0'],
  },
  {
    id: 'coastal-day',
    name: 'Coastal Day',
    accent: '#17d3c4',
    accent2: '#ff8a6a',
    light: '130, 246, 236',
    shadowTint: [8, 52, 62],
    highlightTint: [255, 240, 206],
    bloom: 0.32,
    edge: 0.44,
    exposure: 1.1,
    stops: ['#05343d', '#0d7f8a', '#3fd0c2', '#ffb98d', '#fff7e6'],
  },
];

export const gradeById = (id) => GRADES.find((g) => g.id === id) ?? GRADES[0];

export const swatchCss = (grade) => `linear-gradient(135deg, ${grade.stops.join(', ')})`;

export const FONT_STYLE_OPTIONS = [
  { id: 'chrome', label: 'Horizon Chrome' },
  { id: 'neon', label: 'Neon Tube' },
  { id: 'block', label: 'Sunset Enamel' },
  { id: 'riviera', label: 'Riviera Serif' },
  { id: 'heavy', label: 'Heavy Block' },
];

export const TEXT_POSITIONS = [
  { id: 'auto', label: 'Auto composition' },
  { id: 'center', label: 'Centre stage' },
  { id: 'left', label: 'Left stack' },
  { id: 'band', label: 'Lower band' },
];
