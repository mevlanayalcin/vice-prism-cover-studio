// Nine original comic-mosaic layouts in unit space: slanted quadrilaterals whose gaps become the
// thick #0A0A0D gutters, a title well, a tagline anchor and the edition-seal spot. Each cut is
// [x0, y0, x1, y1, x2, y2, x3, y3, zoom, focusX, focusY]: its corners and the starting crop.

const layout = (id, name, note, cuts, title, tagline, badge) => ({
  id,
  name,
  note,
  panels: cuts.map((c) => ({ points: [0, 2, 4, 6].map((k) => ({ x: c[k], y: c[k + 1] })), focal: { zoom: c[8], x: c[9], y: c[10] } })),
  zones: { title: { x: title[0], y: title[1], w: title[2], h: title[3], align: title[4] }, tagline: { x: tagline[0], y: tagline[1] }, badge: { x: badge[0], y: badge[1], size: badge[2] } },
});

export const LAYOUTS = [
  layout('classic7', 'Classic 7-Panel', 'A hero cut between two wings, a lettering band and a three-cut foot.', [
    [0, 0, 0.262, 0, 0.276, 0.47, 0.004, 0.478, 1.3, 0.5, 0.5],
    [0.29, 0, 0.708, 0, 0.72, 0.47, 0.302, 0.478, 1.12, 0.5, 0.42],
    [0.735, 0, 1, 0, 1, 0.468, 0.746, 0.47, 1.2, 0.5, 0.45],
    [0, 0.494, 1, 0.486, 1, 0.742, 0.002, 0.75, 1.05, 0.5, 0.5],
    [0, 0.766, 0.33, 0.76, 0.34, 1, 0.004, 1, 1.3, 0.5, 0.5],
    [0.346, 0.76, 0.664, 0.756, 0.674, 1, 0.356, 1, 1.3, 0.5, 0.5],
    [0.68, 0.756, 1, 0.752, 1, 1, 0.69, 1, 1.3, 0.5, 0.5],
  ], [0.05, 0.5, 0.78, 0.235, 'center'], [0.055, 0.052], [0.875, 0.62, 0.15]),
  layout('asym9', 'Asymmetric 9', 'A towering hero, a four-cut cluster and a four-cut filmstrip foot.', [
    [0, 0, 0.42, 0, 0.43, 0.64, 0, 0.648, 1.1, 0.5, 0.45],
    [0.444, 0, 0.716, 0, 0.71, 0.304, 0.448, 0.31, 1.3, 0.5, 0.5],
    [0.73, 0, 1, 0, 1, 0.298, 0.724, 0.304, 1.3, 0.5, 0.5],
    [0.448, 0.326, 0.71, 0.32, 0.716, 0.634, 0.454, 0.638, 1.3, 0.5, 0.5],
    [0.724, 0.32, 1, 0.314, 1, 0.628, 0.73, 0.634, 1.3, 0.5, 0.5],
    [0, 0.668, 0.268, 0.662, 0.256, 1, 0, 1, 1.3, 0.5, 0.5],
    [0.282, 0.662, 0.508, 0.656, 0.5, 1, 0.27, 1, 1.3, 0.5, 0.5],
    [0.522, 0.656, 0.752, 0.652, 0.748, 1, 0.514, 1, 1.3, 0.5, 0.5],
    [0.766, 0.652, 1, 0.648, 1, 1, 0.762, 1, 1.3, 0.5, 0.5],
  ], [0.04, 0.47, 0.66, 0.26, 'left'], [0.045, 0.05], [0.89, 0.6, 0.14]),
  layout('panorama', 'Panoramic Split', 'A widescreen panorama over a split pair, lettering on the seam.', [
    [0, 0, 1, 0, 1, 0.47, 0, 0.53, 1.05, 0.5, 0.5],
    [0, 0.558, 0.49, 0.53, 0.47, 1, 0, 1, 1, 0.5, 0.5],
    [0.51, 0.528, 1, 0.5, 1, 1, 0.49, 1, 1.15, 0.5, 0.45],
  ], [0.05, 0.385, 0.8, 0.27, 'center'], [0.055, 0.06], [0.88, 0.82, 0.15]),
  layout('classic6', 'Classic 6-Panel', 'A tall hero, two wings, a lettering band and two feet.', [
    [0, 0, 0.262, 0, 0.278, 0.472, 0.004, 0.48, 1.55, 0.44, 0.56],
    [0.292, 0, 0.708, 0, 0.72, 0.472, 0.304, 0.48, 1.16, 0.5, 0.42],
    [0.735, 0, 1, 0, 1, 0.47, 0.747, 0.462, 1.08, 0.54, 0.4],
    [0, 0.486, 1, 0.484, 1, 0.744, 0.002, 0.75, 1.1, 0.58, 0.5],
    [0, 0.766, 0.49, 0.76, 0.5, 1, 0.004, 1, 1.8, 0.55, 0.35],
    [0.516, 0.76, 1, 0.754, 1, 1, 0.526, 1, 1.1, 0.48, 0.5],
  ], [0.05, 0.5, 0.8, 0.234, 'center'], [0.055, 0.052], [0.855, 0.79, 0.145]),
  layout('mosaic6', 'Neon Mosaic', 'A tall tower cut and five neon shards.', [
    [0, 0, 0.4, 0, 0.415, 1, 0, 1, 1.24, 0.5, 0.44],
    [0.43, 0, 0.7, 0, 0.712, 0.318, 0.444, 0.326, 1.8, 0.7, 0.3],
    [0.727, 0, 1, 0, 1, 0.31, 0.737, 0.318, 1.7, 0.68, 0.7],
    [0.444, 0.35, 0.72, 0.34, 0.734, 0.662, 0.458, 0.674, 1.16, 0.46, 0.42],
    [0.474, 0.698, 0.744, 0.688, 0.758, 1, 0.49, 1, 1.7, 0.33, 0.62],
    [0.776, 0.685, 1, 0.677, 1, 1, 0.79, 1, 1.55, 0.43, 0.58],
  ], [0.05, 0.5, 0.78, 0.34, 'left'], [0.055, 0.05], [0.855, 0.078, 0.14]),
  layout('diagonal4', 'Split Diagonal', 'Four cuts slashed by a rising diagonal.', [
    [0, 0, 0.635, 0, 0.38, 0.52, 0, 0.52, 1.7, 0.48, 0.54],
    [0.657, 0, 1, 0, 1, 0.52, 0.402, 0.52, 1.6, 0.12, 0.75],
    [0, 0.546, 0.4, 0.546, 0.672, 1, 0, 1, 1.3, 0.5, 0.55],
    [0.424, 0.546, 1, 0.546, 1, 1, 0.694, 1, 1.1, 0.58, 0.56],
  ], [0.052, 0.5, 0.66, 0.33, 'left'], [0.055, 0.058], [0.84, 0.778, 0.15]),
  layout('triptych3', 'Sunset Triptych', 'Three leaning towers of a postcard.', [
    [0, 0, 0.312, 0, 0.335, 1, 0, 1, 1.02, 0.46, 0.4],
    [0.348, 0, 0.664, 0, 0.678, 1, 0.371, 1, 1.4, 0.4, 0.68],
    [0.692, 0, 1, 0, 1, 1, 0.706, 1, 1.08, 0.52, 0.44],
  ], [0.05, 0.522, 0.64, 0.33, 'left'], [0.055, 0.06], [0.85, 0.778, 0.15]),
  layout('hero-strips', 'Hero + 3 Strips', 'A widescreen hero over three tilted strips.', [
    [0, 0, 1, 0, 1, 0.672, 0, 0.692, 1.5, 0.53, 0.54],
    [0, 0.714, 0.352, 0.7, 0.342, 1, 0, 1, 1.1, 0.58, 0.58],
    [0.368, 0.698, 0.674, 0.694, 0.668, 1, 0.358, 1, 1.5, 0.2, 0.45],
    [0.69, 0.692, 1, 0.69, 1, 1, 0.684, 1, 1.6, 0.7, 0.32],
  ], [0.052, 0.335, 0.7, 0.315, 'left'], [0.055, 0.064], [0.83, 0.085, 0.15]),
  layout('minimal', 'Widescreen Key Art', 'A single key frame with one small inset.', [
    [0.03, 0.045, 0.986, 0.02, 0.972, 0.962, 0.02, 0.982, 1.7, 0.48, 0.58],
    [0.7, 0.7, 0.925, 0.69, 0.935, 0.905, 0.708, 0.918, 1.06, 0.5, 0.34],
  ], [0.06, 0.285, 0.64, 0.34, 'left'], [0.062, 0.085], [0.81, 0.12, 0.14]),
];
export const layoutById = (id) => LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];

export function buildGeometry(layout, width, height) {
  const { title, tagline, badge } = layout.zones;
  return {
    id: layout.id,
    width,
    height,
    panels: layout.panels.map((panel, index) => {
      const points = panel.points.map((p) => ({ x: p.x * width, y: p.y * height }));
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      return { index, points, focal: panel.focal, box, cx: box.x + box.w / 2, cy: box.y + box.h / 2 };
    }),
    zones: {
      title: { ...title, x: title.x * width, y: title.y * height, w: title.w * width, h: title.h * height },
      tagline: { x: tagline.x * width, y: tagline.y * height },
      badge: { cx: badge.x * width, cy: badge.y * height, radius: (badge.size * Math.min(width, height)) / 2 },
    },
  };
}

export function tracePanel(ctx, points) {
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

export function panelAt(geometry, x, y) {
  return geometry.panels.find(({ points }) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const a = points[i];
      const b = points[j];
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }) ?? null;
}
