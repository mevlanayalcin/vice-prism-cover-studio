// Eight original Leonida illustrations, each composed edge to edge in a 1600 × 1000 stage so any
// crop a panel takes lands on painted content. A scene is a vector draw function, not a bitmap:
// the renderer calls it at the panel's own resolution, so every cut is crisp at every export
// size. `focus` is the subject box (normalised) the crop planner keeps whole.

import { INK, bandedSun, cloudStreaks, flare, glow, halftone, hatch, lin, rad, reflections, rng, sky } from './ink-kit.js';
import { car, decoHotel, flamingo, helicopter, hexA, lightTrails, palm, sea, skyline, speedboat } from './props.js';
import { FIGURE_PALETTES, driver, haloBehind, heiress, standingFigure } from './figures.js';

export const STAGE_W = 1600;
export const STAGE_H = 1000;

const SUNSET_SKY = ['#1d0836', '#5a1468', '#c4247e', '#ff5f6d', '#ffb15a', '#ffe3a0'];
const NIGHT_SKY = ['#05051a', '#140c3a', '#3a1470', '#7a1f8a', '#d0307e'];
const DAY_SKY = ['#3fb8d6', '#7fd6df', '#c6efe6', '#fff1d6'];

// Time of day is set per draw: a night grade re-lights the sunset and daylight scenes, so a
// Neon Night cover never mixes a noon harbour with a midnight boulevard.
let night = false;
const tone = (day, dark) => (night ? dark : day);
const MOON = ['#fff6ff', '#ffb0e8', '#ff3fa4'];

/** The sun by day and dusk; a banded neon moon at night. */
function sun(ctx, x, y, r, stops, cuts) {
  if (!night) return bandedSun(ctx, x, y, r, stops, cuts);
  bandedSun(ctx, x, y, r * 0.8, MOON, cuts);
  glow(ctx, x, y, r * 2.2, 'rgba(255,63,164,0.35)', 0.8);
}

function vignette(ctx, strength = 0.55) {
  ctx.fillStyle = rad(ctx, 800, 500, 300, 1000, ['rgba(10,10,13,0)', `rgba(10,10,13,${strength})`]);
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
}

function sunsetGround(ctx, horizon) {
  sky(ctx, STAGE_W, horizon, tone(SUNSET_SKY, NIGHT_SKY), 9);
  cloudStreaks(ctx, -100, 90, 1800, 7, tone('rgba(255,170,120,0.55)', 'rgba(255,80,200,0.3)'), tone('rgba(120,30,90,0.55)', 'rgba(40,20,90,0.6)'), 21);
}
const CITY = () => (night ? { body: ['#22145a', '#0a0620'], lit: ['#ff7ad0', '#7af0ff', '#ffd38a'], windowChance: 0.45 } : {});

/** The Heiress at golden hour: banded sun behind her, palms and a hazy skyline. */
function viceHeiress(ctx) {
  sunsetGround(ctx, 1000);
  sun(ctx, 1120, 520, 300, ['#fff4b8', '#ffb347', '#ff3f7f']);
  skyline(ctx, -20, 1640, 820, { seed: 11, minH: 90, maxH: 300, body: ['#7a1f6a', '#3a0c42'], windowChance: 0.18, haze: tone('rgba(255,120,110,0.45)', 'rgba(120,40,200,0.4)'), ...CITY() });
  sea(ctx, 0, 820, STAGE_W, 180, tone(['#ff8a6a', '#7a1f6a'], ['#3a1a7a', '#0a0620']), { seed: 6, glints: tone('#ffe3a0', '#ff7ad0') });
  const rim = tone('#ffb15a', '#ff3fa4');
  palm(ctx, 1450, 1010, 820, { lean: -0.2, rim, seed: 6 });
  palm(ctx, 1290, 1010, 560, { lean: -0.32, rim, seed: 9 });
  palm(ctx, 90, 1010, 760, { lean: 0.22, rim, seed: 3 });
  hatch(ctx, 0, 0, 1600, 1000, 34, -0.35, 'rgba(255,230,190,0.08)', 3, 4);
  haloBehind(ctx, 640, 470, 520, tone('rgba(255,190,120,0.55)', 'rgba(255,63,164,0.45)'));
  heiress(ctx, 640, 1000, 1000, tone(FIGURE_PALETTES.sunset, FIGURE_PALETTES.neon));
  vignette(ctx, 0.4);
}

