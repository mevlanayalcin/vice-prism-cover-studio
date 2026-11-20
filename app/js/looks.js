// The look catalogue as plain data: six colour grades, the ink-and-paint recipe and the lettering
// choices. Each grade carries five gradient-map stops, two accents, a key-light colour, split-tone
// ends (shadow / highlight) and the photo recipe (map strength, gamma, rim light).

export const FX_DEFAULTS = { paint: 0.86, ink: 0.7, halftone: 0.3, grain: 0.34, grade: 0.9 };

export const FX_META = [
  { key: 'paint', name: 'Oil paint', hint: 'Kuwahara oil-paint strokes' },
  { key: 'ink', name: 'Ink contour', hint: 'XDoG brush outlines' },
  { key: 'halftone', name: 'Halftone', hint: 'print dot screen' },
  { key: 'grain', name: 'Film grain', hint: 'ISO 400 tooth' },
  { key: 'grade', name: 'Colour grade', hint: 'split-tone strength' },
];

const grade = (id, name, accent, accent2, light, shadowTint, highlightTint, stops, look) => ({ id, name, accent, accent2, light, shadowTint, highlightTint, stops, ...look });

export const GRADES = [
  grade('vice-sunset', 'Vice Sunset', '#ff2f87', '#ffb347', '255, 128, 78', [58, 12, 78], [255, 214, 132], ['#2a0b45', '#62187a', '#d92a86', '#ff8a55', '#ffeec0'], { map: 0.24, gamma: 1.04, bloom: 0.26, edge: 0.34, exposure: 1.16 }),
  grade('neon-midnight', 'Neon Midnight', '#21e6ff', '#ff3ec8', '34, 224, 255', [10, 22, 72], [150, 246, 255], ['#081031', '#27227e', '#6b3ada', '#3fe0f5', '#ff9fe8'], { time: 'night', map: 0.58, sky: 0.7, gamma: 1.4, rim: 0.62, bloom: 0.38, edge: 0.58, exposure: 1.34 }),
  grade('palm-gold', 'Palm Gold', '#ffbf3c', '#ff7a32', '255, 198, 96', [56, 24, 14], [255, 236, 178], ['#221007', '#5c250c', '#b45a16', '#ffb84a', '#fff5cf'], { map: 0.4, gamma: 1.12, bloom: 0.28, edge: 0.36, exposure: 1.14 }),
  grade('ocean-drive', 'Ocean Drive', '#22d7c6', '#ffd27a', '86, 240, 220', [6, 36, 48], [222, 255, 232], ['#03191f', '#084650', '#0e8c93', '#4fe0cb', '#ffefc2'], { map: 0.42, gamma: 1.15, bloom: 0.3, edge: 0.4, exposure: 1.12 }),
  grade('heatwave-coral', 'Heatwave Coral', '#ff4f6d', '#ffa14a', '255, 120, 96', [64, 10, 40], [255, 216, 168], ['#2c0717', '#6e1032', '#d32b55', '#ff8064', '#ffe3b0'], { map: 0.4, gamma: 1.14, bloom: 0.26, edge: 0.36, exposure: 1.12 }),
  grade('coastal-day', 'Coastal Day', '#17d3c4', '#ff8a6a', '130, 246, 236', [8, 52, 62], [255, 240, 206], ['#05343d', '#0d7f8a', '#3fd0c2', '#ffb98d', '#fff7e6'], { map: 0.2, sky: 0.12, gamma: 1.05, bloom: 0.32, edge: 0.44, exposure: 1.1 }),
];

export const gradeById = (id) => GRADES.find((g) => g.id === id) ?? GRADES[0];
export const swatchCss = (g) => `linear-gradient(135deg, ${g.stops.join(', ')})`;

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
