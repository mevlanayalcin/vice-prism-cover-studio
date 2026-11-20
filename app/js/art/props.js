// Props: the set pieces of every Leonida illustration (palms, Art Deco skylines and hotels, coupes,
// a speedboat, a searchlight helicopter, flamingos, sea and light trails). Each is drawn in its own
// local units and placed with a transform, so it stays crisp at any panel size.

import { INK, P, TAU, crescent, flare, glow, halftone, inked, lin, rad, rng, windows } from './ink-kit.js';

const fade = (color, a) => color.replace(/[\d.]+\)$/, `${a})`);
const quad = (a, b, c, t) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;

function fillPoly(ctx, pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function hexA(hex, a) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function palmShape(ctx, x, y, h, lean, seed, color, width) {
  const r = rng(seed);
  const tx = x + lean * h;
  const ty = y - h;
  const cx = x + lean * h * 0.15;
  const cy = y - h * 0.55;
  Object.assign(ctx, { fillStyle: color, strokeStyle: color });
  const left = [];
  const right = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const px = quad(x, cx, tx, t);
    const py = quad(y, cy, ty, t);
    const wv = h * (0.032 - t * 0.014) * width;
    left.push([px - wv, py]);
    right.push([px + wv, py]);
  }
  ctx.beginPath();
  for (const [px, py] of [...left, ...right.reverse()]) ctx.lineTo(px, py);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 9 - 0.5) * 3.2 + (r() - 0.5) * 0.3;
    const L = h * (0.4 + r() * 0.16);
    const ex = tx + Math.cos(a) * L * 0.92;
    const ey = ty + Math.sin(a) * L * 0.4 + L * 0.66 * Math.abs(Math.cos(a));
    const qx = tx + Math.cos(a) * L * 0.6;
    const qy = ty + Math.sin(a) * L * 0.6 - L * 0.24;
    const top = [];
    const low = [];
    for (let k = 0; k <= 22; k++) {
      const t = k / 22;
      const px = quad(tx, qx, ex, t);
      const py = quad(ty, qy, ey, t);
      const dx = 2 * (1 - t) * (qx - tx) + 2 * t * (ex - qx);
      const dy = 2 * (1 - t) * (qy - ty) + 2 * t * (ey - qy);
      const len = Math.hypot(dx, dy) || 1;
      const wv = L * 0.1 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), 0.7) * (k % 2 ? 0.5 : 1);
      const sag = L * 0.05 * t * (k % 2 ? 0.2 : 1);
      const ox = (dx / len) * wv * 0.5;
      top.push([px - (dy / len) * wv + ox, py + (dx / len) * wv + sag]);
      low.push([px + (dy / len) * wv + ox, py - (dx / len) * wv + sag]);
    }
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    for (const [px, py] of [...top, ...low.reverse()]) ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  for (let k = 0; k < 3; k++) ctx.arc(tx + (k - 1) * h * 0.016, ty + h * 0.018, h * 0.016, 0, TAU);
  ctx.fill();
}

export function palm(ctx, x, y, h, { lean = 0.12, color = INK, rim = null, seed = 1, width = 1 } = {}) {
  if (rim) palmShape(ctx, x - h * 0.008, y - h * 0.004, h, lean, seed, rim, width);
  palmShape(ctx, x, y, h, lean, seed, color, width);
}

const ROOFS = [
  (x, w, top, h) => { const s = w * 0.14; return [x + s, top + h * 0.12, x + s, top + h * 0.05, x + s * 2, top + h * 0.05, x + s * 2, top, x + w - s * 2, top, x + w - s * 2, top + h * 0.05, x + w - s, top + h * 0.05, x + w - s, top + h * 0.12]; },
  (x, w, top, h) => [x + w * 0.3, top + h * 0.12, x + w * 0.42, top + h * 0.02, x + w * 0.5, top - h * 0.16, x + w * 0.58, top + h * 0.02, x + w * 0.7, top + h * 0.12],
  null,
  (x, w, top, h) => [x + w * 0.5, top + h * 0.12, x + w * 0.5, top, x + w * 0.52, top - h * 0.1, x + w * 0.54, top, x + w * 0.56, top + h * 0.12],
];

