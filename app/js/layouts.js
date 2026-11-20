// Nine original comic-mosaic layouts. Each one tiles the unit square edge to edge with slanted
// convex cuts; buildGeometry then insets every cut in pixels, so the black gutters are one even
// width (GUTTER of the short side) at every post size, with a matching outer frame. Rows are built
// from tilted lines [yLeft, yRight] and dividers [xTop, xBottom] so neighbouring cuts share edges.

export const GUTTER = 0.0145;
const yAt = (line, x) => line[0] + (line[1] - line[0]) * x;

function row(top, bottom, dividers = []) {
  const cuts = [[0, 0], ...dividers, [1, 1]];
  return cuts.slice(1).map((d, i) => {
    const [a, b] = [cuts[i], d];
    return [[a[0], yAt(top, a[0])], [b[0], yAt(top, b[0])], [b[1], yAt(bottom, b[1])], [a[1], yAt(bottom, a[1])]];
  });
}

const TOP = [0, 0];
const FOOT = [1, 1];
const zone = (x, y, w, h, align = 'center') => ({ x, y, w, h, align });
const layout = (id, name, note, cuts, title, badge) => ({
  id, name, note, title, badge: { x: badge[0], y: badge[1], size: badge[2] },
  panels: cuts.map((pts) => ({ points: pts.map(([x, y]) => ({ x, y })) })),
});

export const LAYOUTS = [
  layout('classic7', 'Classic 7-Panel', 'Three cuts, a full-width title band, three cuts.', [
    ...row(TOP, [0.46, 0.44], [[0.345, 0.325], [0.675, 0.66]]),
    ...row([0.46, 0.44], [0.735, 0.715]),
    ...row([0.735, 0.715], FOOT, [[0.33, 0.35], [0.665, 0.685]]),
  ], zone(0.06, 0.462, 0.88, 0.262), [0.928, 0.588, 0.13]),
  layout('asym7', 'Asymmetric 7', 'Two offset pairs, a tall title band and a two-cut foot.', [
    ...row(TOP, [0.28, 0.26], [[0.6, 0.57]]),
    ...row([0.28, 0.26], [0.53, 0.51], [[0.6, 0.64]]),
    ...row([0.53, 0.51], [0.81, 0.79]),
    ...row([0.81, 0.79], FOOT, [[0.52, 0.48]]),
  ], zone(0.05, 0.522, 0.9, 0.27), [0.885, 0.735, 0.15]),
  layout('diagonal5', 'Diagonal 5-Panel', 'A wide hero under the title, then four cuts on crossing diagonals.', [
    ...row(TOP, [0.53, 0.46]),
    ...row([0.53, 0.46], [0.75, 0.71], [[0.6, 0.47]]),
    ...row([0.75, 0.71], FOOT, [[0.42, 0.57]]),
  ], zone(0.06, 0.03, 0.88, 0.235), [0.885, 0.4, 0.15]),
  layout('classic6', 'Classic 6-Panel', 'Three cuts, a title band and a two-cut foot.', [
    ...row(TOP, [0.47, 0.45], [[0.35, 0.33], [0.68, 0.665]]),
    ...row([0.47, 0.45], [0.74, 0.72]),
    ...row([0.74, 0.72], FOOT, [[0.49, 0.52]]),
  ], zone(0.06, 0.47, 0.88, 0.255), [0.925, 0.59, 0.13]),
  layout('panorama', 'Panoramic Split', 'A widescreen panorama over a split pair, lettering on the seam.', [
    ...row(TOP, [0.56, 0.48]),
    ...row([0.56, 0.48], FOOT, [[0.52, 0.47]]),
  ], zone(0.06, 0.25, 0.88, 0.24), [0.9, 0.08, 0.13]),
  layout('tower5', 'Neon Tower', 'One full-height tower cut beside four stacked shards.', [
    [[0, 0], [0.4, 0], [0.43, 1], [0, 1]],
    [[0.4, 0], [0.72, 0], [0.7, 0.36], [0.4108, 0.36]],
    [[0.72, 0], [1, 0], [1, 0.36], [0.7, 0.36]],
    [[0.4108, 0.36], [1, 0.36], [1, 0.68], [0.4204, 0.68]],
    [[0.4204, 0.68], [1, 0.68], [1, 1], [0.43, 1]],
  ], zone(0.45, 0.37, 0.52, 0.3), [0.9, 0.93, 0.12]),
  layout('triptych3', 'Sunset Triptych', 'Three leaning towers of a postcard, lettering across the foot.', [
    ...row(TOP, FOOT, [[0.34, 0.31], [0.68, 0.655]]),
  ], zone(0.05, 0.66, 0.9, 0.22), [0.9, 0.08, 0.13]),
  layout('hero-strips', 'Hero + 3 Strips', 'A widescreen hero over three tilted strips.', [
    ...row(TOP, [0.66, 0.7]),
    ...row([0.66, 0.7], FOOT, [[0.34, 0.32], [0.67, 0.69]]),
  ], zone(0.05, 0.42, 0.9, 0.22), [0.92, 0.09, 0.13]),
  layout('split4', 'Split Diagonal', 'Four cuts slashed by two crossing diagonals.', [
    ...row(TOP, [0.52, 0.5], [[0.64, 0.38]]),
    ...row([0.52, 0.5], FOOT, [[0.4, 0.68]]),
  ], zone(0.06, 0.385, 0.88, 0.24), [0.9, 0.9, 0.13]),
];
export const layoutById = (id) => LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];