/** The Driver after midnight: neon deco fronts, rain-slick light and a cyan rim. */
function nightDriver(ctx) {
  sky(ctx, STAGE_W, STAGE_H, NIGHT_SKY, 0);
  skyline(ctx, -20, 1640, 760, { seed: 31, minH: 260, maxH: 640, body: ['#1c1446', '#0a0620'], lit: ['#ff7ad0', '#7af0ff', '#ffd38a'], windowChance: 0.42 });
  decoHotel(ctx, 40, 360, 360, 560, { night: true, sign: 'NOCTURNE', signColor: '#ff3fa4', trim: '#38e8ff' });
  decoHotel(ctx, 1240, 330, 340, 600, { night: true, sign: 'PALMS', signColor: '#38e8ff', trim: '#ff3fa4', seed: 5 });
  ctx.fillStyle = lin(ctx, 0, 760, 0, 1000, ['#1a0a3a', '#05030c']);
  ctx.fillRect(0, 900, STAGE_W, 100);
  reflections(ctx, 0, 900, STAGE_W, 100, ['#ff3fa4', '#38e8ff', '#ffd38a'], 8, 90);
  // rain streaks
  ctx.save();
  ctx.strokeStyle = 'rgba(180,220,255,0.22)';
  ctx.lineWidth = 2;
  const r = rng(77);
  ctx.beginPath();
  for (let i = 0; i < 220; i++) {
    const x = r() * 1700;
    const y = r() * 1000;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 16, y + 60);
  }
  ctx.stroke();
  ctx.restore();
  haloBehind(ctx, 900, 460, 560, 'rgba(120,60,255,0.55)');
  glow(ctx, 1240, 360, 420, 'rgba(56,232,255,0.5)', 0.8);
  driver(ctx, 900, 1000, 1000, FIGURE_PALETTES.neon, true);
  vignette(ctx, 0.5);
}

/** A wedge coupe flat out along the sunset causeway. */
function sunsetRun(ctx) {
  sunsetGround(ctx, 640);
  sun(ctx, 800, 520, 260, ['#fff4b8', '#ffb347', '#ff3f7f'], 7);
  skyline(ctx, 980, 1640, 600, { seed: 41, minH: 120, maxH: 380, body: ['#5a145a', '#2a0838'], windowChance: 0.3, ...CITY() });
  skyline(ctx, -40, 560, 600, { seed: 43, minH: 80, maxH: 260, body: ['#5a145a', '#2a0838'], windowChance: 0.3, ...CITY() });
  sea(ctx, 0, 600, STAGE_W, 200, tone(['#ff7a6a', '#9a2a7a', '#3a0c42'], ['#3a1a8a', '#1a0a4a', '#07041a']), { seed: 9, glints: tone('#ffe3a0', '#7af0ff') });
  reflections(ctx, 560, 610, 480, 180, tone(['#ffd38a', '#ff9a6a'], ['#ff7ad0', '#7af0ff']), 3, 60);
  // causeway deck and rail
  ctx.fillStyle = lin(ctx, 0, 780, 0, 1000, ['#2a0a36', '#12041a']);
  ctx.fillRect(0, 780, STAGE_W, 220);
  ctx.fillStyle = '#ff7a8a';
  ctx.fillRect(0, 780, STAGE_W, 8);
  ctx.fillStyle = INK;
  for (let x = 0; x < STAGE_W; x += 64) ctx.fillRect(x, 750, 10, 34);
  ctx.fillRect(0, 744, STAGE_W, 10);
  lightTrails(ctx, -40, 900, 1700, 870, ['rgba(255,60,90,0.9)', 'rgba(255,200,120,0.9)'], 6, 26);
  const rim = tone('#ffb15a', '#38e8ff');
  palm(ctx, 120, 790, 640, { lean: 0.18, rim, seed: 12 });
  palm(ctx, 1500, 790, 700, { lean: -0.22, rim, seed: 14 });
  palm(ctx, 1360, 790, 470, { lean: -0.12, rim, seed: 15 });
  car(ctx, 820, 930, 980, { kind: 'super', paint: '#ff2d6f', paintDark: '#5a0627', skyTop: tone('#ffe8b0', '#9af4ff'), skyMid: tone('#ff8a7a', '#8a3ad8'), rimLight: tone('#ffd38a', '#7af0ff') });
  hatch(ctx, 0, 820, 260, 160, 18, 0, 'rgba(255,220,200,0.35)', 3, 2);
  vignette(ctx, 0.35);
}