export function skyline(ctx, x0, x1, baseY, {
  seed = 4, minH = 120, maxH = 420, body = ['#2a1240', '#12061e'], lit = ['#ffd38a', '#ff9bd0'], dark = 'rgba(0,0,0,0.25)',
  neon = ['#ff3fa4', '#38e8ff'], windowChance = 0.38, haze = null, rimColor = 'rgba(255,200,140,0.7)',
} = {}) {
  const r = rng(seed);
  for (let x = x0; x < x1;) {
    const w = 46 + r() * 110;
    const h = minH + Math.pow(r(), 0.8) * (maxH - minH);
    const top = baseY - h;
    const kind = (r() * 4) | 0;
    const shape = new Path2D();
    shape.moveTo(x, baseY);
    shape.lineTo(x, top + h * 0.12);
    if (kind === 2) {
      shape.lineTo(x, top + w * 0.5);
      shape.arc(x + w / 2, top + w * 0.5, w / 2, Math.PI, 0);
    } else {
      const pts = ROOFS[kind](x, w, top, h);
      for (let i = 0; i < pts.length; i += 2) shape.lineTo(pts[i], pts[i + 1]);
    }
    shape.lineTo(x + w, top + h * 0.12);
    shape.lineTo(x + w, baseY);
    shape.closePath();
    ctx.fillStyle = lin(ctx, x, top, x + w, baseY, body);
    ctx.fill(shape);
    ctx.save();
    ctx.clip(shape);
    if (windowChance > 0) windows(ctx, x + 4, top + h * 0.16, w - 8, h * 0.84, Math.max(3, Math.round(w / 11)), Math.round(h / 13), lit, dark, (r() * 1e6) | 0, windowChance);
    for (const [fill, dx, ww] of [['rgba(6,2,12,0.42)', w * 0.64, w], ['rgba(10,10,13,0.5)', w * 0.64, 2.5], [rimColor, 0, 3]]) {
      ctx.fillStyle = fill;
      ctx.fillRect(x + dx, top - h, ww, h * 2);
    }
    ctx.restore();
    const c = neon[(r() * neon.length) | 0];
    Object.assign(ctx, { strokeStyle: c, lineWidth: 2.4 });
    ctx.beginPath();
    ctx.moveTo(x + 2, top + h * 0.12 + 2);
    ctx.lineTo(x + w - 2, top + h * 0.12 + 2);
    if (r() < 0.5) {
      ctx.moveTo(x + w * 0.5, top + h * 0.2);
      ctx.lineTo(x + w * 0.5, baseY - h * 0.05);
    }
    ctx.stroke();
    glow(ctx, x + w / 2, top + h * 0.12, w * 0.7, c.startsWith('#') ? hexA(c, 0.5) : c, 0.5);
    if (haze) {
      ctx.fillStyle = lin(ctx, 0, top, 0, baseY, [fade(haze, 0), haze]);
      ctx.fill(shape);
    }
    x += w + r() * 10 - 2;
  }
}

