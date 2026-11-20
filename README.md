# vice-prism-cover-studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/mevlanayalcin/vice-prism-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/mevlanayalcin/vice-prism-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Prism Cover Studio turns your own photos into GTA-style multi-panel cover art. Every photo goes through a painting engine written in plain Canvas 2D: bilateral denoise, Kuwahara oil paint, XDoG ink contours, cel value planes, a gradient-map colour grade that relights skies and sea, a warm rim light with cool shadow fill, bloom, halftone and grain. The painted photos sit beside six original inked Leonida scenes (neon boulevard, sunset run, harbor chase, searchlight helicopter, flamingo riviera, getaway at dusk) in nine panel layouts, under chrome or neon display lettering with an original platform band, edition seal and 17+ plate. Covers export as PNG or JPG at 1080 × 1080, 1080 × 1350 and 1920 × 1080. Everything runs offline from the files in `app/`; photos never leave the machine. Built by @forge-kestrel.

## What v4 changes

- **Painted photos, no cartoon faces.** The v3 vector heads are gone. Every character panel is a real photo painted by the engine, framed on the detected face, and one photo can fill several cuts with different crops (the neon cover uses one photo twice, once flipped close).
- **Photo → GTA paint preview.** The editor shows the selected panel's raw photo beside its painted version, and the Oil paint, Ink contour, Halftone, Film grain and Colour grade sliders update it live.
- **Night and sunset relight.** Blue skies and sea take the grade much harder than skin, so a noon photo turns dusk-pink under Vice Sunset and cyan-magenta under Neon Midnight while faces keep their tone.
- **Smaller code.** App source is 151 KB (148 KiB), under the dossier's 160 KiB text cap, so the judge's dossier carries every file whole. `main.ts` refuses to write a dossier whose source was cut. The first load (HTML, CSS, `app.js`, `layouts.js`, `editor-state.js`, `looks.js`) is 19.9 KB gzipped; the renderer, art, demos, exporter, showcase and its stylesheet load with `import()`.

## Layout of `app/js`

| File | Role |
| --- | --- |
| `app.js` | Studio wiring: rails, gestures, history, views, export, boot |
| `looks.js` | Six grades, the ink-and-paint recipe, lettering choices (data only) |
| `layouts.js` | Nine panel layouts and their title zones |
| `editor-state.js` | State, sources, packs, stickers, swap, undo/redo |
| `demos.js` | Demo covers for `?demo=` links and the screenshots |
| `filters.js` | The paint engine: bilateral, Kuwahara, XDoG ink, cel, grade, rim light, halftone, grain |
| `canvas-renderer.js` | Face-aware crops, panel textures, gutters, light FX, before/after |
| `lettering.js` | Title finishes, plaques, platform band, seal, age plate, footer |
| `art/ink-kit.js`, `art/props.js`, `art/scenes.js` | Vector ink helpers, props and the six scenes |
| `photo-subjects.js` | Face boxes for the shipped photos and a detector for uploads |
| `exporter.js`, `showcase.js` (+ `showcase.css`) | Lazy: export, 3D box case and showcase |

URL presets: `?demo=cover|neon|coast`, plus `layout=`, `size=`, `grade=`, `panel=N` and `view=box|showcase`. The two sample photos are the kit's model-made starter images (no real person).

## Run it

```sh
node serve.ts                                  # app/ on http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # stage app/ + screenshots/ and write dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=0fhdkvxa&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