const cross = (a, b) => a.x * b.y - a.y * b.x;

// Moves every edge of a convex cut inward: by half a gutter where it meets another cut and by the
// frame width where it lies on the canvas edge, then re-intersects neighbouring edges.
export function insetPolygon(points, width, height, inner, outer) {
  const n = points.length;
  const area = points.reduce((s, p, i) => s + cross(p, points[(i + 1) % n]), 0);
  const sign = area > 0 ? 1 : -1;
  const near = (v, edge) => Math.abs(v - edge) < 0.5;
  const lines = points.map((p, i) => {
    const q = points[(i + 1) % n];
    const dir = { x: q.x - p.x, y: q.y - p.y };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const onFrame = [[p.x, q.x, 0], [p.x, q.x, width], [p.y, q.y, 0], [p.y, q.y, height]].some(([a, b, e]) => near(a, e) && near(b, e));
    const d = onFrame ? outer : inner;
    return { p: { x: p.x - (dir.y / len) * d * sign, y: p.y + (dir.x / len) * d * sign }, dir };
  });
  return lines.map((line, i) => {
    const prev = lines[(i + n - 1) % n];
    const den = cross(prev.dir, line.dir);
    if (Math.abs(den) < 1e-9) return line.p;
    const t = cross({ x: line.p.x - prev.p.x, y: line.p.y - prev.p.y }, line.dir) / den;
    return { x: prev.p.x + prev.dir.x * t, y: prev.p.y + prev.dir.y * t };
  });
}

const boundsOf = (points) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

export function buildGeometry(layout, width, height) {
  const unit = Math.min(width, height);
  const gutter = Math.max(4, Math.round(unit * GUTTER));
  const { title, badge } = layout;
  return {
    id: layout.id, width, height, gutter,
    panels: layout.panels.map((panel, index) => {
      const outer = panel.points.map((p) => ({ x: p.x * width, y: p.y * height }));
      const points = insetPolygon(outer, width, height, gutter / 2, gutter * 0.9);
      const box = boundsOf(points);
      return { index, outer, points, box, cx: box.x + box.w / 2, cy: box.y + box.h / 2 };
    }),
    zones: {
      title: { ...title, x: title.x * width, y: title.y * height, w: title.w * width, h: title.h * height },
      badge: { cx: badge.x * width, cy: badge.y * height, radius: (badge.size * unit) / 2 },
    },
  };
}

export function tracePanel(ctx, points) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

// Hit test on the untrimmed cut, so a click on a gutter still picks the nearest panel side.
export function panelAt(geometry, x, y) {
  return geometry.panels.find(({ outer }) => {
    let inside = false;
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      const a = outer[i];
      const b = outer[j];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }) ?? null;
}