/** Neon boulevard: deco hotels, wet asphalt and a muscle coupe idling under the signs. */
function neonBoulevard(ctx) {
  sky(ctx, STAGE_W, 700, NIGHT_SKY, 0);
  skyline(ctx, 300, 1300, 760, { seed: 51, minH: 380, maxH: 660, body: ['#22145a', '#0c0626'], lit: ['#ff7ad0', '#7af0ff'], windowChance: 0.45 });
  decoHotel(ctx, -20, 160, 440, 600, { night: true, sign: 'CORAL', signColor: '#ff3fa4', trim: '#38e8ff', seed: 8 });
  decoHotel(ctx, 1180, 140, 440, 620, { night: true, sign: 'OASIS', signColor: '#38e8ff', trim: '#ffd36a', seed: 9 });
  // street, kerb neon and mirrored lights
  ctx.fillStyle = lin(ctx, 0, 740, 0, 1000, ['#2a0f52', '#07041a']);
  ctx.fillRect(0, 740, STAGE_W, 260);
  reflections(ctx, 0, 760, STAGE_W, 240, ['#ff3fa4', '#38e8ff', '#ffd38a', '#b46aff'], 12, 140);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 6;
  ctx.setLineDash([60, 50]);
  ctx.beginPath();
  ctx.moveTo(0, 960);
  ctx.lineTo(STAGE_W, 960);
  ctx.stroke();
  ctx.setLineDash([]);
  palm(ctx, 470, 760, 600, { lean: 0.12, rim: '#ff3fa4', seed: 21, color: '#07041a' });
  palm(ctx, 1140, 760, 640, { lean: -0.14, rim: '#38e8ff', seed: 22, color: '#07041a' });
  glow(ctx, 800, 840, 520, 'rgba(255,63,164,0.45)', 0.8);
  car(ctx, 800, 900, 900, { kind: 'muscle', paint: '#29d3e6', paintDark: '#0a2a55', skyTop: '#ffb0f0', skyMid: '#a04ad8', glass: ['#120a2a', '#ff3fa4'], rimLight: '#ff7ad0' });
  vignette(ctx, 0.45);
}

/** Speedboat run across turquoise water, skyline and a chase helicopter behind. */
function harborChase(ctx) {
  sky(ctx, STAGE_W, 520, tone(['#2a7fc8', '#62c7e0', '#ffd6a0', '#ff9a7a'], NIGHT_SKY), 6);
  sun(ctx, 300, 400, 150, ['#fff7d0', '#ffc46a', '#ff7a6a'], 5);
  skyline(ctx, -20, 1640, 500, night ? { seed: 61, minH: 90, maxH: 330, ...CITY() } : { seed: 61, minH: 90, maxH: 330, body: ['#f2c9b8', '#b0748a'], lit: ['#fff3d0'], dark: 'rgba(90,40,70,0.25)', windowChance: 0.25, neon: ['#28d9d0', '#ff7a8a'], rimColor: 'rgba(255,255,255,0.8)' });
  sea(ctx, 0, 500, STAGE_W, 500, tone(['#59e0d8', '#18a8b8', '#0a5a7a'], ['#2a2a8a', '#12104a', '#05041a']), { seed: 13, glints: tone('#ffffff', '#7af0ff'), lines: 'rgba(6,50,70,0.4)' });
  if (night) reflections(ctx, 0, 510, STAGE_W, 300, ['#ff7ad0', '#7af0ff', '#ffd38a'], 14, 110);
  speedboat(ctx, 360, 880, 420, { stripe: '#ffb347', flip: true, water: tone('#1fc3c9', '#3a2a9a') });
  speedboat(ctx, 900, 700, 1100, { water: tone('#1fc3c9', '#3a2a9a') });
  helicopter(ctx, 1220, 230, 520, { body: '#1b2a3a', trim: '#ffd36a', beam: 'rgba(255,250,220,0.32)', beamTo: [980, 760] });
  palm(ctx, 1540, 520, 420, { lean: -0.2, seed: 30, color: tone('#16323e', '#07041a'), rim: tone('#ffffff', '#ff3fa4') });
  hatch(ctx, 0, 880, 1600, 120, 16, 0, 'rgba(255,255,255,0.25)', 2, 9);
  vignette(ctx, 0.3);
}

