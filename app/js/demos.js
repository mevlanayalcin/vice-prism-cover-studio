// The three quick covers behind the Quick cover buttons and ?demo= links (size, layout, grade,
// type finish, caption, the photo in every panel and any per-panel shot), loaded on first use.
// Each one casts a different photo in every panel, so no cover repeats a picture.

import { panelsFor, STICKER_DEFAULTS } from './editor-state.js';

const demo = (size, layout, grade, fontStyle, [title, subtitle, tagline, badge], cast, panels = {}) => ({ size, layout, grade, fontStyle, cast, panels, caption: { title, subtitle, tagline, badge, platform: 'COLLECTOR EDITION' } });

export const DEMOS = {
  cover: demo('landscape', 'classic7', 'vice-sunset', 'chrome', ['VICE HORIZON', 'A Leonida Story', 'Vice Prism presents', 'SUNSET EDITION'],
    ['heli', 'boulevard', 'rooftop', 'ocean-drive', 'coupe', 'speedboat', 'pier']),
  neon: demo('portrait', 'asym7', 'neon-midnight', 'neon', ['LEONIDA NIGHTS', 'After Hours on Ocean Drive', 'Ocean Drive · 2:14 AM', 'MIDNIGHT CUT'],
    ['heli', 'rooftop', 'neon-street', 'boulevard', 'ocean-drive', 'coupe', 'speedboat']),
  coast: demo('square', 'diagonal5', 'coastal-day', 'sunset', ['MIAMI DRIFT', 'Turquoise Season', 'Palm Coast · High Tide', 'RIVIERA EDITION'],
    ['speedboat', 'coupe', 'heli', 'boulevard', 'pier']),
};

export function applyDemo(state, name) {
  const d = DEMOS[name];
  if (!d) return state;
  Object.assign(state, { size: d.size, layout: d.layout, grade: d.grade, fontStyle: d.fontStyle, textPosition: 'auto', panels: panelsFor(d.layout, d.cast), caption: { ...d.caption }, stickers: { ...STICKER_DEFAULTS }, activePanel: 1 });
  for (const [i, o] of Object.entries(d.panels)) Object.assign(state.panels[i], o);
  return state;
}
