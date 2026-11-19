// Original comic-mosaic panel geometry for Vice Prism covers. Every layout is a set of
// slanted quadrilaterals in unit space: the renderer scales them to the export size and leaves
// the gaps between them to become the thick jet-black gutters. Nothing here is traced from,
// or drawn after, any existing game cover: the slants, gutter rhythm and text wells are ours.

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
    id: 'classic6',
    name: 'Classic 6-Panel',
    short: 'Mosaic',
    note: 'Three cuts over a lettering band over two feet.',
    panels: [
      { points: poly([0, 0], [0.265, 0], [0.281, 0.408], [0.006, 0.418]), focal: { zoom: 1.2, x: 0.46, y: 0.44 } },
      { points: poly([0.296, 0], [0.704, 0], [0.717, 0.402], [0.31, 0.412]), focal: { zoom: 1.0, x: 0.5, y: 0.58 } },
      { points: poly([0.73, 0], [1, 0], [1, 0.408], [0.742, 0.4]), focal: { zoom: 1.28, x: 0.5, y: 0.42 } },
      { points: poly([0, 0.418], [0.995, 0.416], [1, 0.712], [0.002, 0.72]), focal: { zoom: 1.05, x: 0.5, y: 0.55 } },
      { points: poly([0, 0.742], [0.49, 0.736], [0.5, 1], [0.004, 1]), focal: { zoom: 1.34, x: 0.46, y: 0.6 } },
      { points: poly([0.516, 0.736], [1, 0.73], [1, 1], [0.526, 1]), focal: { zoom: 1.2, x: 0.56, y: 0.56 } },
    ],
    zones: zones(
      { x: 0.05, y: 0.424, w: 0.8, h: 0.278, align: 'center' },
      { x: 0.055, y: 0.06, align: 'left' },
      { x: 0.058, y: 0.836, align: 'left' },
      { x: 0.855, y: 0.795, size: 0.145, align: 'right' },
      [{ x: 0.925, y: 0.985, scale: 0.62, flip: true }],
    ),
  },
  {
    id: 'mosaic6',
    name: 'Neon Mosaic',
    short: 'Mosaic',
    note: 'A tall tower cut and five neon shards.',
    panels: [
      { points: poly([0, 0], [0.395, 0], [0.412, 1], [0, 1]), focal: { zoom: 1.2, x: 0.46, y: 0.46 } },
      { points: poly([0.432, 0], [0.7, 0], [0.712, 0.315], [0.446, 0.322]), focal: { zoom: 1.34, x: 0.52, y: 0.36 } },
      { points: poly([0.732, 0], [1, 0], [1, 0.305], [0.742, 0.315]), focal: { zoom: 1.24, x: 0.45, y: 0.5 } },
      { points: poly([0.462, 0.352], [0.73, 0.342], [0.746, 0.66], [0.478, 0.672]), focal: { zoom: 1.4, x: 0.56, y: 0.52 } },
      { points: poly([0.496, 0.702], [0.762, 0.692], [0.776, 1], [0.512, 1]), focal: { zoom: 1.16, x: 0.42, y: 0.58 } },
      { points: poly([0.792, 0.69], [1, 0.682], [1, 1], [0.806, 1]), focal: { zoom: 1.3, x: 0.5, y: 0.6 } },
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
      { points: poly([0, 0], [0.635, 0], [0.38, 0.52], [0, 0.52]), focal: { zoom: 1.16, x: 0.45, y: 0.46 } },
      { points: poly([0.657, 0], [1, 0], [1, 0.52], [0.402, 0.52]), focal: { zoom: 1.28, x: 0.56, y: 0.42 } },
      { points: poly([0, 0.546], [0.4, 0.546], [0.672, 1], [0, 1]), focal: { zoom: 1.3, x: 0.4, y: 0.6 } },
      { points: poly([0.424, 0.546], [1, 0.546], [1, 1], [0.694, 1]), focal: { zoom: 1.12, x: 0.57, y: 0.58 } },
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
      { points: poly([0, 0], [0.312, 0], [0.335, 1], [0, 1]), focal: { zoom: 1.24, x: 0.44, y: 0.48 } },
      { points: poly([0.348, 0], [0.664, 0], [0.678, 1], [0.371, 1]), focal: { zoom: 1.08, x: 0.53, y: 0.52 } },
      { points: poly([0.692, 0], [1, 0], [1, 1], [0.706, 1]), focal: { zoom: 1.32, x: 0.5, y: 0.44 } },
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
      { points: poly([0, 0], [1, 0], [1, 0.672], [0, 0.692]), focal: { zoom: 1.04, x: 0.5, y: 0.5 } },
      { points: poly([0, 0.714], [0.352, 0.7], [0.342, 1], [0, 1]), focal: { zoom: 1.36, x: 0.48, y: 0.55 } },
      { points: poly([0.368, 0.698], [0.674, 0.694], [0.668, 1], [0.358, 1]), focal: { zoom: 1.28, x: 0.52, y: 0.58 } },
      { points: poly([0.69, 0.692], [1, 0.69], [1, 1], [0.684, 1]), focal: { zoom: 1.18, x: 0.46, y: 0.52 } },
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
      { points: poly([0.03, 0.045], [0.986, 0.02], [0.972, 0.962], [0.02, 0.982]), focal: { zoom: 1.02, x: 0.5, y: 0.52 } },
      { points: poly([0.7, 0.7], [0.925, 0.69], [0.935, 0.905], [0.708, 0.918]), focal: { zoom: 1.38, x: 0.5, y: 0.45 } },
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