export function decoHotel(ctx, x, y, w, h, {
  wall = ['#f6d7c3', '#e9a9a0'], shade = 'rgba(80,20,60,0.35)', trim = '#2fd3c8', sign = 'PRISM', signColor = '#ff3fa4',
  night = false, seed = 2, glass = ['#5ad7e0', '#1b5f7d'],
} = {}) {
  const r = rng(seed);
  const body = P(`M${x} ${y + h}V${y + h * 0.18}Q${x} ${y + h * 0.1} ${x + w * 0.08} ${y + h * 0.1}H${x + w * 0.34}V${y + h * 0.02}H${x + w * 0.66}V${y + h * 0.1}H${x + w * 0.92}Q${x + w} ${y + h * 0.1} ${x + w} ${y + h * 0.18}V${y + h}Z`);
  inked(ctx, body, lin(ctx, x, y, x + w, y + h, wall), 4);
  crescent(ctx, body, -w * 0.06, 0, shade, 1);
  for (let i = 0; i < 6; i++) {
    const ly = y + h * (0.24 + i * 0.125);
    for (const [fill, dy, rx, rw, rh] of [['rgba(10,10,13,0.28)', 6, 0.04, 0.92, h * 0.03], [night ? '#1a1030' : '#fff6ea', 0, 0.03, 0.94, 7], [trim, 7, 0.03, 0.94, 2.5]]) {
      ctx.fillStyle = fill;
      ctx.fillRect(x + w * rx, ly + dy, w * rw, rh);
    }
    for (const c of [0, 1, 4, 5]) {
      const wx = x + w * (0.07 + c * 0.145);
      const wy = ly + h * 0.035;
      const ww = w * 0.1;
      const wh = h * 0.06;
      ctx.fillStyle = night ? (r() < 0.55 ? '#ffd38a' : '#2a1846') : lin(ctx, wx, wy, wx + ww, wy + wh, glass);
      ctx.fillRect(wx, wy, ww, wh);
      Object.assign(ctx, { strokeStyle: INK, lineWidth: 2 });
      ctx.strokeRect(wx, wy, ww, wh);
      if (!night) {
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(wx + ww * 0.1, wy + wh * 0.12, ww * 0.18, wh * 0.7);
      }
    }
  }
  const fx = x + w * 0.4;
  const fw = w * 0.2;
  inked(ctx, P(`M${fx} ${y - h * 0.08}H${fx + fw}V${y + h * 0.86}H${fx}Z`), night ? '#140a24' : lin(ctx, fx, 0, fx + fw, 0, ['#fffaf1', '#f0cdbf']), 4);
  const letters = [...sign];
  const step = (h * 0.86) / (letters.length + 0.6);
  ctx.save();
  Object.assign(ctx, { font: `900 ${Math.min(fw * 0.82, step * 0.86)}px 'VP Display', 'Arial Black', sans-serif`, textAlign: 'center', textBaseline: 'middle' });
  letters.forEach((ch, i) => {
    const ly = y - h * 0.02 + step * (i + 0.8);
    if (night) glow(ctx, fx + fw / 2, ly, fw * 0.9, hexA(signColor, 0.65), 0.7);
    Object.assign(ctx, { lineWidth: 5, strokeStyle: INK, fillStyle: night ? '#fff0fb' : signColor });
    ctx.strokeText(ch, fx + fw / 2, ly);
    ctx.fillText(ch, fx + fw / 2, ly);
    if (night) {
      Object.assign(ctx, { lineWidth: 2, strokeStyle: signColor });
      ctx.strokeText(ch, fx + fw / 2, ly);
    }
  });
  ctx.restore();
  for (const px of [x + w * 0.22, x + w * 0.78]) {
    const port = new Path2D();
    port.arc(px, y + h * 0.16, w * 0.04, 0, TAU);
    inked(ctx, port, night ? '#ffd38a' : '#5ad7e0', 3);
  }
  inked(ctx, P(`M${x - w * 0.02} ${y + h * 0.9}H${x + w * 1.02}L${x + w * 0.96} ${y + h * 0.95}H${x + w * 0.04}Z`), trim, 3);
  if (night) {
    Object.assign(ctx, { strokeStyle: signColor, lineWidth: 3 });
    ctx.stroke(body);
    glow(ctx, x + w / 2, y + h * 0.5, w * 0.9, hexA(signColor, 0.25), 0.8);
  }
}

const CARS = {
  super: {
    body: 'M28 232L18 176Q22 146 64 136L330 112Q420 50 528 46Q610 48 668 100L944 148Q992 156 996 192L986 232L884 236A84 84 0 0 0 716 236L294 236A84 84 0 0 0 126 236Z',
    glass: 'M372 116Q438 70 526 64Q596 66 640 104L612 114L392 124Z',
    vent: 'M548 152L714 142L700 190L590 196Z',
    lines: 'M300 176L960 178M640 112L600 228M330 124Q520 104 668 112',
    head: [978, 168],
    tail: [26, 168],
    belt: 0.48,
  },
  muscle: {
    body: 'M20 236L18 168L120 148L312 140L404 82Q500 70 600 82L700 140L956 150Q990 154 992 176L988 236L888 238A84 84 0 0 0 712 238L292 238A84 84 0 0 0 128 238Z',
    glass: 'M420 94Q500 84 590 92L668 140L404 142Z',
    vent: 'M760 178L900 178',
    lines: 'M24 196L986 196M560 92L560 232M704 142L708 232',
    head: [982, 176],
    tail: [22, 170],
    belt: 0.55,
  },
};

