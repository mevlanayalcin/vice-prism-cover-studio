// Original comic-mosaic panel geometry for Vice Prism covers. Every layout is a set of
// slanted quadrilaterals in unit space: the renderer scales them to the export size and leaves
// the gaps between them to become the thick jet-black gutters. Nothing here is traced from,
// or drawn after, any existing game cover: the slants, gutter rhythm and text wells are ours.
//
// The focal values are the artist's starting crops. A cut that holds a photo of a person is
// re-planned at render time around the detected face, so these numbers matter most for the
// painted procedural scenes: each one aims at a lit tower, a sun, a car or a facade rather than
// an empty sky.

const pt = (x, y) => ({ x, y });

/** A polygon from unit coordinates. */
const poly = (...points) => points.map(([x, y]) => pt(x, y));

const zones = (title, tagline, subtitle, badge, palms) => ({
  title,
  tagline,
  subtitle,
  badge,
  palms: palms ?? [],
});

/**
 * Six layouts, each with an original panel rhythm. `focal` is the starting crop for a panel:
 * a different auto-smart zoom and point of interest per shape, so one photo still reads as a
 * composed mosaic the moment the app opens.
 */
export const LAYOUTS = [
  {
    id: 'classic7',
    name: 'Classic 7-Panel',
    short: 'Mosaic',
    note: 'A hero cut between two wings, a lettering band and a three-cut foot.',
    panels: [
      { points: poly([0, 0], [0.262, 0], [0.276, 0.47], [0.004, 0.478]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
      { points: poly([0.29, 0], [0.708, 0], [0.72, 0.47], [0.302, 0.478]), focal: { zoom: 1.12, x: 0.5, y: 0.42 } },
      { points: poly([0.735, 0], [1, 0], [1, 0.468], [0.746, 0.47]), focal: { zoom: 1.2, x: 0.5, y: 0.45 } },
      { points: poly([0, 0.494], [1, 0.486], [1, 0.742], [0.002, 0.75]), focal: { zoom: 1.05, x: 0.5, y: 0.5 } },
      { points: poly([0, 0.766], [0.33, 0.76], [0.34, 1], [0.004, 1]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
      { points: poly([0.346, 0.76], [0.664, 0.756], [0.674, 1], [0.356, 1]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
      { points: poly([0.68, 0.756], [1, 0.752], [1, 1], [0.69, 1]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
    ],
    zones: zones(
      { x: 0.05, y: 0.5, w: 0.78, h: 0.235, align: 'center' },
      { x: 0.055, y: 0.052, align: 'left' },
      { x: 0.058, y: 0.862, align: 'left' },
      { x: 0.875, y: 0.62, size: 0.15, align: 'right' },
      [],
    ),
  },
  {
    id: 'asym9',
    name: 'Asymmetric 9',
    short: 'Grid',
    note: 'A towering hero, a four-cut cluster and a four-cut filmstrip foot.',
    panels: [
      { points: poly([0, 0], [0.42, 0], [0.43, 0.64], [0, 0.648]), focal: { zoom: 1.1, x: 0.5, y: 0.45 } },
      { points: poly([0.444, 0], [0.716, 0], [0.71, 0.304], [0.448, 0.31]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
      { points: poly([0.73, 0], [1, 0], [1, 0.298], [0.724, 0.304]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
      { points: poly([0.448, 0.326], [0.71, 0.32], [0.716, 0.634], [0.454, 0.638]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
      { points: poly([0.724, 0.32], [1, 0.314], [1, 0.628], [0.73, 0.634]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
      { points: poly([0, 0.668], [0.268, 0.662], [0.256, 1], [0, 1]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
      { points: poly([0.282, 0.662], [0.508, 0.656], [0.5, 1], [0.27, 1]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
      { points: poly([0.522, 0.656], [0.752, 0.652], [0.748, 1], [0.514, 1]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
      { points: poly([0.766, 0.652], [1, 0.648], [1, 1], [0.762, 1]), focal: { zoom: 1.3, x: 0.5, y: 0.5 } },
    ],
    zones: zones(
      { x: 0.04, y: 0.47, w: 0.66, h: 0.26, align: 'left' },
      { x: 0.045, y: 0.05, align: 'left' },
      { x: 0.046, y: 0.79, align: 'left' },
      { x: 0.89, y: 0.6, size: 0.14, align: 'right' },
      [],
    ),
  },
  {
    id: 'panorama',
    name: 'Panoramic Split',
    short: 'Split',
    note: 'A widescreen panorama over a split pair, lettering on the seam.',
    panels: [
      { points: poly([0, 0], [1, 0], [1, 0.47], [0, 0.53]), focal: { zoom: 1.05, x: 0.5, y: 0.5 } },
      { points: poly([0, 0.558], [0.49, 0.53], [0.47, 1], [0, 1]), focal: { zoom: 1, x: 0.5, y: 0.5 } },
      { points: poly([0.51, 0.528], [1, 0.5], [1, 1], [0.49, 1]), focal: { zoom: 1.15, x: 0.5, y: 0.45 } },
    ],
    zones: zones(
      { x: 0.05, y: 0.385, w: 0.8, h: 0.27, align: 'center' },
      { x: 0.055, y: 0.06, align: 'left' },
      { x: 0.058, y: 0.86, align: 'left' },
      { x: 0.88, y: 0.82, size: 0.15, align: 'right' },
      [],
    ),
  },
  {
    id: 'classic6',
    name: 'Classic 6-Panel',
    short: 'Mosaic',
    note: 'A tall hero, two wings, a lettering band and two feet.',
    panels: [
      { points: poly([0, 0], [0.262, 0], [0.278, 0.472], [0.004, 0.48]), focal: { zoom: 1.55, x: 0.44, y: 0.56 } },
      { points: poly([0.292, 0], [0.708, 0], [0.72, 0.472], [0.304, 0.48]), focal: { zoom: 1.16, x: 0.5, y: 0.42 } },
      { points: poly([0.735, 0], [1, 0], [1, 0.47], [0.747, 0.462]), focal: { zoom: 1.08, x: 0.54, y: 0.4 } },
      { points: poly([0, 0.486], [1, 0.484], [1, 0.744], [0.002, 0.75]), focal: { zoom: 1.1, x: 0.58, y: 0.5 } },
      { points: poly([0, 0.766], [0.49, 0.76], [0.5, 1], [0.004, 1]), focal: { zoom: 1.8, x: 0.55, y: 0.35 } },
      { points: poly([0.516, 0.76], [1, 0.754], [1, 1], [0.526, 1]), focal: { zoom: 1.1, x: 0.48, y: 0.5 } },
    ],
    zones: zones(
      { x: 0.05, y: 0.5, w: 0.8, h: 0.234, align: 'center' },
      { x: 0.055, y: 0.052, align: 'left' },
      { x: 0.058, y: 0.862, align: 'left' },
      { x: 0.855, y: 0.79, size: 0.145, align: 'right' },
      [{ x: 0.925, y: 0.985, scale: 0.62, flip: true }],
    ),
  },
  {
    id: 'mosaic6',
    name: 'Neon Mosaic',
    short: 'Mosaic',
    note: 'A tall tower cut and five neon shards.',
    panels: [
      { points: poly([0, 0], [0.4, 0], [0.415, 1], [0, 1]), focal: { zoom: 1.24, x: 0.5, y: 0.44 } },
      { points: poly([0.43, 0], [0.7, 0], [0.712, 0.318], [0.444, 0.326]), focal: { zoom: 1.8, x: 0.7, y: 0.3 } },
      { points: poly([0.727, 0], [1, 0], [1, 0.31], [0.737, 0.318]), focal: { zoom: 1.7, x: 0.68, y: 0.7 } },
      { points: poly([0.444, 0.35], [0.72, 0.34], [0.734, 0.662], [0.458, 0.674]), focal: { zoom: 1.16, x: 0.46, y: 0.42 } },
      { points: poly([0.474, 0.698], [0.744, 0.688], [0.758, 1], [0.49, 1]), focal: { zoom: 1.7, x: 0.33, y: 0.62 } },
      { points: poly([0.776, 0.685], [1, 0.677], [1, 1], [0.79, 1]), focal: { zoom: 1.55, x: 0.43, y: 0.58 } },
    ],
    zones: zones(
      { x: 0.05, y: 0.5, w: 0.78, h: 0.34, align: 'left' },
      { x: 0.055, y: 0.05, align: 'left' },
      { x: 0.058, y: 0.862, align: 'left' },
      { x: 0.855, y: 0.078, size: 0.14, align: 'right' },
      [{ x: 0.5, y: 0.995, scale: 0.5, flip: false }],
    ),
  },
  {
    id: 'diagonal4',
    name: 'Split Diagonal',
    short: 'Action',
    note: 'Four cuts slashed by a rising diagonal.',
    panels: [
      { points: poly([0, 0], [0.635, 0], [0.38, 0.52], [0, 0.52]), focal: { zoom: 1.7, x: 0.48, y: 0.54 } },
      { points: poly([0.657, 0], [1, 0], [1, 0.52], [0.402, 0.52]), focal: { zoom: 1.6, x: 0.12, y: 0.75 } },
      { points: poly([0, 0.546], [0.4, 0.546], [0.672, 1], [0, 1]), focal: { zoom: 1.3, x: 0.5, y: 0.55 } },
      { points: poly([0.424, 0.546], [1, 0.546], [1, 1], [0.694, 1]), focal: { zoom: 1.1, x: 0.58, y: 0.56 } },
    ],
    zones: zones(
      { x: 0.052, y: 0.5, w: 0.66, h: 0.33, align: 'left' },
      { x: 0.055, y: 0.058, align: 'left' },
      { x: 0.058, y: 0.858, align: 'left' },
      { x: 0.84, y: 0.778, size: 0.15, align: 'right' },
      [{ x: 0.7, y: 0.6, scale: 0.58, flip: false }],
    ),
  },
  {
    id: 'triptych3',
    name: 'Sunset Triptych',
    short: 'Triptych',
    note: 'Three leaning towers of a postcard.',
    panels: [
      { points: poly([0, 0], [0.312, 0], [0.335, 1], [0, 1]), focal: { zoom: 1.02, x: 0.46, y: 0.4 } },
      { points: poly([0.348, 0], [0.664, 0], [0.678, 1], [0.371, 1]), focal: { zoom: 1.4, x: 0.4, y: 0.68 } },
      { points: poly([0.692, 0], [1, 0], [1, 1], [0.706, 1]), focal: { zoom: 1.08, x: 0.52, y: 0.44 } },
    ],
    zones: zones(
      { x: 0.05, y: 0.522, w: 0.64, h: 0.33, align: 'left' },
      { x: 0.055, y: 0.06, align: 'left' },
      { x: 0.058, y: 0.866, align: 'left' },
      { x: 0.85, y: 0.778, size: 0.15, align: 'right' },
      [{ x: 0.972, y: 0.988, scale: 0.55, flip: true }],
    ),
  },
  {
    id: 'hero-strips',
    name: 'Hero + 3 Strips',
    short: 'Feature',
    note: 'A widescreen hero over three tilted strips.',
    panels: [
      { points: poly([0, 0], [1, 0], [1, 0.672], [0, 0.692]), focal: { zoom: 1.5, x: 0.53, y: 0.54 } },
      { points: poly([0, 0.714], [0.352, 0.7], [0.342, 1], [0, 1]), focal: { zoom: 1.1, x: 0.58, y: 0.58 } },
      { points: poly([0.368, 0.698], [0.674, 0.694], [0.668, 1], [0.358, 1]), focal: { zoom: 1.5, x: 0.2, y: 0.45 } },
      { points: poly([0.69, 0.692], [1, 0.69], [1, 1], [0.684, 1]), focal: { zoom: 1.6, x: 0.7, y: 0.32 } },
    ],
    zones: zones(
      { x: 0.052, y: 0.335, w: 0.7, h: 0.315, align: 'left' },
      { x: 0.055, y: 0.064, align: 'left' },
      { x: 0.058, y: 0.66, align: 'left' },
      { x: 0.83, y: 0.085, size: 0.15, align: 'right' },
      [{ x: 0.9, y: 0.68, scale: 0.66, flip: true }, { x: 0.03, y: 0.72, scale: 0.44, flip: false }],
    ),
  },
  {
    id: 'minimal',
    name: 'Widescreen Key Art',
    short: 'Minimal',
    note: 'A single key frame with one small inset.',
    panels: [
      { points: poly([0.03, 0.045], [0.986, 0.02], [0.972, 0.962], [0.02, 0.982]), focal: { zoom: 1.7, x: 0.48, y: 0.58 } },
      { points: poly([0.7, 0.7], [0.925, 0.69], [0.935, 0.905], [0.708, 0.918]), focal: { zoom: 1.06, x: 0.5, y: 0.34 } },
    ],
    zones: zones(
      { x: 0.06, y: 0.285, w: 0.64, h: 0.34, align: 'left' },
      { x: 0.062, y: 0.085, align: 'left' },
      { x: 0.064, y: 0.665, align: 'left' },
      { x: 0.81, y: 0.12, size: 0.14, align: 'right' },
      [{ x: 0.88, y: 0.94, scale: 0.72, flip: true }],
    ),
  },
];

export const layoutById = (id) => LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];

/** Scale a layout's unit polygons to the canvas, keeping a numeric panel id. */
export function buildGeometry(layout, width, height) {
  return {
    id: layout.id,
    width,
    height,
    panels: layout.panels.map((panel, index) => {
      const points = panel.points.map((p) => ({ x: p.x * width, y: p.y * height }));
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      return {
        index,
        points,
        focal: panel.focal,
        box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
      };
    }),
    zones: {
      ...layout.zones,
      title: scaleZone(layout.zones.title, width, height),
      badge: {
        ...layout.zones.badge,
        cx: layout.zones.badge.x * width,
        cy: layout.zones.badge.y * height,
        radius: (layout.zones.badge.size * Math.min(width, height)) / 2,
      },
      tagline: { ...layout.zones.tagline, x: layout.zones.tagline.x * width, y: layout.zones.tagline.y * height },
      subtitle: { ...layout.zones.subtitle, x: layout.zones.subtitle.x * width, y: layout.zones.subtitle.y * height },
      palms: layout.zones.palms.map((p) => ({ x: p.x * width, y: p.y * height, scale: p.scale * Math.min(width, height), flip: p.flip })),
    },
  };
}

function scaleZone(zone, width, height) {
  return { ...zone, x: zone.x * width, y: zone.y * height, w: zone.w * width, h: zone.h * height };
}

/** Trace a panel's polygon on a context. */
export function tracePanel(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}

/** Which panel (if any) holds a point in poster pixels. */
export function panelAt(geometry, x, y) {
  for (const panel of geometry.panels) {
    if (pointInPolygon(x, y, panel.points)) return panel;
  }
  return null;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
