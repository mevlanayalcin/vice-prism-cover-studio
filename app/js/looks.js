// The look catalogue as plain data: six colour grades, the ink-and-paint recipe and the lettering
// choices. A grade carries five gradient-map stops (shadow to light), a three-stop sky it relights
// blue skies and sea with, two accents for rim light and lettering, split-tone ends and its recipe.

export const FX_DEFAULTS = { paint: 0.8, ink: 0.72, bands: 0.5, halftone: 0.26, grain: 0.3, grade: 0.9 };

export const FX_META = [
  { key: 'paint', name: 'Oil paint', hint: 'Kuwahara brush strokes' },
  { key: 'ink', name: 'Ink contour', hint: 'XDoG cel-ink outlines' },
  { key: 'bands', name: 'Poster bands', hint: 'flat cel value planes' },
  { key: 'halftone', name: 'Halftone', hint: 'print dot screen in the shadows' },
  { key: 'grain', name: 'Film grain', hint: '35 mm film tooth' },
  { key: 'grade', name: 'Colour grade', hint: 'sunset or neon relight strength' },
];

const grade = (id, name, accent, accent2, light, [shadowTint, highlightTint], stops, sky, look) => ({ id, name, accent, accent2, light, shadowTint, highlightTint, stops, sky, ...look });

export const GRADES = [
  grade('vice-sunset', 'Vice Sunset', '#ff2f87', '#ffb347', '255, 138, 84', [[70, 16, 92], [255, 214, 140]],
    ['#1c0736', '#5a1572', '#d42a83', '#ff8c57', '#fff0c8'], ['#3a0f63', '#d8327f', '#ffb55c'],
    { map: 0.22, skyMix: 0.78, gamma: 1.02, exposure: 1.08, bloom: 0.3, rim: 0.42, edge: 0.5, sister: 'heatwave-coral' }),
  grade('neon-midnight', 'Neon Midnight', '#21e6ff', '#ff3ec8', '60, 220, 255', [[18, 20, 92], [170, 246, 255]],
    ['#060a26', '#211c74', '#6a35d6', '#38d8f4', '#ffc4f2'], ['#05061f', '#3a1680', '#ff3aa8'],
    { night: true, map: 0.5, skyMix: 0.92, gamma: 1.28, exposure: 1.02, bloom: 0.42, rim: 0.85, edge: 0.75, sister: 'ocean-drive' }),
  grade('palm-gold', 'Palm Gold', '#ffbf3c', '#ff6a3a', '255, 196, 98', [[60, 24, 18], [255, 236, 182]],
    ['#200f08', '#5e260d', '#b85b16', '#ffb84a', '#fff6d2'], ['#4d1a2e', '#ff7b3d', '#ffd36b'],
    { map: 0.34, skyMix: 0.7, gamma: 1.08, exposure: 1.08, bloom: 0.3, rim: 0.4, edge: 0.45, sister: 'vice-sunset' }),
  grade('ocean-drive', 'Ocean Drive', '#22d7c6', '#ff5fb4', '86, 240, 220', [[8, 36, 58], [222, 255, 236]],
    ['#031a22', '#0a4656', '#11909a', '#56e2cf', '#fff1c8'], ['#1b1257', '#9b2c9a', '#ff9f7a'],
    { map: 0.36, skyMix: 0.72, gamma: 1.12, exposure: 1.08, bloom: 0.32, rim: 0.55, edge: 0.55, sister: 'neon-midnight' }),
  grade('heatwave-coral', 'Heatwave Coral', '#ff4f6d', '#ffa14a', '255, 124, 98', [[70, 12, 44], [255, 218, 170]],
    ['#2a0716', '#701034', '#d62c57', '#ff8466', '#ffe6b6'], ['#5a0f45', '#ff4f6d', '#ffc078'],
    { map: 0.32, skyMix: 0.74, gamma: 1.08, exposure: 1.08, bloom: 0.28, rim: 0.42, edge: 0.48, sister: 'vice-sunset' }),
  grade('coastal-day', 'Coastal Day', '#14d6c6', '#ff7a5c', '130, 246, 236', [[10, 54, 70], [255, 240, 208]],
    ['#05323d', '#0b7f8c', '#3fd2c3', '#ffbb8e', '#fff8e8'], ['#1c9ec9', '#6fe0e6', '#ffd9a8'],
    { map: 0.14, skyMix: 0.34, gamma: 1.0, exposure: 1.06, bloom: 0.3, rim: 0.36, edge: 0.5, sister: 'palm-gold' }),
];

export const gradeById = (id) => GRADES.find((g) => g.id === id) ?? GRADES[0];
export const swatchCss = (g) => `linear-gradient(135deg, ${g.sky[0]}, ${g.sky[1]} 45%, ${g.sky[2]} 70%, ${g.stops[3]})`;

export const FONT_STYLE_OPTIONS = [
  { id: 'chrome', label: 'Horizon Chrome' },
  { id: 'neon', label: 'Neon Tube' },
  { id: 'sunset', label: 'Sunset Enamel' },
  { id: 'riviera', label: 'Riviera Serif' },
  { id: 'heavy', label: 'Heavy Block' },
];

export const TEXT_POSITIONS = [
  { id: 'auto', label: 'Auto · face-safe' },
  { id: 'center', label: 'Centre band' },
  { id: 'top', label: 'Top banner' },
  { id: 'band', label: 'Lower band' },
  { id: 'left', label: 'Left stack' },
];
