# lab/mosaic — a giant mosaic: one picture built from a book's covers

Julian, 2026-09-08: "Riesenmosaik. Wir schauen, ob wir ein schemenhaftes Motiv, das zu einem Bild passt, aus den verschiedenen Covern eines Buches bauen können. Schönes Bild für Instagram oder Pinterest." Roadmap 5.5. **Status: not started.**

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

## Order

1. `mosaic.ts` with its test (synthetic data, no network) — half a day.
2. `render.ts`, first run on *Nineteen Eighty-Four* against Orwell's portrait — half a day.
3. Measure 1–3, put the numbers here, then decide about 6.10's colour signature (luminance alone may be enough for a shadowy motif; that is worth knowing before adding colour).
