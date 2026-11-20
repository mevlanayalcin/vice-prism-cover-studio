#!/usr/bin/env node
// Vice Prism Cover Studio — the make.fun entry for gta6-cover-art-01.
//
// The app is this repository's app/ folder: plain static files, no build step, no network
// request. It paints eight original candid sample photos — and the user's own — into GTA-style
// cover art on a Canvas 2D engine (bilateral denoise, eight-region Kuwahara oil paint, despeckled
// XDoG comic ink, clarity, poster value planes with a filmic shoulder, gradient-map grade with sky
// relight, dual-tone rim light, halftone, paper grain), cuts them into nine panel layouts (multi-
// photo, or one photo auto-sliced into hero, close-up and detail cuts), letters the cover with a
// draggable, sizable, tiltable title and exports PNG or JPG at 1080 x 1080, 1080 x 1350 or
// 1920 x 1080, reading the real pixel size back out of the encoded file.
//
// The four screenshots are the app's own output: three true full-bleed covers straight from its
// Canvas PNG exporter (?shot=export) at 16:9, 4:5 and 1:1, plus the live studio editor at
// 1440 x 900 with its Before / After split. No UI bars sit over a cover shot.
//
// This program is only the hand-in. It stages app/ and screenshots/ into the output directory,
// writes dossier.json with the kit's buildDossier, and prints the gate-facing totals. Node
// standard library only.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts        # outside the grader, out stands in for /output

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const ENTRY = {
  competition: 'gta6-cover-art-01',
  app: 'Vice Prism Cover Studio',
  version: '7.0.0',
  runtime: 'Canvas 2D, ES modules, zero dependencies',
} as const;

// The files the entry cannot work without. A missing one is an author error, not a gate result,
// so the run stops with the path instead of shipping a broken app.
const REQUIRED = [
  'index.html', 'styles.css', 'showcase.css',
  'js/app.js', 'js/layouts.js', 'js/looks.js', 'js/editor-state.js', 'js/demos.js',
  'js/canvas-renderer.js', 'js/filters.js', 'js/lettering.js', 'js/photo-subjects.js',
  'js/exporter.js', 'js/showcase.js',
  'samples/heli.jpg', 'samples/boulevard.jpg', 'samples/rooftop.jpg', 'samples/ocean-drive.jpg',
  'samples/coupe.jpg', 'samples/speedboat.jpg', 'samples/neon-street.jpg', 'samples/pier.jpg',
  'fonts/vp-display.woff2', 'fonts/vp-text.woff2', 'fonts/vp-text-bold.woff2', 'fonts/vp-editorial.woff2',
];

const SHOT_LIMITS = { count: 4, bytes: 262144 };
const APP_LIMITS = { files: 993, bytes: 48 * 1024 * 1024 };
const DOSSIER_TEXT_MAX = 163840;

interface TreeStats {
  files: number;
  entries: number;
  bytes: number;
  largest: { path: string; bytes: number };
  symlinks: string[];
}

function walk(root: string, base = root, stats: TreeStats): void {
  for (const name of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, name.name);
    const path = relative(base, full);
    stats.entries += 1;
    if (name.isSymbolicLink()) {
      stats.symlinks.push(path);
      continue;
    }
    if (name.isDirectory()) {
      walk(full, base, stats);
      continue;
    }
    const bytes = statSync(full).size;
    stats.files += 1;
    stats.bytes += bytes;
    if (bytes > stats.largest.bytes) stats.largest = { path, bytes };
  }
}

function treeStats(dir: string): TreeStats {
  const stats: TreeStats = { files: 0, entries: 0, bytes: 0, largest: { path: '', bytes: 0 }, symlinks: [] };
  walk(dir, dir, stats);
  return stats;
}

function shotFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => !name.startsWith('.') && /\.(png|jpe?g)$/i.test(name))
    .sort();
}

