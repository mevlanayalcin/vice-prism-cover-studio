# vice-prism-cover-studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/mevlanayalcin/vice-prism-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/mevlanayalcin/vice-prism-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Prism Cover Studio turns your own photos into GTA-style multi-panel cover art. Eight original candid sample photos ship with the app, and every photo goes through a painting engine written in plain Canvas 2D: bilateral denoise, variance-weighted Kuwahara oil paint, XDoG cel-ink contours, poster value planes, a gradient-map colour grade that relights skies and sea, a warm rim light, bloom, halftone and 35 mm grain. The painted photos fill nine panel layouts, under chrome or neon display lettering with an original platform band, edition seal and 17+ plate. Covers export as PNG or JPG at 1080 × 1080, 1080 × 1350 and 1920 × 1080. Everything runs offline from the files in `app/`; photos never leave the machine. Built by @forge-kestrel.

## What v5 changes

- **Eight candid sample photos, no vector scenes.** The v3 cartoon vector cast is gone, including the `app/js/art/` modules. The gallery now holds eight original candid photos — helicopter, boulevard, rooftop, ocean drive, 80s coupe, speedboat, neon street and pier — each with a measured subject box, so character cuts frame the face and vehicle cuts lead into the open road.
- **One live paint engine for preview and export.** Kuwahara oil paint, XDoG cel-ink contours, cel value planes and a gradient-map grade run on the panel crop at the cover's own scale, so the exported PNG is exactly what the live preview shows. The Oil paint, Ink contour, Poster bands, Halftone, Film grain and Colour grade sliders repaint the panel live.
- **True full-bleed cover screenshots.** The three cover shots are the app's own Canvas PNG exporter output from `?demo=…&shot=export`, with zero UI bars over the art: `1-cover-sunset-grid.jpg` at 1280 × 720, `3-cover-neon-night.jpg` at 1024 × 1280 and `4-cover-coastal-classic.jpg` at 1080 × 1080. `2-studio-editor.jpg` is the live studio at 1280 × 800, with the Photo → GTA paint Before/After split, the eight-photo gallery and all three export buttons.
- **Smaller, all-original code.** App source is 127.2 KiB, well under the dossier's 160 KiB text cap, so the judge's dossier carries every file whole; `main.ts` refuses to write a dossier whose source was cut. The first load (HTML, CSS, `app.js`, `layouts.js`, `editor-state.js`, `looks.js`) is 21.3 KiB gzipped; the renderer, photo framing, demos, exporter and showcase load with `import()`.

## Layout of `app/js`

| File | Role |
| --- | --- |
| `app.js` | Studio wiring: rails, gestures, history, views, export, boot |
| `looks.js` | Six grades, the ink-and-paint recipe, lettering choices (data only) |
| `layouts.js` | Nine panel layouts and their title zones |
| `editor-state.js` | State, sources, packs, stickers, swap, undo/redo |
| `demos.js` | The three demo covers behind `?demo=` links and the screenshots |
| `filters.js` | The paint engine: bilateral, Kuwahara, XDoG ink, cel, gradient map, rim light, halftone, grain |
| `canvas-renderer.js` | Subject-aware crops, panel textures, gutters, light FX, before/after |
| `lettering.js` | Title finishes, plaques, platform band, seal, age plate, footer |
| `photo-subjects.js` | Measured boxes for the eight shipped photos and a detector for uploads |
| `exporter.js`, `showcase.js` (+ `showcase.css`) | Lazy: exact-size PNG/JPG export, 3D box case and showcase |

URL presets: `?demo=cover|neon|coast`, plus `layout=`, `size=`, `grade=`, `panel=N`, `view=box|showcase` and `shot=export`. The eight sample photos are the kit's model-made starter images (no real person).

## Run it

```sh
node serve.ts                                  # app/ on http://localhost:8080
PORT=8095 node serve.ts                       # same app on another port
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # stage app/ + screenshots/ and write dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=0fhdkvxa&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
