// The look catalogue as plain data: six colour grades, the ink-and-paint recipe and the lettering
// choices. A grade carries five gradient-map stops (shadow to light), a three-stop sky it relights
// blue or washed-out skies and sea with, two accents for rim light and lettering, split-tone ends
// and its recipe. The four flagship looks lead the list, each with its own colour harmony:
//   Vice Sunset      coral / amber / magenta, warm key and gold rim (analogous warm)
//   Leonida Neon     cyan fill against a magenta key over navy (split complementary, night)
//   Coastal Classic  turquoise water under a golden-hour sky (complementary teal / gold)
//   Midnight Heat    ember red and amber sign light over violet shadow (warm night)

export const FX_DEFAULTS = { paint: 0.8, ink: 0.72, bands: 0.5, halftone: 0.26, grain: 0.3, grade: 0.9 };

export const FX_META = [
  { key: 'paint', name: 'Oil paint', hint: 'eight-region Kuwahara brush strokes' },
  { key: 'ink', name: 'Ink outline', hint: 'XDoG comic-ink contours' },
  { key: 'bands', name: 'Poster bands', hint: 'flat cel value planes' },
  { key: 'halftone', name: 'Halftone', hint: 'print dot screen in the shadows' },
  { key: 'grain', name: 'Paper grain', hint: 'lithograph paper and film tooth' },
  { key: 'grade', name: 'Colour grade', hint: 'sunset or neon relight strength' },
];

const grade = (id, name, accent, accent2, light, [shadowTint, highlightTint], stops, sky, look) => ({ id, name, accent, accent2, light, shadowTint, highlightTint, stops, sky, ...look });

export const GRADES = [
  grade('vice-sunset', 'Vice Sunset', '#ff2f87', '#ffb347', '255, 138, 84', [[70, 16, 92], [255, 214, 140]],
    ['#1c0736', '#5a1572', '#d42a83', '#ff8c57', '#fff0c8'], ['#3a0f63', '#d8327f', '#ffb55c'],
    { map: 0.22, skyMix: 0.8, gamma: 1.03, exposure: 1.08, bloom: 0.3, rim: 0.44, vibrance: 0.34, sister: 'palm-gold' }),
  grade('neon-midnight', 'Leonida Neon', '#21e6ff', '#ff3ec8', '60, 220, 255', [[18, 20, 92], [170, 246, 255]],
    ['#03041c', '#122a78', '#8a1fa0', '#ff45a8', '#a6f6ff'], ['#05061f', '#3a1680', '#ff3aa8'],
    { night: true, map: 0.32, skyMix: 0.92, gamma: 1.16, exposure: 1.1, bloom: 0.55, rim: 0.95, vibrance: 0.4, sister: 'ocean-drive' }),
  grade('coastal-day', 'Coastal Classic', '#14d6c6', '#ff9a4a', '255, 214, 150', [[8, 50, 66], [255, 226, 172]],
    ['#06283a', '#0b6f80', '#2fc2b8', '#ffb877', '#fff4dc'], ['#1f8fc0', '#7fdcd9', '#ffc480'],
    { map: 0.2, skyMix: 0.5, gamma: 1.06, exposure: 1.06, bloom: 0.34, rim: 0.42, vibrance: 0.42, sister: 'palm-gold' }),
  grade('midnight-heat', 'Midnight Heat', '#ff3d3d', '#ffb02e', '255, 120, 60', [[48, 8, 44], [255, 196, 120]],
    ['#0c0310', '#3a0a2a', '#b3122f', '#ff6a2a', '#ffe0a0'], ['#12041e', '#6a0f3e', '#ff5a2a'],
    { night: true, map: 0.3, skyMix: 0.88, gamma: 1.12, exposure: 1.08, bloom: 0.5, rim: 0.8, vibrance: 0.36, sister: 'vice-sunset' }),
  grade('palm-gold', 'Palm Gold', '#ffbf3c', '#ff6a3a', '255, 196, 98', [[60, 24, 18], [255, 236, 182]],
    ['#200f08', '#5e260d', '#b85b16', '#ffb84a', '#fff6d2'], ['#4d1a2e', '#ff7b3d', '#ffd36b'],
    { map: 0.34, skyMix: 0.72, gamma: 1.08, exposure: 1.08, bloom: 0.3, rim: 0.4, vibrance: 0.3, sister: 'vice-sunset' }),
  grade('ocean-drive', 'Ocean Drive', '#22d7c6', '#ff5fb4', '86, 240, 220', [[8, 36, 58], [222, 255, 236]],
    ['#031a22', '#0a4656', '#11909a', '#56e2cf', '#fff1c8'], ['#1b1257', '#9b2c9a', '#ff9f7a'],
    { map: 0.36, skyMix: 0.72, gamma: 1.12, exposure: 1.08, bloom: 0.32, rim: 0.55, vibrance: 0.34, sister: 'neon-midnight' }),
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

// Edition badges for the corner seal: all original, none is a game or publisher mark.
export const EDITIONS = ['SOLARIS EDITION', "COLLECTOR'S CUT", 'COASTAL SERIES', 'MIDNIGHT CUT', 'SUNSET EDITION'];