function wheel(ctx, cx, cy, r, rim) {
  const tire = new Path2D();
  tire.arc(cx, cy, r, 0, TAU);
  inked(ctx, tire, '#111117', 4);
  const hub = new Path2D();
  hub.arc(cx, cy, r * 0.66, 0, TAU);
  inked(ctx, hub, rad(ctx, cx - r * 0.2, cy - r * 0.25, 2, r * 0.7, [rim, '#4b4b58']), 3);
  Object.assign(ctx, { strokeStyle: INK, lineWidth: 6 });
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    ctx.moveTo(cx + Math.cos(a) * r * 0.16, cy + Math.sin(a) * r * 0.16);
    ctx.lineTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.24, cy - r * 0.3, r * 0.1, 0, TAU);
  ctx.fill();
}

export function car(ctx, x, y, w, {
  kind = 'super', paint = '#ff2d6f', paintDark = '#5a0627', skyTop = '#ffe2a8', skyMid = '#ff7a8a', glass = ['#2a1240', '#ff9a7a'],
  rim = '#f4f1ff', flip = false, rimLight = '#ffd38a',
} = {}) {
  const spec = CARS[kind] ?? CARS.super;
  const k = w / 1000;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -k : k, k);
  ctx.translate(-500, -300);
  ctx.fillStyle = 'rgba(5,3,8,0.55)';
  ctx.beginPath();
  ctx.ellipse(505, 298, 520, 22, 0, 0, TAU);
  ctx.fill();
  const body = P(spec.body);
  const b = spec.belt;
  inked(ctx, body, lin(ctx, 0, 40, 0, 240, [[0, skyTop], [b * 0.62, skyMid], [b, paint], [b + 0.01, paintDark], [0.86, paint], [1, paintDark]]), 7);
  crescent(ctx, body, 0, -9, 'rgba(255,250,235,0.8)', 0.9);
  crescent(ctx, body, 0, 22, 'rgba(10,6,14,0.5)', 1);
  ctx.save();
  ctx.clip(body);
  halftone(ctx, null, 'rgba(10,10,13,1)', 0.25, 0.8);
  ctx.globalCompositeOperation = 'lighter';
  fillPoly(ctx, [380, 150, 820, 158, 800, 166, 360, 160], 'rgba(255,240,220,0.5)');
  ctx.restore();
  inked(ctx, P(spec.glass), lin(ctx, 380, 60, 640, 130, glass), 5);
  ctx.save();
  ctx.clip(P(spec.glass));
  fillPoly(ctx, [470, 50, 520, 50, 450, 140, 420, 140], 'rgba(255,255,255,0.45)');
  ctx.restore();
  inked(ctx, P(spec.vent), 'rgba(10,10,13,0.85)', 4);
  Object.assign(ctx, { strokeStyle: 'rgba(10,10,13,0.7)', lineWidth: 3 });
  ctx.stroke(P(spec.lines));
  for (const wx of [210, 800]) wheel(ctx, wx, 236, 70, rim);
  const [hx, hy] = spec.head;
  const [tx, ty] = spec.tail;
  ctx.fillStyle = '#fffbe8';
  ctx.fillRect(hx - 30, hy - 7, 30, 14);
  ctx.fillStyle = '#ff2742';
  ctx.fillRect(tx, ty - 7, 26, 14);
  glow(ctx, tx + 8, ty, 90, 'rgba(255,40,70,0.8)', 0.9);
  flare(ctx, hx, hy, 70, 'rgba(255,244,220,0.95)');
  Object.assign(ctx, { strokeStyle: rimLight, globalAlpha: 0.85, lineWidth: 4 });
  ctx.beginPath();
  ctx.moveTo(340, 112);
  ctx.quadraticCurveTo(430, 52, 528, 48);
  ctx.stroke();
  ctx.restore();
}

