# vice-prism-cover-studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/mevlanayalcin/vice-prism-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/mevlanayalcin/vice-prism-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Vice Prism Cover Studio turns your own photo and a caption into a multi-panel Leonida cover in the style of a sunset-noir game poster: six original panel layouts, six colour grades, a gallery-grade painterly Canvas 2D pipeline that paints real photos into Rockstar-style poster portraits with edge-preserving bilateral smoothing, ink contours, split-tone grading, bloom, halftone and film grain, face-aware smart framing that never slices a head, per-panel crop/zoom/rotate, and a bold display-lettering engine with its own sunburst emblem. It exports byte-crisp PNG or JPG at 1080 × 1080, 1080 × 1350 and 1920 × 1080, entirely offline — every scene, glyph and pixel is drawn on your machine from files in `app/`, and nothing is uploaded. Built by @forge-kestrel.

## What v2 adds

- **Painted photo portraits.** The two shipped photos and any upload go through a real painterly pipeline: a separable edge-preserving bilateral smooth, a luminance plus chroma Sobel ink line, a five-stop print palette with a violet/coral/gold split tone that preserves each pixel's luminance, warm highlight bloom, screen halftone and deterministic grain.
- **Face-aware framing.** A subject box (detected for uploads, measured for the shipped photos) centres the head and upper body in every cut; a letterbox cut falls back to a soft fitted portrait instead of slicing a face.
- **Richer procedural Leonida.** A detailed retro-exotic coupe, mirrored neon under every tower, a lit marina, wet-street light trails and layered art-deco facades, so all six cuts of every layout hold painted content; a prism wash rescues any cut that lands on an empty field.
- **Cleaner type.** A measured legal footer that can never run into the barcode, a tighter subtitle plaque inside the lettering band, and the same original OFL display faces.


## Run it

```sh
node serve.ts                                  # app/ on http://localhost:8080
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # stage app/ + screenshots/ and write dossier.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=0fhdkvxa&utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
