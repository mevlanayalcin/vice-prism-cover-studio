// Named demo covers for links and the screenshots (size, layout, grade, type, caption and any
// per-panel crop), loaded only when a ?demo= link asks for one.

import { panelsFor, STICKER_DEFAULTS } from './editor-state.js';

const demo = (size, layout, grade, fontStyle, [title, subtitle, tagline, badge], panels = {}) => ({ size, layout, grade, fontStyle, panels, caption: { title, subtitle, tagline, badge, platform: 'CONSOLE EDITION' } });
export const DEMOS = {
  cover: demo('landscape', 'classic7', 'vice-sunset', 'chrome', ['VICE HORIZON', 'A Leonida Story', 'VICE PRISM · LEONIDA', 'SUNSET EDITION'], { 3: { manualFocus: true, zoom: 1, focusY: 0.42 } }),
  neon: demo('portrait', 'asym9', 'neon-midnight', 'neon', ['LEONIDA NIGHTS', 'After Hours on Ocean Drive', 'OCEAN DRIVE · 02:14 AM', 'MIDNIGHT CUT'], { 4: { flip: true, zoom: 2.2 } }),
  coast: demo('square', 'panorama', 'coastal-day', 'riviera', ['MIAMI DRIFT', 'Turquoise Season', 'PALM COAST · HIGH TIDE', 'RIVIERA EDITION']),
};

export function applyDemo(state, name) {
  const d = DEMOS[name];
  if (!d) return state;
  Object.assign(state, { size: d.size, layout: d.layout, grade: d.grade, fontStyle: d.fontStyle, textPosition: 'auto', panels: panelsFor(d.layout), caption: { ...d.caption }, stickers: { ...STICKER_DEFAULTS }, activePanel: 1 });
  for (const [i, o] of Object.entries(d.panels)) Object.assign(state.panels[i], o);
  return state;
}