/** Searchlight night: a helicopter combs the rooftops of a dense neon downtown. */
function heliSearch(ctx) {
  sky(ctx, STAGE_W, STAGE_H, ['#03030f', '#0e0a30', '#2a1060', '#6a1a7a'], 0);
  ctx.fillStyle = '#f4f0ff';
  ctx.beginPath();
  ctx.arc(320, 200, 90, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, 320, 200, 300, 'rgba(200,200,255,0.4)');
  skyline(ctx, -20, 1640, 1000, { seed: 71, minH: 380, maxH: 720, body: ['#1a1450', '#08061c'], lit: ['#ff7ad0', '#7af0ff', '#ffd38a'], windowChance: 0.5 });
  skyline(ctx, -60, 1660, 1000, { seed: 73, minH: 160, maxH: 380, body: ['#2a1060', '#0a0620'], lit: ['#ffd38a', '#ff7ad0'], windowChance: 0.5 });
  helicopter(ctx, 960, 300, 820, { beamTo: [560, 860], beam: 'rgba(210,250,255,0.55)', trim: '#38e8ff' });
  glow(ctx, 560, 860, 260, 'rgba(220,250,255,0.6)', 0.8);
  halftone(ctx, null, 'rgba(255,255,255,1)', 0.05, 1.2);
  vignette(ctx, 0.5);
}

/** Riviera morning: a pastel deco hotel, flamingos in the shallows, striped umbrellas. */
function flamingoRiviera(ctx) {
  sky(ctx, STAGE_W, 700, tone(DAY_SKY, NIGHT_SKY), 5);
  if (night) sun(ctx, 1300, 160, 110, MOON, 4);
  else cloudStreaks(ctx, -100, 80, 1800, 5, 'rgba(255,255,255,0.9)', 'rgba(150,220,230,0.7)', 5);
  decoHotel(ctx, 480, 110, 640, 600, { wall: ['#ffe6d4', '#f6b5a8'], trim: '#25c7c0', sign: 'RIVIERA', signColor: '#ff5a7a', seed: 4, night });
  decoHotel(ctx, 1150, 260, 420, 450, { wall: ['#d8f6ee', '#9fdcd6'], trim: '#ff8a6a', sign: 'SOL', signColor: tone('#ff7a3a', '#38e8ff'), seed: 6, night });
  decoHotel(ctx, 40, 240, 400, 470, { wall: ['#fff1c8', '#ffc98a'], trim: '#ff5a8a', sign: 'MAR', signColor: tone('#25a7c0', '#ffd36a'), seed: 7, night });
  ctx.fillStyle = lin(ctx, 0, 700, 0, 800, tone(['#ffe8c8', '#f6cfa0'], ['#3a2050', '#1a0a2a']));
  ctx.fillRect(0, 700, STAGE_W, 110);
  sea(ctx, 0, 800, STAGE_W, 200, tone(['#5be3d6', '#1ab0bf', '#0b7a94'], ['#2a2a8a', '#0a0830']), { seed: 17, glints: tone('#ffffff', '#ff7ad0') });
  for (const [ux, c1, c2] of [[300, '#ff5a7a', '#fff4e6'], [1300, '#25c7c0', '#fff4e6']]) {
    ctx.fillStyle = INK;
    ctx.fillRect(ux - 4, 640, 8, 140);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ux - 150, 650);
    ctx.quadraticCurveTo(ux, 540, ux + 150, 650);
    ctx.closePath();
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? c1 : c2;
      ctx.fillRect(ux - 150 + i * 50, 520, 50, 140);
    }
    ctx.restore();
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(ux - 150, 650);
    ctx.quadraticCurveTo(ux, 540, ux + 150, 650);
    ctx.closePath();
    ctx.stroke();
  }
  palm(ctx, 1520, 820, 760, { lean: -0.22, seed: 41, color: tone('#0e2a30', '#07041a'), rim: tone('#fff6d0', '#38e8ff') });
  palm(ctx, 80, 820, 700, { lean: 0.2, seed: 42, color: tone('#0e2a30', '#07041a'), rim: tone('#fff6d0', '#ff3fa4') });
  flamingo(ctx, 650, 990, 430, {});
  flamingo(ctx, 900, 980, 380, { flip: true });
  flamingo(ctx, 1080, 995, 300, {});
  hatch(ctx, 0, 0, 1600, 700, 30, -0.5, 'rgba(255,255,255,0.12)', 3, 2);
  vignette(ctx, 0.22);
}

