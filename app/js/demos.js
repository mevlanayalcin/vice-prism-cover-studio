// The quick covers behind the Quick cover buttons and ?demo= links (size, layout, grade, type
// finish, caption, edition seal, box-art marks, the photo in every panel and any per-panel shot),
// loaded on first use. Each one casts a different photo in every panel, so no cover repeats a
// picture, and each pairs a layout with a look so the three read as one collector's series.

import { DEFAULT_TITLE, panelsFor, STICKER_DEFAULTS } from './editor-state.js';

const demo = (size, layout, grade, fontStyle, [title, subtitle, tagline, badge], cast, extra = {}) => ({ size, layout, grade, fontStyle, cast, caption: { title, subtitle, tagline, badge, platform: 'COLLECTOR EDITION' }, panels: {}, stickers: {}, ...extra });

export const DEMOS = {
  cover: demo('landscape', 'classic7', 'vice-sunset', 'chrome', ['VICE HORIZON', 'A Leonida Story', 'Vice Prism presents', 'SOLARIS EDITION'],
    ['heli', 'boulevard', 'rooftop', 'ocean-drive', 'coupe', 'speedboat', 'pier']),
  neon: demo('portrait', 'asym7', 'neon-midnight', 'neon', ['LEONIDA NIGHTS', 'After Hours on Ocean Drive', 'Ocean Drive · 2:14 AM', 'MIDNIGHT CUT'],
    ['heli', 'rooftop', 'neon-street', 'boulevard', 'ocean-drive', 'coupe', 'speedboat']),
  coast: demo('square', 'diagonal5', 'coastal-day', 'sunset', ['MIAMI DRIFT', 'Golden Hour Run', 'Palm Coast · Causeway', "COLLECTOR'S CUT"],
    ['coupe', 'speedboat', 'heli', 'boulevard', 'pier'], {
      stickers: { keyline: true },
      // the whole coupe with air round both bumpers: the widest crop, centred a touch left of the car
      panels: { 0: { manualFocus: true, zoom: 1, focusX: 0.49, focusY: 0.6 } },
    }),
  heat: demo('landscape', 'hero-split', 'midnight-heat', 'heavy', ['MIDNIGHT HEAT', 'The Causeway Job', 'Vice Prism presents', 'COASTAL SERIES'],
    ['neon-street', 'heli', 'coupe', 'speedboat']),
};

export function applyDemo(state, name) {
  const d = DEMOS[name];
  if (!d) return state;
  Object.assign(state, {
    size: d.size, layout: d.layout, grade: d.grade, fontStyle: d.fontStyle, textPosition: 'auto', mode: 'multi', title: { ...DEFAULT_TITLE },
    panels: panelsFor(d.layout, d.cast), caption: { ...d.caption }, stickers: { ...STICKER_DEFAULTS, ...d.stickers }, activePanel: 1,
  });
  for (const [i, o] of Object.entries(d.panels)) Object.assign(state.panels[i], o);
  return state;
}
