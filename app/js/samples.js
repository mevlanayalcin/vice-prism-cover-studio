// Three original sample scenes, painted procedurally into canvases at startup. Together with the
// two starter photos they give every layout a rich first look with zero network requests and no
// borrowed artwork. These are deliberately scene-like: the cover pipeline turns them painterly.

const W = 1600;
const H = 1200;

function canvas2d(width = W, height = H) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return { c, ctx: c.getContext('2d') };
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sky(ctx, stops, top = 0, bottom = H) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  stops.forEach(([at, color]) => g.addColorStop(at, color));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, W, bottom - top);
}

function radial(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function sun(ctx, x, y, r, bands = 7) {
  radial(ctx, x, y, r * 3.1, 'rgba(255,196,110,0.42)', 'rgba(255,120,80,0)');
  const g = ctx.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff8cf');
  g.addColorStop(0.55, '#ffd87a');
  g.addColorStop(1, '#ff8b45');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  // retro horizontal cuts in the lower half of the disc
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  for (let i = 0; i < bands; i++) {
    const yy = y + r * (0.06 + i * 0.13);
    ctx.fillStyle = `rgba(54,8,62,${0.2 + i * 0.09})`;
    ctx.fillRect(x - r, yy, r * 2, r * (0.026 + i * 0.013));
  }
  ctx.restore();
}

function cloud(ctx, x, y, w, h, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.5);
  g.addColorStop(0, color);
  g.addColorStop(0.55, color.replace(/[\d.]+\)$/, '0.16)'));
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, h / w);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function palm(ctx, x, baseY, size, flip = false, color = 'rgba(13,3,20,0.96)') {
  ctx.save();
  ctx.translate(x, baseY);
  ctx.scale(flip ? -1 : 1, 1);
  ctx.fillStyle = color;
  const lean = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(-size * 0.036, 0);
  ctx.bezierCurveTo(size * 0.02, -size * 0.28, lean * 0.4, -size * 0.68, lean, -size * 1.02);
  ctx.lineTo(lean + size * 0.048, -size * 1.0);
  ctx.bezierCurveTo(lean * 0.55, -size * 0.64, size * 0.09, -size * 0.24, size * 0.022, 0);
  ctx.closePath();
  ctx.fill();
  const tx = lean + size * 0.02;
  const ty = -size * 1.02;
  const fronds = [
    [-2.88, 0.68, 0.36], [-2.58, 0.9, 0.2], [-2.2, 0.98, 0.0], [-1.82, 0.9, -0.16],
    [-1.5, 0.76, -0.2], [-0.62, 0.94, -0.28], [-0.28, 0.82, -0.2], [0.08, 0.7, -0.04], [-3.1, 0.56, 0.42],
  ];
  for (const [angle, len, droop] of fronds) {
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(angle);
    const L = size * len;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.24, -L * 0.12, L * 0.64, -L * 0.14, L, L * droop * 0.3);
    ctx.bezierCurveTo(L * 0.6, L * 0.09, L * 0.24, L * 0.07, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  for (const [dx, dy] of [[-0.02, 0], [0.032, 0.016], [-0.056, 0.024]]) {
    ctx.beginPath();
    ctx.arc(tx + size * dx, ty + size * dy, size * 0.024, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function glowLine(ctx, x1, y1, x2, y2, color, width, blur) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function sunsetCity() {
  const { c, ctx } = canvas2d();
  sky(ctx, [[0, '#150326'], [0.3, '#3c0a53'], [0.55, '#83145f'], [0.75, '#d92c62'], [0.9, '#ff7148'], [1, '#ffb25e']], 0, H * 0.7);

  const rand = rng(7719);
  // stars, fading before the sun's band
  for (let i = 0; i < 90; i++) {
    const x = rand() * W;
    const y = rand() * H * 0.32;
    ctx.fillStyle = `rgba(255,238,220,${0.08 + rand() * 0.4})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  cloud(ctx, W * 0.22, H * 0.17, W * 0.5, H * 0.09, 'rgba(255,152,160,0.3)');
  cloud(ctx, W * 0.78, H * 0.25, W * 0.42, H * 0.08, 'rgba(255,176,118,0.26)');
  cloud(ctx, W * 0.55, H * 0.1, W * 0.6, H * 0.06, 'rgba(150,90,180,0.2)');

  sun(ctx, W * 0.66, H * 0.535, W * 0.155);

  // distant skyline on the horizon
  const baseY = H * 0.705;
  let x = -20;
  while (x < W + 40) {
    const bw = 24 + rand() * 70;
    const bh = 26 + rand() * 150 * (0.5 + Math.abs(x - W * 0.62) / W);
    ctx.fillStyle = 'rgba(38,8,54,0.96)';
    ctx.fillRect(x, baseY - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,120,120,0.16)';
    ctx.fillRect(x, baseY - bh, bw, 2);
    for (let wy = baseY - bh + 10; wy < baseY - 8; wy += 13) {
      for (let wx = x + 6; wx < x + bw - 5; wx += 10) {
        if (rand() > 0.55) {
          ctx.fillStyle = rand() > 0.4 ? 'rgba(255,206,120,0.75)' : 'rgba(255,116,140,0.6)';
          ctx.fillRect(wx, wy, 3, 4);
        }
      }
    }
    x += bw + 6 + rand() * 14;
  }
  // a long low bridge
  ctx.strokeStyle = 'rgba(26,5,42,0.9)';
  ctx.lineWidth = 4;
  const bridgeY = H * 0.706;
  ctx.beginPath();
  ctx.moveTo(W * 0.46, bridgeY);
  for (let i = 0; i < 9; i++) {
    const bx = W * 0.46 + i * W * 0.062;
    ctx.quadraticCurveTo(bx + W * 0.015, bridgeY - H * 0.045, bx + W * 0.031, bridgeY);
  }
  ctx.stroke();

  // water
  const water = ctx.createLinearGradient(0, H * 0.705, 0, H);
  water.addColorStop(0, '#8c1d62');
  water.addColorStop(0.35, '#5a1150');
  water.addColorStop(1, '#210a3e');
  ctx.fillStyle = water;
  ctx.fillRect(0, H * 0.705, W, H * 0.295);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, H * 0.705, W, H * 0.295);
  ctx.clip();
  const sunX = W * 0.66;
  const shimmer = ctx.createLinearGradient(sunX - W * 0.13, 0, sunX + W * 0.13, 0);
  shimmer.addColorStop(0, 'rgba(255,180,90,0)');
  shimmer.addColorStop(0.5, 'rgba(255,194,96,0.55)');
  shimmer.addColorStop(1, 'rgba(255,180,90,0)');
  ctx.fillStyle = shimmer;
  ctx.fillRect(sunX - W * 0.13, H * 0.705, W * 0.26, H * 0.295);
  for (let i = 0; i < 190; i++) {
    const yy = H * 0.71 + rand() * H * 0.27;
    const len = 8 + rand() * 150 * (0.3 + (yy - H * 0.7) / H);
    const xx = rand() * W;
    ctx.fillStyle = `rgba(${rand() > 0.55 ? '255,218,142' : '255,130,150'},${0.04 + rand() * 0.22})`;
    ctx.fillRect(xx, yy, len, 1 + rand() * 2.6);
  }
  ctx.restore();

  // foreground palms
  palm(ctx, W * 0.1, H * 1.04, H * 0.78, false, 'rgba(10,2,15,0.98)');
  palm(ctx, W * 0.93, H * 1.06, H * 0.62, true, 'rgba(12,2,18,0.9)');

  // birds
  ctx.strokeStyle = 'rgba(28,8,42,0.7)';
  ctx.lineWidth = 2;
  for (const [bx, by, s] of [[W * 0.28, H * 0.24, 12], [W * 0.31, H * 0.21, 8], [W * 0.25, H * 0.2, 7]]) {
    ctx.beginPath();
    ctx.moveTo(bx - s, by);
    ctx.quadraticCurveTo(bx - s * 0.4, by - s * 0.5, bx, by);
    ctx.quadraticCurveTo(bx + s * 0.4, by - s * 0.5, bx + s, by);
    ctx.stroke();
  }
  return c;
}

function coastHighway() {
  const { c, ctx } = canvas2d();
  sky(ctx, [[0, '#1c0526'], [0.28, '#5c1453'], [0.52, '#c73f62'], [0.7, '#f58555'], [0.86, '#ffc46c'], [1, '#ffe7ab']], 0, H * 0.68);

  const rand = rng(2204);
  cloud(ctx, W * 0.3, H * 0.14, W * 0.55, H * 0.08, 'rgba(255,168,150,0.26)');
  cloud(ctx, W * 0.76, H * 0.21, W * 0.5, H * 0.06, 'rgba(255,198,132,0.3)');
  cloud(ctx, W * 0.56, H * 0.32, W * 0.65, H * 0.05, 'rgba(255,140,132,0.2)');

  sun(ctx, W * 0.29, H * 0.505, W * 0.1, 5);

  // ocean under the sun, to the right of the headland
  const ocean = ctx.createLinearGradient(0, H * 0.55, 0, H * 0.82);
  ocean.addColorStop(0, '#9a3d57');
  ocean.addColorStop(0.25, '#356070');
  ocean.addColorStop(1, '#0a2434');
  ctx.fillStyle = ocean;
  ctx.beginPath();
  ctx.moveTo(W * 0.2, H * 0.6);
  ctx.lineTo(W, H * 0.55);
  ctx.lineTo(W, H * 0.84);
  ctx.lineTo(W * 0.28, H * 0.82);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 110; i++) {
    const yy = H * 0.58 + rand() * H * 0.22;
    ctx.fillStyle = `rgba(255,206,140,${0.05 + rand() * 0.28})`;
    ctx.fillRect(W * 0.2 + rand() * W * 0.8, yy, 10 + rand() * 90, 1 + rand() * 2);
  }

  // layered headlands
  const hill = (color, points) => {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  hill('#722047', [[0, H * 0.56], [W * 0.12, H * 0.52], [W * 0.23, H * 0.58], [W * 0.3, H * 0.68], [W * 0.26, H * 0.82], [0, H * 0.86]]);
  hill('#45123a', [[0, H * 0.66], [W * 0.1, H * 0.61], [W * 0.19, H * 0.66], [W * 0.25, H * 0.76], [W * 0.22, H * 0.9], [0, H * 0.93]]);
  hill('#240b28', [[0, H * 0.78], [W * 0.12, H * 0.71], [W * 0.2, H * 0.78], [W * 0.22, H]]);

  // the coast road, a ribbon turning into the sunset
  ctx.beginPath();
  ctx.moveTo(W * 0.32, H * 1.06);
  ctx.bezierCurveTo(W * 0.42, H * 0.9, W * 0.5, H * 0.78, W * 0.455, H * 0.685);
  ctx.bezierCurveTo(W * 0.44, H * 0.655, W * 0.48, H * 0.64, W * 0.5, H * 0.638);
  ctx.bezierCurveTo(W * 0.62, H * 0.66, W * 0.78, H * 0.79, W * 0.92, H * 1.06);
  ctx.closePath();
  const road = ctx.createLinearGradient(0, H * 0.64, 0, H);
  road.addColorStop(0, '#3a1a2a');
  road.addColorStop(0.5, '#281222');
  road.addColorStop(1, '#1b0a18');
  ctx.fillStyle = road;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,178,112,0.24)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // centre dashes
  ctx.save();
  ctx.strokeStyle = 'rgba(255,232,178,0.6)';
  ctx.lineWidth = 5;
  ctx.setLineDash([38, 46]);
  ctx.beginPath();
  ctx.moveTo(W * 0.49, H * 0.64);
  ctx.bezierCurveTo(W * 0.45, H * 0.76, W * 0.42, H * 0.9, W * 0.62, H * 1.06);
  ctx.stroke();
  ctx.restore();

  // guardrail on the water side
  ctx.save();
  ctx.strokeStyle = 'rgba(255,190,124,0.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W * 0.52, H * 0.66);
  ctx.bezierCurveTo(W * 0.7, H * 0.74, W * 0.83, H * 0.9, W * 0.95, H * 1.03);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const x = W * 0.54 + i * W * 0.038;
    const y = H * 0.675 + i * i * H * 0.0022 + i * H * 0.017;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 3, y + 22);
    ctx.stroke();
  }
  ctx.restore();

  // a little wedge of a car heading home
  ctx.save();
  ctx.translate(W * 0.545, H * 0.795);
  ctx.scale(0.9, 0.9);
  ctx.fillStyle = 'rgba(18,5,16,0.98)';
  ctx.beginPath();
  ctx.moveTo(-58, 0);
  ctx.lineTo(-44, -20);
  ctx.lineTo(-12, -34);
  ctx.lineTo(14, -34);
  ctx.lineTo(45, -18);
  ctx.lineTo(58, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,88,76,0.95)';
  ctx.fillRect(-46, -14, 15, 5);
  ctx.fillRect(31, -14, 15, 5);
  ctx.fillStyle = 'rgba(255,214,150,0.18)';
  ctx.fillRect(-19, -28, 30, 10);
  ctx.restore();

  // palms along the shoulder
  palm(ctx, W * 0.08, H * 1.02, H * 0.9, false, 'rgba(10,2,14,0.98)');
  palm(ctx, W * 0.3, H * 0.94, H * 0.42, false, 'rgba(16,3,20,0.9)');
  palm(ctx, W * 0.86, H * 1.02, H * 0.54, true, 'rgba(12,2,16,0.85)');

  for (let i = 0; i < 24; i++) {
    const x = W * 0.22 + rand() * W * 0.06;
    const y = H * 0.84 + rand() * H * 0.12;
    ctx.fillStyle = `rgba(255,168,90,${0.15 + rand() * 0.5})`;
    ctx.fillRect(x, y, 2, 2);
  }
  return c;
}

function neonSkyline() {
  const { c, ctx } = canvas2d();
  sky(ctx, [[0, '#050320'], [0.35, '#131058'], [0.62, '#2c1278'], [0.8, '#4d1a86'], [1, '#1c0736']]);

  const rand = rng(8823);
  for (let i = 0; i < 150; i++) {
    const x = rand() * W;
    const y = rand() * H * 0.5;
    ctx.fillStyle = `rgba(210,236,255,${0.08 + rand() * 0.42})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  radial(ctx, W * 0.5, H * 0.33, W * 0.46, 'rgba(255,42,150,0.24)', 'rgba(255,42,150,0)');
  radial(ctx, W * 0.24, H * 0.68, W * 0.34, 'rgba(40,230,255,0.2)', 'rgba(40,230,255,0)');
  radial(ctx, W * 0.8, H * 0.7, W * 0.3, 'rgba(255,120,80,0.14)', 'rgba(255,120,80,0)');
  // moon ring
  ctx.save();
  ctx.strokeStyle = 'rgba(255,96,190,0.55)';
  ctx.lineWidth = 5;
  ctx.shadowColor = 'rgba(255,60,170,0.9)';
  ctx.shadowBlur = 50;
  ctx.beginPath();
  ctx.arc(W * 0.5, H * 0.26, W * 0.07, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // searchlight cones
  for (const [bx, by, dx] of [[W * 0.2, H * 0.63, -W * 0.12], [W * 0.8, H * 0.6, W * 0.14]]) {
    const beam = ctx.createLinearGradient(bx, by, bx + dx, H * 0.04);
    beam.addColorStop(0, 'rgba(90,220,255,0.16)');
    beam.addColorStop(1, 'rgba(90,220,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(bx - 4, by);
    ctx.lineTo(bx + dx - W * 0.05, 0);
    ctx.lineTo(bx + dx + W * 0.05, 0);
    ctx.lineTo(bx + 4, by);
    ctx.closePath();
    ctx.fill();
  }

  // downtown towers
  const baseY = H * 0.735;
  const towers = [];
  let x = -20;
  while (x < W + 40) {
    const bw = 40 + rand() * 110;
    const bh = H * (0.16 + rand() * 0.36) * (1 - Math.min(0.55, Math.abs(x - W * 0.5) / W * 1.4));
    towers.push({ x, bw, bh });
    x += bw + 4 + rand() * 16;
  }
  towers.sort((a, b) => b.bh - a.bh);
  for (const t of towers) {
    const g = ctx.createLinearGradient(t.x, 0, t.x + t.bw, 0);
    g.addColorStop(0, '#0a0626');
    g.addColorStop(0.5, '#100a38');
    g.addColorStop(1, '#07041c');
    ctx.fillStyle = g;
    ctx.fillRect(t.x, baseY - t.bh, t.bw, t.bh);
    ctx.fillStyle = 'rgba(110,230,255,0.22)';
    ctx.fillRect(t.x, baseY - t.bh, t.bw, 2);
    // window grid
    const cellW = 10;
    const cellH = 14;
    for (let wy = baseY - t.bh + 12; wy < baseY - 8; wy += cellH) {
      for (let wx = t.x + 7; wx < t.x + t.bw - 6; wx += cellW) {
        if (rand() > 0.38) {
          const pick = rand();
          ctx.fillStyle = pick > 0.72 ? 'rgba(255,88,198,0.92)' : pick > 0.38 ? 'rgba(86,226,255,0.86)' : 'rgba(255,222,150,0.72)';
          ctx.fillRect(wx, wy, 4, 6);
        }
      }
    }
    // vertical neon edge
    if (rand() > 0.45) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,60,180,0.75)' : 'rgba(60,226,255,0.65)';
      ctx.fillRect(t.x + t.bw - 4, baseY - t.bh + 10, 3, t.bh * (0.4 + rand() * 0.5));
    }
    // antenna
    if (t.bh > H * 0.36 && rand() > 0.4) {
      ctx.strokeStyle = 'rgba(43,20,70,0.95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(t.x + t.bw * 0.5, baseY - t.bh);
      ctx.lineTo(t.x + t.bw * 0.5, baseY - t.bh - 40 - rand() * 50);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,64,150,0.95)';
      ctx.fillRect(t.x + t.bw * 0.5 - 3, baseY - t.bh - 46 - rand() * 40, 6, 6);
    }
  }

  // a couple of original neon signs (abstract, no borrowed marks)
  const signs = [
    [W * 0.34, H * 0.52, 10, H * 0.16, 'rgba(255,54,164,0.9)'],
    [W * 0.63, H * 0.47, 8, H * 0.2, 'rgba(58,230,255,0.9)'],
    [W * 0.705, H * 0.55, 7, H * 0.1, 'rgba(255,190,80,0.9)'],
  ];
  for (const [sx, sy, sw, sh, color] of signs) {
    glowLine(ctx, sx, sy, sx, sy + sh, color, sw, 40);
    glowLine(ctx, sx, sy + sh * 0.45, sx + sw * 2.4, sy + sh * 0.45, color, sw * 0.6, 28);
  }

  // water and reflections
  const waterTop = baseY;
  const water = ctx.createLinearGradient(0, waterTop, 0, H);
  water.addColorStop(0, '#170834');
  water.addColorStop(0.4, '#0b0424');
  water.addColorStop(1, '#030112');
  ctx.fillStyle = water;
  ctx.fillRect(0, waterTop, W, H - waterTop);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, waterTop, W, H - waterTop);
  ctx.clip();
  for (let i = 0; i < 260; i++) {
    const yy = waterTop + rand() * (H - waterTop);
    const column = rand();
    const color = column > 0.72 ? '255,80,186' : column > 0.35 ? '70,220,255' : '255,206,130';
    ctx.fillStyle = `rgba(${color},${0.07 + rand() * 0.4})`;
    ctx.fillRect(rand() * W, yy, 8 + rand() * 90, 1 + rand() * 2.4);
  }
  ctx.restore();

  // foreground palms
  palm(ctx, W * 0.06, H * 1.04, H * 0.78, false, 'rgba(7,1,13,0.98)');
  palm(ctx, W * 0.95, H * 1.04, H * 0.66, true, 'rgba(8,1,14,0.96)');
  return c;
}

/** An original low-slung coupe, drawn as a silhouette: long hood, fastback roof, fat arches. */
function muscleCar(ctx, cx, groundY, width) {
  const w = width;
  const y = (v) => groundY + v * w;
  const x = (v) => cx + v * w;
  const path = (points) => {
    ctx.beginPath();
    points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(x(px), y(py)) : ctx.lineTo(x(px), y(py))));
    ctx.closePath();
  };
  ctx.save();
  // contact shadow on the asphalt
  ctx.save();
  ctx.translate(cx, groundY + w * 0.02);
  ctx.scale(1, 0.16);
  const shadow = ctx.createRadialGradient(0, 0, w * 0.05, 0, 0, w * 0.6);
  shadow.addColorStop(0, 'rgba(4,1,8,0.82)');
  shadow.addColorStop(0.6, 'rgba(8,2,14,0.36)');
  shadow.addColorStop(1, 'rgba(8,2,14,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath();
  ctx.arc(0, 0, w * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const body = [
    [-0.49, -0.075], [-0.515, -0.17], [-0.5, -0.275], [-0.455, -0.325], [-0.325, -0.355],
    [-0.15, -0.525], [-0.02, -0.552], [0.1, -0.54], [0.215, -0.382], [0.385, -0.348],
    [0.482, -0.332], [0.523, -0.262], [0.512, -0.178], [0.5, -0.075],
    [0.42, -0.088], [0.39, -0.14], [0.3, -0.225], [0.2, -0.15], [0.185, -0.088],
    [-0.16, -0.088], [-0.185, -0.155], [-0.29, -0.238], [-0.395, -0.148], [-0.42, -0.088],
  ];
  path(body);
  const paint = ctx.createLinearGradient(0, y(-0.55), 0, y(-0.06));
  paint.addColorStop(0, '#241026');
  paint.addColorStop(0.42, '#120718');
  paint.addColorStop(1, '#08030e');
  ctx.fillStyle = paint;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,176,134,0.5)';
  ctx.lineWidth = w * 0.007;
  ctx.stroke();

  // chrome spear along the flank and a lit hardtop line
  ctx.strokeStyle = 'rgba(255,214,170,0.5)';
  ctx.lineWidth = w * 0.008;
  ctx.beginPath();
  ctx.moveTo(x(-0.44), y(-0.3));
  ctx.quadraticCurveTo(x(0.02), y(-0.34), x(0.47), y(-0.29));
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,120,150,0.24)';
  ctx.lineWidth = w * 0.005;
  ctx.beginPath();
  ctx.moveTo(x(-0.12), y(-0.5));
  ctx.quadraticCurveTo(x(-0.02), y(-0.56), x(0.09), y(-0.53));
  ctx.stroke();

  // glass, catching the sunset
  path([[-0.125, -0.505], [-0.012, -0.527], [0.085, -0.512], [0.175, -0.402], [-0.075, -0.398]]);
  const glass = ctx.createLinearGradient(x(-0.1), y(-0.52), x(0.16), y(-0.39));
  glass.addColorStop(0, 'rgba(255,196,132,0.6)');
  glass.addColorStop(0.5, 'rgba(255,104,96,0.3)');
  glass.addColorStop(1, 'rgba(60,20,60,0.5)');
  ctx.fillStyle = glass;
  ctx.fill();

  // wheel wells, tyres and chrome rims
  for (const wx of [-0.29, 0.3]) {
    ctx.beginPath();
    ctx.arc(x(wx), y(-0.115), w * 0.118, Math.PI, Math.PI * 2);
    ctx.fillStyle = '#050109';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x(wx), y(-0.115), w * 0.115, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0410';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x(wx), y(-0.115), w * 0.062, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,196,150,0.34)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x(wx), y(-0.115), w * 0.036, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,12,34,0.9)';
    ctx.fill();
  }

  // full-width tail light bar and a warm headlight
  ctx.save();
  ctx.shadowColor = 'rgba(255,46,92,0.95)';
  ctx.shadowBlur = w * 0.05;
  ctx.fillStyle = '#ff3358';
  ctx.fillRect(x(-0.512), y(-0.268), w * 0.026, w * 0.055);
  ctx.restore();
  ctx.save();
  ctx.shadowColor = 'rgba(255,214,140,0.95)';
  ctx.shadowBlur = w * 0.045;
  ctx.fillStyle = '#ffe6ae';
  ctx.fillRect(x(0.5), y(-0.256), w * 0.022, w * 0.042);
  ctx.restore();

  // twin exhaust tips and a rear plate
  ctx.fillStyle = 'rgba(255,206,150,0.5)';
  ctx.fillRect(x(-0.53), y(-0.075), w * 0.05, w * 0.012);
  ctx.fillStyle = 'rgba(255,244,224,0.32)';
  ctx.fillRect(x(-0.5), y(-0.2), w * 0.045, w * 0.03);
  ctx.restore();
}

function sunsetCruise() {
  const { c, ctx } = canvas2d();
  const horizon = H * 0.63;
  sky(ctx, [[0, '#0e0219'], [0.24, '#33084a'], [0.44, '#75115f'], [0.6, '#c22a62'], [0.75, '#f26548'], [0.88, '#ffab5e'], [1, '#ffd489']], 0, horizon);

  const rand = rng(5511);
  for (let i = 0; i < 120; i++) {
    const sx = rand() * W;
    const sy = rand() * H * 0.3;
    ctx.fillStyle = `rgba(255,238,226,${0.08 + rand() * 0.42})`;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  cloud(ctx, W * 0.24, H * 0.16, W * 0.5, H * 0.08, 'rgba(255,158,158,0.3)');
  cloud(ctx, W * 0.72, H * 0.28, W * 0.44, H * 0.06, 'rgba(255,188,124,0.32)');

  // a hard sun on the boulevard's vanishing point
  sun(ctx, W * 0.52, horizon - H * 0.062, W * 0.15, 8);

  // low skyline and palms on the horizon
  let bx = -20;
  while (bx < W + 30) {
    const bw = 26 + rand() * 62;
    const bh = 18 + rand() * 86;
    ctx.fillStyle = 'rgba(32,6,44,0.95)';
    ctx.fillRect(bx, horizon - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,128,110,0.22)';
    ctx.fillRect(bx, horizon - bh, bw, 2);
    bx += bw + 5 + rand() * 16;
  }
  palm(ctx, W * 0.14, horizon + H * 0.01, H * 0.28, false, 'rgba(22,4,32,0.95)');
  palm(ctx, W * 0.86, horizon + H * 0.01, H * 0.31, true, 'rgba(18,3,26,0.95)');

  // ocean sliver left of the road
  const sea = ctx.createLinearGradient(0, horizon, 0, H * 0.73);
  sea.addColorStop(0, '#a4336c');
  sea.addColorStop(0.4, '#5d1a5e');
  sea.addColorStop(1, '#2a0b40');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, W, H * 0.73 - horizon);

  // the boulevard: asphalt in perspective, its edges converging on the sun
  const road = ctx.createLinearGradient(0, horizon, 0, H);
  road.addColorStop(0, '#4b1c38');
  road.addColorStop(0.28, '#2a1026');
  road.addColorStop(1, '#0d0512');
  ctx.fillStyle = road;
  ctx.beginPath();
  ctx.moveTo(W * 0.34, horizon);
  ctx.lineTo(W * 0.66, horizon);
  ctx.lineTo(W * 1.1, H);
  ctx.lineTo(-W * 0.1, H);
  ctx.closePath();
  ctx.fill();

  // sun reflection running down the asphalt
  const sheen = ctx.createLinearGradient(0, horizon, 0, H);
  sheen.addColorStop(0, 'rgba(255,198,118,0.5)');
  sheen.addColorStop(0.35, 'rgba(255,140,96,0.18)');
  sheen.addColorStop(1, 'rgba(255,120,90,0)');
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.moveTo(W * 0.48, horizon);
  ctx.lineTo(W * 0.56, horizon);
  ctx.lineTo(W * 0.74, H);
  ctx.lineTo(W * 0.26, H);
  ctx.closePath();
  ctx.fill();

  // centre dashes
  ctx.save();
  ctx.strokeStyle = 'rgba(255,232,186,0.55)';
  ctx.setLineDash([26, 34]);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(W * 0.5, horizon + 6);
  ctx.lineTo(W * 0.5, H);
  ctx.stroke();
  ctx.restore();

  // kerb lights streaking toward the camera
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const t = i / 7;
      const lx = W * 0.5 + side * (W * 0.14 + t * t * W * 0.48);
      const ly = horizon + 24 + t * t * (H - horizon);
      const size = 2 + t * 5;
      ctx.save();
      ctx.globalAlpha = 0.35 + t * 0.5;
      ctx.fillStyle = i % 2 ? 'rgba(255,196,120,0.9)' : 'rgba(255,86,128,0.85)';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 22 * (0.4 + t);
      ctx.fillRect(lx, ly, size, size * 1.6);
      ctx.restore();
    }
  }

  muscleCar(ctx, W * 0.5, H * 0.9, W * 0.5);

  // foreground palms framing the shot
  palm(ctx, W * 0.02, H * 1.06, H * 0.96, false, 'rgba(8,1,13,0.99)');
  palm(ctx, W * 0.98, H * 1.08, H * 0.82, true, 'rgba(9,1,14,0.97)');

  // light bloom rods over the frame
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const flare = ctx.createRadialGradient(W * 0.52, horizon - H * 0.02, 0, W * 0.52, horizon - H * 0.02, W * 0.34);
  flare.addColorStop(0, 'rgba(255,214,150,0.32)');
  flare.addColorStop(1, 'rgba(255,120,90,0)');
  ctx.fillStyle = flare;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  return c;
}