/** The getaway: a lone figure by a muscle coupe, cut out against a giant dusk sun. */
function getawayDusk(ctx) {
  sunsetGround(ctx, 760);
  sun(ctx, 760, 520, 360, ['#fff4b8', '#ffb347', '#ff3f7f'], 8);
  skyline(ctx, -20, 1640, 760, { seed: 81, minH: 60, maxH: 220, body: ['#3a0c42', '#1a0624'], windowChance: 0.2, ...CITY() });
  ctx.fillStyle = lin(ctx, 0, 760, 0, 1000, ['#2a0838', '#0a030f']);
  ctx.fillRect(0, 760, STAGE_W, 240);
  reflections(ctx, 300, 770, 1000, 200, tone(['#ffb347', '#ff3f7f'], ['#ff7ad0', '#7af0ff']), 4, 60);
  const rim = tone('#ffb15a', '#ff3fa4');
  palm(ctx, 1300, 780, 720, { lean: -0.12, rim, seed: 51 });
  palm(ctx, 1480, 780, 860, { lean: -0.2, rim, seed: 52 });
  palm(ctx, 140, 780, 780, { lean: 0.2, rim, seed: 53 });
  car(ctx, 680, 920, 820, { kind: 'muscle', paint: '#1a0a22', paintDark: '#07030a', skyTop: '#ffc070', skyMid: '#ff5a6a', glass: ['#0a0410', '#ff7a5a'], rimLight: '#ffd38a', rim: '#ffb07a' });
  standingFigure(ctx, 1140, 960, 560, { rim });
  flare(ctx, 1080, 850, 60, 'rgba(255,230,190,0.9)', 0.6);
  vignette(ctx, 0.4);
}

export const SCENES = [
  { id: 'vice-heiress', label: 'The Heiress', mood: 'sunset', focus: { x: 0.4, y: 0.47, w: 0.26, h: 0.52 }, draw: viceHeiress },
  { id: 'sunset-run', label: 'Sunset Run', mood: 'sunset', focus: { x: 0.51, y: 0.82, w: 0.62, h: 0.3 }, draw: sunsetRun },
  { id: 'night-driver', label: 'Night Driver', mood: 'neon', focus: { x: 0.56, y: 0.46, w: 0.26, h: 0.52 }, draw: nightDriver },
  { id: 'neon-boulevard', label: 'Neon Boulevard', mood: 'neon', focus: { x: 0.5, y: 0.78, w: 0.58, h: 0.3 }, draw: neonBoulevard },
  { id: 'harbor-chase', label: 'Harbor Chase', mood: 'coast', focus: { x: 0.6, y: 0.48, w: 0.62, h: 0.62 }, draw: harborChase },
  { id: 'heli-search', label: 'Searchlight', mood: 'neon', focus: { x: 0.52, y: 0.4, w: 0.42, h: 0.4 }, draw: heliSearch },
  { id: 'flamingo-riviera', label: 'Riviera', mood: 'coast', focus: { x: 0.52, y: 0.62, w: 0.5, h: 0.6 }, draw: flamingoRiviera },
  { id: 'getaway-dusk', label: 'Getaway', mood: 'sunset', focus: { x: 0.56, y: 0.74, w: 0.56, h: 0.42 }, draw: getawayDusk },
];

/** Every scene as a gallery asset the renderer can draw at any size. */
export function illustratedAssets() {
  return SCENES.map((s) => ({
    ...s,
    illustrated: true,
    width: STAGE_W,
    height: STAGE_H,
    version: 3,
    draw(ctx, time) {
      night = time === 'night' && s.mood !== 'neon';
      try {
        s.draw(ctx);
      } finally {
        night = false;
      }
    },
  }));
}

export { hexA };
