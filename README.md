# vice-prism-cover-studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/mevlanayalcin/vice-prism-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/mevlanayalcin/vice-prism-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Prism Cover Studio turns your own photos into GTA-style multi-panel cover art in three steps: add photos, tune the cover on the live canvas, export a PNG. Eight original candid sample photos ship with the app, and every photo goes through a painting engine written in plain Canvas 2D: bilateral denoise, eight-region Kuwahara oil paint, despeckled XDoG comic ink, clarity, poster value planes with a filmic highlight shoulder, a gradient-map grade that relights blue or washed-out skies, a dual-tone rim light, bloom, halftone and paper grain. The painted photos fill nine panel layouts, under chrome or neon display lettering with an original edition seal, 17+ plate and barcode. Covers export as PNG or JPG at 1080 × 1080, 1080 × 1350 and 1920 × 1080. Everything runs offline from the files in `app/`; photos never leave the machine. Built by @forge-kestrel.

## What v7 changes

- **Cleaner paint, no square blocks.** The Kuwahara brush now weighs eight overlapping regions (four quadrants that overlap the centre plus four half-planes), so strokes follow diagonals instead of breaking into axis-aligned blocks. Fine ink is despeckled over a wider field than the bold silhouettes, which removes the dark dashes that ripples and foliage used to leave.
- **No clipping, no grey.** Tones pass a filmic shoulder, and a pixel that runs past white is scaled down as a whole, so a coral sky keeps its hue. A clarity pass adds local contrast, a vibrance term saturates dull colours more than rich ones, and blown white skies take the look's own sky colour. At night the midtones drop while lamps and white hulls stay bright, and faces keep more of their own warmth.
- **Four flagship looks.** Vice Sunset, Leonida Neon, Coastal Classic (turquoise water under a golden-hour sky) and the new Midnight Heat (ember red and amber sign light over violet), plus Palm Gold and Ocean Drive.
- **Five signature layouts first.** Classic Vice Grid (diagonal helicopter corner top left), Widescreen Action Mosaic (new, 8 cuts), Hero Split Poster (new, a full-height hero beside three shards), Portrait Box Art for 4:5 and Neon Triptych, then Diagonal 5, Neon Tower, Hero + 3 Strips and Split Diagonal. An optional white keyline sits inside the black gutters.
- **1-Photo Auto-Slice.** One photo fills every cut: the largest cut frames the subject, tall cuts take a close-up, wide strips the establishing view, and the rest zoom into the photo's own strongest details (edge-energy cells with non-maximum suppression, computed locally for uploads too).
- **Title you can move.** Drag the title on the canvas, scroll over it to size it, or use the Size and Tilt sliders. The tilted lockup is clamped inside the frame. The subtitle ribbon is set in italic, and the neon finish draws it as a glowing glass sign. The edition badge field suggests original editions (SOLARIS EDITION, COLLECTOR'S CUT, COASTAL SERIES, MIDNIGHT CUT).
- **Live Before / After.** A toggle (or the B key) splits the main canvas: raw framed photos left of a draggable divider, the painted cover right.
- **Verified export.** After encoding, the exporter reads the pixel size back out of the PNG IHDR chunk (or the JPEG SOF marker) and refuses a file whose size differs. The toast shows that measured size.
- **Studio layout.** The workspace follows the three steps, the post-size switch moved into the stage bar, type is set at 8-13 px, and the studio screenshot is now 1440 × 900.

## What v6 changes

- **Crisper paint.** An unsharp pass after the Kuwahara brush turns soft stroke edges back into hard painted ones. The XDoG ink mask is thresholded into pen-crisp lines instead of grey halos, the deepest non-skin shadows fill with flat ink (spotted blacks), and the poster bands step harder outside skin.
- **Thick black comic gutters.** The gutter is 2.1 % of the short side (was 1.45 %) with a heavier outer frame. The coloured neon bevel is now off by default, so every panel sits in plain jet-black ink. It is still one toggle away under Box-art marks.
- **Steeper Classic 7 cuts.** The top and bottom rows lean on opposing diagonals and the title band tilts with them, which gives the landscape cover a larger hero portrait panel.
- **Neon Midnight split light.** The night grade now lights each panel with a magenta key and a cyan sign-light fill on the opposite side, over deeper navy shadows, so the 4:5 neon cover is no longer one flat purple. Skin protection relaxes at night so faces take the sign light too.
- **Fresh screenshots.** All four were re-rendered in headless desktop Chrome from `?demo=…&shot=export` (the app's own PNG exporter) and `?demo=cover&panel=1` (the studio), then downscaled per `shots.json`.

## What v5 changes

- **Eight candid sample photos, no vector scenes.** The v3 cartoon vector cast is gone, including the `app/js/art/` modules. The gallery now holds eight original candid photos — helicopter, boulevard, rooftop, ocean drive, 80s coupe, speedboat, neon street and pier — each with a measured subject box, so character cuts frame the face and vehicle cuts lead into the open road.
- **One live paint engine for preview and export.** Kuwahara oil paint, XDoG cel-ink contours, cel value planes and a gradient-map grade run on the panel crop at the cover's own scale, so the exported PNG is exactly what the live preview shows. The Oil paint, Ink contour, Poster bands, Halftone, Film grain and Colour grade sliders repaint the panel live.
- **True full-bleed cover screenshots.** The three cover shots are the app's own Canvas PNG exporter output from `?demo=…&shot=export`, with zero UI bars over the art: `1-cover-sunset-grid.jpg` at 1280 × 720, `3-cover-neon-night.jpg` at 1024 × 1280 and `4-cover-coastal-classic.jpg` at 1080 × 1080. `2-studio-editor.jpg` is the live studio at 1280 × 800, with the Photo → GTA paint Before/After split, the eight-photo gallery and all three export buttons.
- **Smaller, all-original code.** App source is 127.2 KiB in v5 (133.7 KiB of dossier source text in v6), well under the dossier's 160 KiB text cap, so the judge's dossier carries every file whole; `main.ts` refuses to write a dossier whose source was cut. The first load (HTML, CSS, `app.js`, `layouts.js`, `editor-state.js`, `looks.js`) is 21.3 KiB gzipped; the renderer, photo framing, demos, exporter and showcase load with `import()`.

## Layout of `app/js`

| File | Role |
| --- | --- |
| `app.js` | Studio wiring: rails, gestures, history, views, export, boot |
| `looks.js` | Six looks, the ink-and-paint recipe, lettering choices, edition names (data only) |
| `layouts.js` | Nine panel layouts, their title zones and the auto-slice panel roles |
| `editor-state.js` | State, sources, photo mode, title transform, stickers, swap, undo/redo |
| `demos.js` | The demo covers behind `?demo=` links and the screenshots |
| `filters.js` | The paint engine: bilateral, eight-region Kuwahara, XDoG ink, clarity, cel, gradient map, rim light, halftone, grain |
| `canvas-renderer.js` | Subject-aware crops, panel textures, gutters, keyline, light FX, live Before / After |
| `lettering.js` | Title finishes and transform, subtitle ribbon, platform band, seal, age plate, barcode |
| `photo-subjects.js` | Measured boxes for the eight shipped photos, a subject detector and a detail finder |
| `exporter.js`, `showcase.js` (+ `showcase.css`) | Lazy: exact-size PNG/JPG export with measured pixel size, 3D box case and showcase |

URL presets: `?demo=cover|neon|coast|heat`, plus `layout=`, `size=`, `grade=`, `panel=N`, `mode=slice`, `before=0.5`, `view=box|showcase` and `shot=export`. The eight sample photos are the kit's model-made starter images (no real person).

## Run it

```sh
node serve.ts                                  # app/ on http://localhost:8080
PORT=8095 node serve.ts                       # same app on another port
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # stage app/ + screenshots/ and write dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=0fhdkvxa&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