function coastalDay() {
  const { c, ctx } = canvas2d();
  const horizon = H * 0.55;
  sky(ctx, [[0, '#3fb8d8'], [0.34, '#7fd7ea'], [0.66, '#c9f1f4'], [0.85, '#ffe9cf'], [1, '#fff6e2']], 0, horizon);

  const rand = rng(3312);
  // high sun and soft trade-wind clouds
  radial(ctx, W * 0.24, H * 0.13, W * 0.3, 'rgba(255,250,214,0.55)', 'rgba(255,246,210,0)');
  ctx.beginPath();
  ctx.arc(W * 0.24, H * 0.13, W * 0.052, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,253,232,0.95)';
  ctx.fill();
  cloud(ctx, W * 0.62, H * 0.18, W * 0.46, H * 0.09, 'rgba(255,255,255,0.85)');
  cloud(ctx, W * 0.86, H * 0.3, W * 0.3, H * 0.06, 'rgba(255,250,240,0.7)');
  cloud(ctx, W * 0.34, H * 0.33, W * 0.34, H * 0.05, 'rgba(255,246,232,0.55)');

  // turquoise sea with a coral shallows band
  const sea = ctx.createLinearGradient(0, horizon, 0, H * 0.78);
  sea.addColorStop(0, '#0a90ad');
  sea.addColorStop(0.35, '#17b9c4');
  sea.addColorStop(0.7, '#53dcd2');
  sea.addColorStop(1, '#b9f2e4');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, W, H * 0.78 - horizon);
  for (let i = 0; i < 220; i++) {
    const yy = horizon + rand() * (H * 0.22);
    const alpha = 0.08 + ((yy - horizon) / (H * 0.22)) * 0.5;
    ctx.fillStyle = `rgba(255,255,240,${alpha * (0.4 + rand() * 0.6)})`;
    ctx.fillRect(rand() * W, yy, 12 + rand() * 90, 1 + rand() * 2);
  }
  // breaking surf line
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,250,0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let sx = -20; sx <= W + 20; sx += 20) {
    const sy = H * 0.762 + Math.sin(sx * 0.014) * 5;
    sx < 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  ctx.restore();

  // coral sand
  const sand = ctx.createLinearGradient(0, H * 0.77, 0, H);
  sand.addColorStop(0, '#ffe7c4');
  sand.addColorStop(0.4, '#ffd7ae');
  sand.addColorStop(1, '#ffbf9c');
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.775);
  for (let sx = 0; sx <= W; sx += 40) ctx.lineTo(sx, H * 0.775 + Math.sin(sx * 0.009 + 1.4) * 9);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();

  // art-deco facades: pastel coral, cream and turquoise, all original shapes
  const facade = (fx, width, height, wall, trim) => {
    const top = H * 0.78 - height;
    ctx.fillStyle = wall;
    ctx.beginPath();
    ctx.moveTo(fx, H);
    ctx.lineTo(fx, top + width * 0.16);
    ctx.quadraticCurveTo(fx + width * 0.5, top - width * 0.08, fx + width, top + width * 0.16);
    ctx.lineTo(fx + width, H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = trim;
    ctx.fillRect(fx, top + width * 0.1, width, width * 0.07);
    for (let wy = top + width * 0.34; wy < H * 0.94; wy += width * 0.32) {
      for (let wx = fx + width * 0.14; wx < fx + width * 0.86; wx += width * 0.29) {
        ctx.fillStyle = 'rgba(24,84,96,0.55)';
        ctx.fillRect(wx, wy, width * 0.17, width * 0.22);
        ctx.fillStyle = 'rgba(255,246,222,0.5)';
        ctx.fillRect(wx, wy, width * 0.17, width * 0.03);
      }
    }
  };
  facade(W * 0.03, W * 0.16, H * 0.3, '#ff9a7c', '#ffe6c4');
  facade(W * 0.13, W * 0.1, H * 0.22, '#ffd9a8', '#ff8a6a');
  facade(W * 0.84, W * 0.14, H * 0.27, '#ffaf8e', '#fff0d2');
  facade(W * 0.93, W * 0.1, H * 0.19, '#7fe3dc', '#ff9c80');

  // boardwalk railing and striped parasols
  ctx.save();
  ctx.strokeStyle = 'rgba(255,250,235,0.9)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.87);
  ctx.lineTo(W, H * 0.855);
  ctx.stroke();
  ctx.lineWidth = 4;
  for (let px = 30; px < W; px += 74) {
    ctx.beginPath();
    ctx.moveTo(px, H * 0.868);
    ctx.lineTo(px, H * 0.905);
    ctx.stroke();
  }
  ctx.restore();
  const parasol = (px, py, r, a, b) => {
    ctx.beginPath();
    ctx.arc(px, py, r, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = a;
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, r, Math.PI + (i * Math.PI) / 6, Math.PI + ((i + 1) * Math.PI) / 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,250,236,0.95)';
    ctx.fillRect(px - r * 0.04, py - r * 0.05, r * 0.08, r * 1.05);
  };
  parasol(W * 0.34, H * 0.845, W * 0.06, '#ff7d6b', '#fff2dc');
  parasol(W * 0.7, H * 0.83, W * 0.052, '#17b9c4', '#fff6e6');

  // foreground palms and beach grass
  palm(ctx, W * 0.06, H * 1.04, H * 0.86, false, 'rgba(17,62,48,0.96)');
  palm(ctx, W * 0.95, H * 1.06, H * 0.72, true, 'rgba(14,56,44,0.94)');
  palm(ctx, W * 0.78, H * 0.9, H * 0.3, true, 'rgba(19,72,56,0.9)');
  for (let i = 0; i < 60; i++) {
    const gx = rand() * W;
    const gy = H * 0.86 + rand() * H * 0.12;
    ctx.strokeStyle = `rgba(46,110,74,${0.25 + rand() * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.quadraticCurveTo(gx + (rand() - 0.5) * 20, gy - 16, gx + (rand() - 0.5) * 34, gy - 30);
    ctx.stroke();
  }
  // birds
  ctx.strokeStyle = 'rgba(36,92,102,0.55)';
  ctx.lineWidth = 2.4;
  for (const [bxp, byp, s] of [[W * 0.46, H * 0.19, 15], [W * 0.5, H * 0.16, 10], [W * 0.42, H * 0.15, 8]]) {
    ctx.beginPath();
    ctx.moveTo(bxp - s, byp);
    ctx.quadraticCurveTo(bxp - s * 0.4, byp - s * 0.5, bxp, byp);
    ctx.quadraticCurveTo(bxp + s * 0.4, byp - s * 0.5, bxp + s, byp);
    ctx.stroke();
  }
  return c;
}

function neonStrip() {
  const { c, ctx } = canvas2d();
  const horizon = H * 0.58;
  sky(ctx, [[0, '#0a0524'], [0.3, '#221057'], [0.55, '#5c1a7e'], [0.78, '#b02a86'], [1, '#ff6a7a']], 0, horizon);

  const rand = rng(9907);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(220,240,255,${0.1 + rand() * 0.4})`;
    ctx.fillRect(rand() * W, rand() * H * 0.32, 1.6, 1.6);
  }
  radial(ctx, W * 0.74, horizon - H * 0.02, W * 0.36, 'rgba(255,120,190,0.42)', 'rgba(255,120,190,0)');
  radial(ctx, W * 0.2, horizon - H * 0.06, W * 0.28, 'rgba(70,235,255,0.3)', 'rgba(70,235,255,0)');

  // low motel strip along the boulevard: lit fronts, awnings and neon tubes
  const blocks = [];
  let bx = -20;
  while (bx < W + 30) {
    const bw = 70 + rand() * 130;
    blocks.push({ x: bx, w: bw, h: H * (0.1 + rand() * 0.16) });
    bx += bw + 8 + rand() * 22;
  }
  for (const b of blocks) {
    const top = horizon - b.h;
    const wall = ctx.createLinearGradient(0, top, 0, horizon);
    wall.addColorStop(0, '#2a1140');
    wall.addColorStop(1, '#120720');
    ctx.fillStyle = wall;
    ctx.fillRect(b.x, top, b.w, b.h);
    // lit frontage band
    ctx.fillStyle = 'rgba(255,196,120,0.24)';
    ctx.fillRect(b.x, horizon - b.h * 0.2, b.w, b.h * 0.2);
    for (let wx = b.x + 8; wx < b.x + b.w - 8; wx += 16) {
      const lit = rand();
      ctx.fillStyle = lit > 0.55 ? 'rgba(255,214,150,0.9)' : lit > 0.25 ? 'rgba(255,92,190,0.8)' : 'rgba(96,228,255,0.75)';
      ctx.fillRect(wx, top + b.h * (0.16 + rand() * 0.3), 7, 7);
    }
    // neon roof tube
    const tube = rand() > 0.5 ? 'rgba(255,62,190,0.95)' : 'rgba(64,228,255,0.95)';
    glowLine(ctx, b.x + 4, top + 4, b.x + b.w - 4, top + 4, tube, 5, 34);
    // vertical sign blade
    if (rand() > 0.45) {
      const sx = b.x + b.w * 0.16;
      glowLine(ctx, sx, top + 8, sx, top + 8 + b.h * 0.55, tube, 7, 42);
      glowLine(ctx, sx + 18, top + 20, sx + 18, top + 30 + b.h * 0.4, 'rgba(255,214,120,0.95)', 5, 30);
    }
  }

  // the wet street, mirroring every tube
  const street = ctx.createLinearGradient(0, horizon, 0, H);
  street.addColorStop(0, '#2a1034');
  street.addColorStop(0.35, '#170a22');
  street.addColorStop(1, '#080411');
  ctx.fillStyle = street;
  ctx.fillRect(0, horizon, W, H - horizon);
  for (let i = 0; i < 260; i++) {
    const t = rand();
    const yy = horizon + t * t * (H - horizon);
    const color = rand();
    const pick = color > 0.66 ? '255,70,190' : color > 0.36 ? '80,230,255' : '255,208,130';
    ctx.fillStyle = `rgba(${pick},${0.06 + t * 0.42})`;
    const ww = 6 + t * 90;
    ctx.fillRect(rand() * W, yy, ww, 2 + t * 5);
  }
  // kerb line and lane dashes
  ctx.save();
  ctx.strokeStyle = 'rgba(255,232,186,0.5)';
  ctx.lineWidth = 6;
  ctx.setLineDash([34, 44]);
  ctx.beginPath();
  ctx.moveTo(W * 0.5, horizon);
  ctx.lineTo(W * 0.5, H);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,120,190,0.5)';
  ctx.fillRect(0, horizon + 2, W, 3);

  // foreground palms, black against the tubes
  palm(ctx, W * 0.05, H * 1.03, H * 0.94, false, 'rgba(6,1,12,0.99)');
  palm(ctx, W * 0.96, H * 1.05, H * 0.8, true, 'rgba(7,1,13,0.98)');

  // a soft halation over the whole strip
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const halo = ctx.createLinearGradient(0, horizon - H * 0.3, 0, H);
  halo.addColorStop(0, 'rgba(255,60,170,0.14)');
  halo.addColorStop(0.45, 'rgba(80,220,255,0.1)');
  halo.addColorStop(1, 'rgba(255,120,60,0.06)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  return c;
}

const BUILDERS = {
  'sunset-city': sunsetCity,
  'sunset-cruise': sunsetCruise,
  'coast-highway': coastHighway,
  'neon-skyline': neonSkyline,
  'neon-strip': neonStrip,
  'coastal-day': coastalDay,
};

const LABELS = {
  'sunset-city': 'Sunset Strip',
  'sunset-cruise': 'Sunset Cruiser',
  'coast-highway': 'Coast Highway',
  'neon-skyline': 'Neon Skyline',
  'neon-strip': 'Neon Strip',
  'coastal-day': 'Coastal Day',
};

/**
 * Build the procedural gallery once. Each entry is a drawable canvas with a stable id and version.
 */
export function buildProceduralSamples() {
  return Object.entries(BUILDERS).map(([id, build]) => {
    const canvas = build();
    return { id, label: LABELS[id] ?? id, image: canvas, version: 1, procedural: true };
  });
}
