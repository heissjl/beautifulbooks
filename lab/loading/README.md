# lab/loading — the giant mosaic as the search's loading screen

Julian, 2026-09-09: „wenn man einen buchtitel sucht wird statt der wavenden Startseite ein riesenmosaik eingeblendet, wie das von Orwell. Dazu sollten mehrere solcher Mosaike existieren, damit man rotieren kann zwischen denen bei verschiedenen Anfragen. Aber der Ladebildschirm soll animiert sein, also den Prozess zeigen, wie das Konterfei aus den Titeln aufgebaut wird." Roadmap 6.19a, and Julian's own limit from 2026-09-08: **„es darf clientseitig nicht zu ressourcenverbrauchend sein."**

**Status: three animations built and measured on 2026-09-09, on a second author (Mark Twain).** Which one goes on the site is Julian's choice; the rights question from 5.5 is still unanswered, and until it is, nothing here reaches the website.

```bash
# build a mosaic and its manifest (Open Library only, zero Google requests)
npx tsx lab/loading/build.ts --author "mark twain" \
  --target "https://commons.wikimedia.org/wiki/Special:FilePath/Mark_Twain_by_AF_Bradley.jpg?width=1200" \
  --credit "A. F. Bradley, New York 1907 — public domain"

# the three proposals, moving, with their cost under each
npx tsx lab/loading/serve.ts        # http://localhost:4323

# the same three as stills, five moments each, without a browser
npx tsx lab/loading/filmstrip.ts --id mark-twain --grid 1 --size 1
```

## The question

A search waits 1 to 13 seconds on Open Library (ROADMAP 2.6). `lab/mosaic` can build a recognisable author's face out of a few hundred covers. Can that face be **assembled in front of the reader**, as the wait, without the client paying for hundreds of images — and does it still look right when the search comes back after 1.2 seconds and cuts the animation in half?

## What is shipped, and what is not

**One JPEG and a small manifest. Nothing else, and no cover is loaded on its own.** The picture is computed offline by `build.ts`; the browser fetches it once, and every animation is a different way of drawing *the same file*, cell by cell, onto a canvas or of moving it under a mask.

- `orders.ts` — pure, tested: the order the cells are filled in, the shuffle, the packing. This is the whole content of an animation and the only part that can be tested without a browser.
- `build.ts` — I/O: loads the covers through `lab/mosaic/covers.ts` (the same rules the poster uses — primary author only, study guides out, folded covers, `googleBooks: false`), assigns them with `lab/mosaic/mosaic.ts`, and writes `<id>.json` plus one JPEG per size.
- `index.html` + `serve.ts` — the three proposals side by side, with a scrubber, an interrupt button and the measured cost under each.
- `filmstrip.ts` — the same three as a contact sheet, so they can be judged without starting anything.
- `out/index.json` — **the rotation**: every mosaic built so far. A search picks one.

## The three proposals

Built on Mark Twain: 897 covers from his eight most-printed books, over A. F. Bradley's 1907 portrait (public domain). The filmstrip is `out/mark-twain-filmstrip.png` — rows in this order, columns at 10, 30, 50, 75 and 100 per cent.

### 1. Rückzug — the camera pulls back

Four covers fill the frame, then sixteen, then the whole picture; in the last third the wall turns into a face. One `<img>`, one transform, **no work at all per frame** — the compositor runs it. Scale falls geometrically rather than linearly, or three quarters of the time is spent in the last, least interesting doubling.

*Says:* a mosaic is a question of distance. *Interrupted:* always a full frame of covers, never a hole — but if it is cut before 60 % there was no face, only a wall. *Costs:* nothing beyond the image.

### 2. Schwerste Zelle zuerst — the assignment's own order

The cells arrive in the order `mosaic.ts` filled them: furthest from the average brightness first, so the darkest and lightest cells come before the mid-tones. The head and the shoulders stand there as a shadow at 30 %, and the face is readable at 50 %, while half the frame is still empty.

*Says:* this is how the picture was chosen — it replays a real step, not a decoration. *Interrupted:* looks unfinished, because it is; below 40 % it is a fragment on an empty ground. *Costs:* 0.16 ms of JS per frame at 1,480 cells.

### 3. Umsortieren — the wall sorts itself out

The wall is complete from the first frame but in the **wrong** order — every cell holds another cell's cover, which is roughly what the search shows today — and dimmed. Then a diagonal front sweeps across it, each cell swapping to its own cover at full brightness with a short flash where it lands, and the face condenses out of the noise.