function fail(message: string): never {
  console.error(`vice-prism: ${message}`);
  process.exit(1);
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const appSrc = join(here, 'app');
const shotsSrc = join(here, 'screenshots');

for (const path of REQUIRED) {
  if (!existsSync(join(appSrc, path))) fail(`app/${path} is missing`);
}

const stagedShots = shotFiles(shotsSrc);
if (stagedShots.length < 3 || stagedShots.length > SHOT_LIMITS.count) {
  fail(`screenshots/ must hold 3 or 4 images, found ${stagedShots.length}`);
}

// shots.json is the screenshot manifest the README and the captures follow: every entry it names
// must be staged, and nothing staged may be missing from it.
const manifest = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8')) as { name: string }[];
const listed = manifest.map((shot) => shot.name).sort();
if (listed.join('|') !== stagedShots.join('|')) fail(`shots.json lists ${listed.join(', ')} but screenshots/ holds ${stagedShots.join(', ')}`);

// Write the whole output afresh: a stale file from an earlier run must never change the bytes
// of the dossier a grader reads.
rmSync(join(out, 'app'), { recursive: true, force: true });
rmSync(join(out, 'screenshots'), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(appSrc, join(out, 'app'), { recursive: true });
cpSync(shotsSrc, join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: DOSSIER_TEXT_MAX,
  screenshots: { max: SHOT_LIMITS.count, max_bytes: SHOT_LIMITS.bytes },
  app_max_files: APP_LIMITS.files,
  app_max_bytes: APP_LIMITS.bytes,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

const appStats = treeStats(join(out, 'app'));
const shotStats = treeStats(join(out, 'screenshots'));
const dossierBytes = statSync(join(out, 'dossier.json')).size;
const digest = createHash('sha256').update(dossier).digest('hex');

if (appStats.symlinks.length) fail(`app/ holds a symlink: ${appStats.symlinks[0]}`);
if (appStats.files > APP_LIMITS.files || appStats.entries > APP_LIMITS.files) {
  fail(`app/ holds ${appStats.entries} entries, over ${APP_LIMITS.files}`);
}
if (appStats.bytes > APP_LIMITS.bytes) fail(`app/ holds ${appStats.bytes} bytes, over ${APP_LIMITS.bytes}`);
if (statSync(join(out, 'app', 'index.html')).size > 1024 * 1024) fail('app/index.html is over 1 MiB');
for (const name of stagedShots) {
  const bytes = statSync(join(out, 'screenshots', name)).size;
  if (bytes > SHOT_LIMITS.bytes) fail(`screenshots/${name} is ${bytes} bytes, over ${SHOT_LIMITS.bytes}`);
}
if (dossierBytes > 1.5 * 1024 * 1024) fail(`dossier.json is ${dossierBytes} bytes, over 1.5 MiB`);
// The judge reads the source text whole only while it fits the 160 KiB cap; a cut line means an
// author error here, so the run refuses to ship a dossier whose source was truncated.
if (dossier.includes('[Cut at ')) fail('dossier source text was cut at the cap: trim app/ sources');
const sourceBytes = (dir: string): number => readdirSync(dir, { withFileTypes: true }).reduce((sum, d) => {
  const full = join(dir, d.name);
  if (d.isDirectory()) return d.name === 'vendor' ? sum : sum + sourceBytes(full);
  return /\.(html|m?js|css|json|glsl|vert|frag|wgsl)$/.test(d.name) && !/\.min\.(m?js|css)$/.test(d.name) ? sum + statSync(full).size : sum;
}, 0);
const appSource = sourceBytes(join(out, 'app'));

const mib = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);
const kib = (bytes: number) => (bytes / 1024).toFixed(1);

console.log(`Vice Prism Cover Studio v${ENTRY.version} — ${ENTRY.competition}`);
console.log(`${ENTRY.runtime} · original art · 100% offline`);
console.log(`app/         ${appStats.files} files, ${appStats.entries} entries, ${mib(appStats.bytes)} MiB`);
console.log(`largest      app/${appStats.largest.path} (${kib(appStats.largest.bytes)} KiB)`);
console.log(`screenshots/ ${stagedShots.length} files, ${kib(shotStats.bytes)} KiB — ${stagedShots.join(', ')}`);
console.log(`source text  ${kib(appSource)} KiB of ${kib(DOSSIER_TEXT_MAX)} KiB cap · whole, nothing cut`);
console.log(`dossier.json ${kib(dossierBytes)} KiB · sha256 ${digest.slice(0, 16)}`);
console.log(`output       ${out}`);