export function speedboat(ctx, x, y, w, { hull = '#fbf6ee', stripe = '#ff3f7f', stripe2 = '#28d9d0', foam = '#ffffff', water = '#1fc3c9', flip = false } = {}) {
  const k = w / 1000;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -k : k, k);
  ctx.translate(-500, -200);
  ctx.fillStyle = lin(ctx, -520, 0, 80, 0, ['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)']);
  ctx.fill(P('M60 196Q-200 170 -520 230L-520 300Q-180 236 80 226Z'));
  Object.assign(ctx, { strokeStyle: 'rgba(255,255,255,0.8)', lineWidth: 6 });
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    ctx.moveTo(40 - i * 30, 206 + i * 6);
    ctx.quadraticCurveTo(-180 - i * 40, 190 + i * 14, -480, 236 + i * 14);
  }
  ctx.stroke();
  const hullPath = P('M40 150L930 104Q1000 104 990 128L760 226Q700 240 600 240L90 232Q50 228 40 200Z');
  inked(ctx, hullPath, lin(ctx, 0, 100, 0, 240, [hull, hull, '#c9c2bd']), 7);
  ctx.save();
  ctx.clip(hullPath);
  fillPoly(ctx, [40, 176, 960, 120, 950, 146, 40, 202], stripe);
  fillPoly(ctx, [40, 208, 900, 156, 880, 168, 40, 220], stripe2);
  crescent(ctx, hullPath, 0, 22, 'rgba(20,30,60,0.35)', 1);
  ctx.restore();
  inked(ctx, P('M180 150L700 118L720 132L200 160Z'), '#2c2c38', 5);
  inked(ctx, P('M520 124L600 66L660 70L640 120Z'), lin(ctx, 520, 60, 660, 130, ['rgba(140,240,255,0.9)', 'rgba(20,60,90,0.9)']), 5);
  inked(ctx, P('M420 128Q420 74 456 72Q490 72 488 128Z'), INK, 3);
  inked(ctx, P('M436 70Q456 40 476 64Q470 78 452 78Z'), INK, 3);
  inked(ctx, P('M640 236Q760 170 880 190Q980 150 1040 210Q960 224 900 240Q780 262 640 250Z'), foam, 4);
  Object.assign(ctx, { fillStyle: water, globalAlpha: 0.55 });
  ctx.fill(P('M660 246Q800 226 1000 230Q860 252 660 256Z'));
  Object.assign(ctx, { globalAlpha: 1, fillStyle: foam });
  const r = rng(7);
  for (let i = 0; i < 26; i++) {
    ctx.beginPath();
    ctx.arc(700 + r() * 380, 150 + r() * 80, 4 + r() * 10, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function helicopter(ctx, x, y, w, { body = '#1b1b26', trim = '#38e8ff', beamTo = null, beam = 'rgba(220,250,255,0.5)', flip = false } = {}) {
  const k = w / 1000;
  const dir = flip ? -1 : 1;
  if (beamTo) {
    const [bx, by] = beamTo;
    const sx = x + dir * w * 0.12;
    const sy = y + w * 0.1;
    const spread = Math.hypot(bx - sx, by - sy) * 0.22;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = lin(ctx, sx, sy, bx, by, [beam, fade(beam, 0.08)]);
    ctx.beginPath();
    for (const [px, py] of [[sx - 6, sy], [bx - spread, by], [bx + spread, by], [sx + 6, sy]]) ctx.lineTo(px, py);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rad(ctx, bx, by, 0, spread * 1.1, [fade(beam, 0.5), fade(beam, 0)]);
    ctx.beginPath();
    ctx.ellipse(bx, by, spread * 1.1, spread * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * k, k);
  ctx.translate(-380, -160);
  inked(ctx, P('M40 120L470 132L470 166L40 140Z'), body, 6);
  inked(ctx, P('M20 70L70 70L90 140L40 140Z'), body, 6);
  const cabin = P('M300 110Q330 60 440 56Q600 56 650 120Q690 170 640 220L380 226Q300 222 300 170Z');
  inked(ctx, cabin, lin(ctx, 0, 60, 0, 226, ['#3b3b52', body, '#08080c']), 7);
  crescent(ctx, cabin, 0, 12, trim, 0.9);
  inked(ctx, P('M520 72Q620 74 650 124Q668 160 640 176L520 170Z'), lin(ctx, 520, 70, 660, 176, ['rgba(160,250,255,0.95)', 'rgba(20,80,110,0.95)']), 5);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(560, 86, 14, 70);
  Object.assign(ctx, { strokeStyle: INK, lineWidth: 8 });
  ctx.stroke(P('M330 246L680 246M400 226L390 246M600 222L610 246M470 56L470 30'));
  ctx.fillStyle = 'rgba(200,220,255,0.18)';
  ctx.beginPath();
  ctx.ellipse(470, 28, 470, 26, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillRect(40, 22, 860, 9);
  ctx.beginPath();
  ctx.arc(40, 92, 54, 0, TAU);
  ctx.fillStyle = 'rgba(200,220,255,0.2)';
  ctx.fill();
  ctx.restore();
  flare(ctx, x + dir * w * 0.12, y + w * 0.1, w * 0.07, 'rgba(255,250,220,1)');
  glow(ctx, x - dir * w * 0.33, y - w * 0.07, w * 0.06, 'rgba(255,50,70,0.9)');
}

export function flamingo(ctx, x, y, h, { flip = false, pink = '#ff6fa6', deep = '#e33a7d' } = {}) {
  const k = h / 1000;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -k : k, k);
  ctx.translate(-300, -1000);
  const legs = P('M300 560L310 1000M320 560L380 760L300 800');
  for (const [color, width] of [[INK, 30], ['#ff9cbc', 14]]) {
    Object.assign(ctx, { strokeStyle: color, lineCap: 'round', lineWidth: width });
    ctx.stroke(legs);
  }
  const bodyPath = P('M120 470Q160 360 330 380Q470 396 500 470Q470 560 330 580Q200 586 150 540Q90 530 60 560Q80 500 120 470Z');
  inked(ctx, bodyPath, lin(ctx, 0, 380, 0, 580, ['#ffc2d6', pink, deep]), 12);
  crescent(ctx, bodyPath, 0, 40, 'rgba(120,10,60,0.4)', 1);
  const neck = P('M420 420Q520 330 460 220Q400 120 470 70Q540 30 590 90L560 120Q520 80 500 110Q470 150 520 240Q580 360 470 460Z');
  inked(ctx, neck, pink, 12);
  crescent(ctx, neck, 10, 0, 'rgba(255,255,255,0.6)', 1);
  inked(ctx, P('M580 84Q650 100 660 170Q640 150 600 140L565 118Z'), '#fff2e8', 10);
  inked(ctx, P('M640 140Q660 160 660 182Q630 168 612 146Z'), INK, 6);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(536, 84, 9, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function sea(ctx, x, y, w, h, stops, { seed = 3, glints = '#ffffff', lines = 'rgba(10,10,13,0.35)' } = {}) {
  ctx.fillStyle = lin(ctx, 0, y, 0, y + h, stops);
  ctx.fillRect(x, y, w, h);
  const r = rng(seed);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const t = Math.pow(r(), 1.3);
    const yy = y + t * h;
    const len = 18 + t * 120;
    const xx = x + r() * w;
    Object.assign(ctx, { strokeStyle: r() < 0.6 ? glints : lines, globalAlpha: 0.35 + r() * 0.5, lineWidth: 1.5 + t * 4 });
    ctx.beginPath();
    ctx.moveTo(xx - len / 2, yy);
    ctx.quadraticCurveTo(xx, yy - 4 - t * 6, xx + len / 2, yy);
    ctx.stroke();
  }
  ctx.restore();
}

export function lightTrails(ctx, x0, y0, x1, y1, colors, count = 6, spread = 24) {
  ctx.save();
  Object.assign(ctx, { globalCompositeOperation: 'lighter', lineCap: 'round' });
  for (let i = 0; i < count; i++) {
    const off = (i - count / 2) * spread * 0.4;
    Object.assign(ctx, { strokeStyle: colors[i % colors.length], lineWidth: 3 + (i % 3) * 2, globalAlpha: 0.8 });
    ctx.beginPath();
    ctx.moveTo(x0, y0 + off);
    ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + off - spread, x1, y1 + off * 2.2);
    ctx.stroke();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth *= 4;
    ctx.stroke();
  }
  ctx.restore();
}