*Says:* the same covers in a different order — that is the whole trick of a mosaic. *Interrupted:* **the only one that looks finished at every moment**, because the frame is never empty. *Costs:* 0.16 ms of JS per frame, plus one 2.1 ms frame at the start for the scrambled wall.

## Measured, 2026-09-09

Mark Twain, 897 tiles, grid 40 × 37 = 1,480 cells, 480 px image, in the Browser pane on this Mac (**not** on a phone — the numbers below are a floor, not a promise).

| | |
|---|---|
| The file | **105 KB** as JPEG q60 at 480 px, 223 KB at 720, 356 KB at 960 |
| The same picture as PNG | 750 KB / 1,655 KB / 2,865 KB — **seven times** the JPEG |
| As WebP (q70, from the JPEG) | 81 KB, **12 % less**; a mosaic is high-entropy noise, so no format saves much |
| Manifest | 20 KB for two grids and two orders each; **one grid alone would be 14 KB** |
| Fetch + decode | 19 ms for 223 KB |
| Per frame | **0.16 ms** of JS, at 53 to 92 `drawImage` calls; worst single frame 2.1 ms (proposal 3's opening wall) |
| DOM | **3 nodes** for all three panels — one `<img>` and two `<canvas>` |
| Build | 17 s for two grids and six JPEGs with the cover cache warm, **zero Google requests** |

## Six things that were not obvious

1. **40 columns, not 24.** At 24 columns a cell is comfortably a book you can recognise — and the face is nearly gone. At 40 both just work. This is the whole trade-off of the thing and it has one answer per picture, not one answer in general.
2. **The background decides which half of the picture you see first.** Proposal 2 fills the extremes, and only the extreme that contrasts with the ground is visible: on the site's light surface the dark cells arrive first, which for a portrait is the good half (hair, eyes, shoulders). In dark mode it inverts and the highlights come first. Neither is wrong, but it is not the same animation.
3. **A scrambled wall of covers and a sorted one look alike.** Proposal 3 was invisible in its first version: the sweep changed nothing the eye could find until the picture was nearly complete. Dimming what is not yet sorted gives the front a line, and costs one `fillRect`.
4. **A second author is not interchangeable.** Same grid, same settings: Twain sits at a mean distance of 470, Virginia Woolf at 861, and her face barely reads at loading-screen size. Two reasons, both worth knowing before picking the next one — Twain's eight books gave **897** covers to Woolf's **335**, and Bradley's photograph has true black and true white where Beresford's 1902 portrait is soft all through. **A loading screen needs more contrast than a poster does**, because it is small and it is over in seconds.
5. **Precomputing the orders costs more than it saves.** Each order is two bytes per cell, 3.9 KB at this grid; computing it in the browser from the 2 KB luminance map takes **0.92 ms, once**. The site should ship `lum` and sort — `orders.ts` is the function it would use.
6. **A hidden browser pane runs no animation frames.** `requestAnimationFrame` never fires while the pane is hidden, which made all three animations look broken when they were not. The page therefore has a scrubber that renders any moment deterministically, which is also what makes two proposals comparable at all.

## The recommendation

**Proposal 3 for the search**, because the criterion that matters is not how it ends but how it looks when it is cut: the most common wait is one or two seconds, and only proposal 3 shows a full frame at every moment. Proposal 1 is second and cheapest. Proposal 2 is the one that explains the most and the one that looks most unfinished early; it belongs where a wait is known to be long, or on the About page, where nobody is interrupted.

On a wait longer than the animation: hold the finished picture, or start the next mosaic from `out/index.json` — which is the rotation doing double duty as the loop.

## Still open

- **The rights question from 5.5**, unchanged and prior to everything: showing someone's cover is one thing, a derived work built out of hundreds of them as a page element is another. Nothing here goes on the site before that is answered.
- **N12: a loading screen must not look like an answer.** A large portrait of Mark Twain while somebody searches for *East of Eden* is a picture with a subject, and the current `AssemblingWall` is deliberately small, dimmed and unlabelled for exactly that reason. Size, dimming and a caption that names what the picture is are a design decision, not a detail.
- **Measure it on a phone**, on the mid-range Android that everything else on this site was measured on. 0.16 ms per frame on a Mac says little about a phone that also has a search in flight.
- **How many mosaics the rotation needs**, and whether they should follow the query (an author's own face when their book is searched for) rather than being random. Following the query would mean building a mosaic per curated author, which is 30 s and 8 Open Library searches each.
- **A silhouette instead of a photograph** (still open from `lab/mosaic` too) — fewer mid-tones should survive 40 columns better.
