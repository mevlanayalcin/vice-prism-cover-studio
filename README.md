# vice-prism-cover-studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/mevlanayalcin/vice-prism-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/mevlanayalcin/vice-prism-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Prism Cover Studio builds a multi-panel Leonida cover in a hand-inked comic-noir style: eight original vector illustrations (heiress, night driver, sunset run, neon boulevard, harbor chase, searchlight helicopter, flamingo riviera, getaway at dusk), your own photos painted to match, nine panel layouts, six colour grades and a display-lettering engine with an original platform band, edition seal and 17+ plate. It exports PNG or JPG at 1080 × 1080, 1080 × 1350 and 1920 × 1080, entirely offline: every scene, glyph and pixel is drawn on your machine from files in `app/`, and nothing is uploaded. Built by @forge-kestrel.

## What v3 adds

- **Hand-inked scene art.** Eight scenes drawn as Path2D vector art at panel resolution: keylined figures with cel shading and rim light, Art Deco hotels, skylines with lit windows, palms, coupes, speedboats, a helicopter and flamingos. They stay crisp at any export size, and the night grade relights the day and sunset scenes so a Neon Night cover never mixes daylight panels.
- **New layouts.** Classic 7-panel mosaic, asymmetric 9-panel and panoramic split, alongside the six v2 layouts.
- **Studio tools.** Panel picker and swap, gallery and one-click packs (Sunset Grid, Neon Night, Coastal), per-panel zoom/rotate/flip/grade, title, subtitle, tagline, seal and band text, sticker and lighting toggles, undo/redo (Ctrl Z / Ctrl Shift Z), a live 3D box case and a full-screen showcase with every post size.
- **Smaller first load.** The page loads only the shell (`app.js`, `layouts.js`, `editor-state.js`, `looks.js`, HTML and CSS, about 23.6 KB gzipped). The renderer, art, photo framing, exporter and showcase arrive with `import()`.

## Layout of `app/js`

| File | Role |
| --- | --- |
| `app.js` | Studio wiring, history, views, boot |
| `looks.js` | Grades, ink-and-paint recipe, lettering choices (data only) |
| `layouts.js` | Nine panel layouts and their title zones |
| `editor-state.js` | State, sources, packs, stickers, swap, undo/redo, demos |
| `canvas-renderer.js` | Panel crops, textures, gutters, lighting |
| `filters.js` | Pixel pipeline: bilateral paint, ink contour, grade, halftone, grain |
| `lettering.js` | Title, plaques, platform band, seal, age plate, footer |
| `art/ink-kit.js`, `art/props.js`, `art/figures.js`, `art/scenes.js` | Vector ink helpers, props, figures and the eight scenes |
| `photo-subjects.js` | Face boxes for the shipped photos and a detector for uploads |
| `exporter.js`, `showcase.js` | Lazy: export, 3D box case and showcase |

URL presets: `?demo=cover|neon|coast`, plus `layout=`, `size=`, `grade=`, `panel=N` and `view=box|showcase`.

## Run it

```sh
node serve.ts                                  # app/ on http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # stage app/ + screenshots/ and write dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=0fhdkvxa&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
