# lab/mosaic — a giant mosaic: one picture built from a book's covers

Julian, 2026-09-08: "Riesenmosaik. Wir schauen, ob wir ein schemenhaftes Motiv, das zu einem Bild passt, aus den verschiedenen Covern eines Buches bauen können. Schönes Bild für Instagram oder Pinterest." Roadmap 5.5.

**Status: it works.** Built and measured on 2026-09-08 — the numbers and what they cost are in "What came of it" at the end. Nothing has been posted anywhere, and the rights question below is still open.

```bash
npx tsx lab/mosaic/render.ts --work OL1168083W \
  --target "https://commons.wikimedia.org/wiki/Special:FilePath/George_Orwell_press_photo.jpg" \
  --cols 48 --colour-weight 0.15 --width 1600 --out lab/mosaic/out/orwell.png
node lab/mosaic/preview.mjs lab/mosaic/out/orwell.png lab/mosaic/out/preview.png 360
```

## The question

Can the covers of one book, used as tiles, be assembled into a picture that reads as a recognisable motif from a distance — and does the result look good enough to post? The motif is meant to be **shadowy** (schemenhaft): a face, a silhouette, the book's own best-known jacket, emerging from a wall of its editions.

## What we already have

- **The tiles.** A work's covers with a signature per cover (`lib/imagehash.ts`: dHash, contrast, mean luminance; hue histogram and saturation are being added under 6.10). Counts after folding: *The Great Gatsby* 293, *Nineteen Eighty-Four* 226, *Beloved* 72 (SPEC §7). A portrait mosaic of 24 × 36 cells has 864 cells, so each cover appears three to twelve times — normal for a photomosaic, and the repetition is part of the look.
- **The decoders.** `jpeg-js` and `pngjs` are already dependencies; `pngjs` can also write. No ffmpeg, no new packages.
- **The loader.** `getWorkDetail` from `lib/work.ts` with `googleBooks: false` (rule 6), `fetchBytes` from `lib/sources/http.ts` for the images, `foldDuplicateCovers` so a motif is one tile, not seven.

## Approach

Classic photomosaic, in two files, because only one of them can be tested:

- `mosaic.ts` — **pure.** Input: the target picture as a grid of cells with mean colour, the tiles with their signatures, options (grid size, how far apart two uses of the same cover must be). Output: the assignment, one cover id per cell. Distance is luminance first and, once 6.10 lands, hue and saturation; a penalty keeps the same cover from sitting next to itself. **Test** with synthetic data: a horizontal gradient as target and tiles of known luminance must give a monotonic assignment; the reuse penalty must hold; a cell with no close tile must still get one, never a hole.
- `render.ts` — **I/O.** Loads the covers, scales each to the cell size (box filter, in code — no library needed at 45 × 68 px), writes the composition as PNG. Optionally blends the target picture over the result at a chosen opacity. **That blend is the usual cheat** in photomosaics, and it is where the honesty question lives: a mosaic that needs 50 % of the original on top is not a mosaic. The measure below caps it.

Output formats: Pinterest 1000 × 1500 (2 : 3), Instagram 1080 × 1350 (4 : 5). Covers are 2 : 3, so the cell grid is chosen per format.

## The target picture

Two candidates, and the choice is not technical:

1. **The book's own best-known cover**, picked by hand or as the motif behind the most ISBNs. Self-referential and pleasing, but the target is itself a copyrighted jacket.
2. **A public-domain portrait of the author** (Wikimedia Commons: Orwell, Fitzgerald, Melville, Kafka). Rights-clean as a target; the tiles remain what they are on the site.

Either way the poster is a derivative of the cover images, and posting it is distribution on another platform — the same rights question the clip has (ROADMAP 5.5), to be answered before anything is posted. Building it is fine.

## Measure

1. **Recognition.** Shown at 300 px wide without being told what it is, a person names the motif — with the target blended in at **no more than 25 %**. Below that, the tiles carry the picture; above it, the picture carries the tiles.
2. **Variety.** No cover appears twice within a 3 × 3 neighbourhood, and the most-used cover holds less than 5 % of the cells.
3. **Cost.** One render under 30 seconds for 1,000 cells, all images from the 30-day cache, zero Google requests.
4. **Looks.** Julian wants to post it. That is the only measure that matters and the only one that cannot be automated.

## What came of it (2026-09-08)

Built as planned: `mosaic.ts` is pure with 15 tests on synthetic pictures, `render.ts` does the loading and the drawing. Measured on *Nineteen Eighty-Four* (OL1168083W), 278 covers on record, **224 designs after folding, 222 tiles** once scanned pages are dropped.

| Measure | Asked for | Got |
|---|---|---|
| Recognition | a motif at no more than 25 % blend | a face at **0 % blend**, still readable shrunk to 150 px wide |
| Variety | most-used cover under 5 % of cells | **0.8 %**; 175 of 222 covers used; **no** cell had to repeat a neighbour |
| Cost | under 30 s for 1,000 cells | **12 s** for 2,064 cells with the image cache warm, 40 s cold; 6 Open Library requests, **zero Google** |
| Looks | Julian wants to post it | his call |

**Two things were wrong in the plan and are fixed in the code.**

1. **The target must be picked by contrast, not by how many editions carry it.** The best-known jacket of *1984* spans luminance 57.5 to 90.2 of 255 — nearly flat. A mosaic of it is a handsome wall of covers with no motif in it whatsoever, which is exactly what the first render produced. `--target auto` now takes the most contrasted jacket instead.
2. **The grid must follow the target's shape.** A square grid of 2:3 cells over a 3:4 portrait stretched the head by half. Rows are now worked out from the target unless `--rows` says otherwise.

**Three findings for whoever picks the next picture.**

- **A photograph gives a face; a jacket gives a poster.** With the Orwell press photo the eyes, moustache and collar all come through. With the book's own most contrasted jacket the result is blocks of orange and black — pretty, and plausibly the better Pinterest image, but it has no subject, because a jacket is already a graphic design rather than a picture of something.
- **The palette reaches further than expected, but only relatively.** The covers span luminance 14.7 to 243.4, so against the photograph just 2.6 % of cells were out of reach even before stretching. Against the high-contrast jacket, which uses true black and true white, 54.8 % of cells were out of reach as measured and 0 % after stretching — that is the whole value of comparing relative brightness rather than absolute.
- **A grey target wants `--colour-weight` near 0.15.** The default 0.6 is for a target that has its own colours; on a black-and-white photograph it makes saturated covers expensive and the motif goes muddy.

## Still open

- A **silhouette** rather than a photograph: fewer mid-tones should read better at 40 cells across. Untried.
- The **lower bound on the palette**: *Beloved* has 72 covers to *1984*'s 222. At what point does a book stop being able to carry a picture? `paletteReport` answers it per book without rendering anything.
- **Whether 6.10's colour signature helps.** It was not needed: mean RGB per sub-cell, measured here, is a different and better-suited measure than a hue histogram. Nothing to do unless a colour target proves otherwise.
- **The rights question**, before anything is posted anywhere.
