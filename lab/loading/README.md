# lab/loading — the giant mosaic as the search's loading screen

Julian, 2026-09-09: „wenn man einen buchtitel sucht wird statt der wavenden Startseite ein riesenmosaik eingeblendet, wie das von Orwell. Dazu sollten mehrere solcher Mosaike existieren, damit man rotieren kann zwischen denen bei verschiedenen Anfragen. Aber der Ladebildschirm soll animiert sein, also den Prozess zeigen, wie das Konterfei aus den Titeln aufgebaut wird." Roadmap 6.19a, and Julian's own limit from 2026-09-08: **„es darf clientseitig nicht zu ressourcenverbrauchend sein."**

**Status, 2026-09-09: four animations built and measured, 3b chosen** (Julian: „3b ist perfekt so"), **and a rotation of twenty templates built with it.** The rights question from 5.5 is still unanswered, and until it is, nothing here reaches the website.

```bash
npx tsx lab/loading/portraits.ts       # find each author's public-domain portrait (Wikidata + Commons)
npx tsx lab/loading/portrait-sheet.ts  # look at all twenty, with the frame each is built from
npx tsx lab/loading/build-all.ts     # build the rotation from templates.json (Open Library only, zero Google)
npx tsx lab/loading/sheet.ts         # all twenty on one contact sheet
npx tsx lab/loading/serve.ts         # http://localhost:4323 — /rotation.html and /index.html

# one template on its own, or one setting tried out
npx tsx lab/loading/build.ts --author "mark twain" --target <portrait url> --cols 40 --width 480
# the four proposals as stills, five moments each, without a browser
npx tsx lab/loading/filmstrip.ts --id mark-twain
```

| File | What it is |
|---|---|
| `templates.json` | the twenty of the rotation and eleven in reserve — **committed**; the pictures are not |
| `portraits.ts` | Wikidata `P18` and Commons' licence field, per author |
| `portrait-sheet.ts` | the twenty portraits with their frames drawn on — **the step that cannot be automated** |
| `orders.ts` | pure, tested: the fill orders and the shuffle |
| `template.ts` | building one picture: covers, target, grid, files, manifest |
| `build-all.ts` | the rotation, and **the settings it is all built with** |
| `animations.js` | the four animations, shared by both pages so 3b cannot drift |
| `rotation.html` | the loading screen as it would be: phone frame, desktop frame, a search that cuts it off |
| `index.html` | the four proposals side by side, with a scrubber |
| `sheet.ts`, `filmstrip.ts` | contact sheets, for judging without a browser |

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

*Says:* the same covers in a different order — that is the whole trick of a mosaic. *Interrupted:* never an empty frame. *Costs:* 0.16 ms of JS per frame, plus one 2.1 ms frame at the start for the scrambled wall.

### 3b. Das Rauschen klärt sich — no front at all

Julian, 2026-09-09: „weniger Kante im Effekt, sondern ein langsames Klären des Rauschens." The same scrambled wall, but the cells find their place in **random** order and the dimming lifts as the wait goes on. Nothing travels across the picture; it only gets clearer, the way a print comes up in a developing bath.

Two things make it work. **Cells resolve fastest at the beginning** (`1 - (1 - p)²`): at a flat rate the first third looks identical to the frame before it, and the first seconds are exactly where the reader is. And an **off-screen canvas** holds the true state of the wall while the visible one is that plus the dimming — otherwise lifting the dim would mean redrawing 1,480 cells a frame instead of one image.

*Says:* the same thing 3 says, without a gesture. *Interrupted:* **the best of the four** — a full frame at every moment, and no half-finished sweep frozen across it. *Costs:* 0.29 ms of JS per frame, the most of the four and still under 2 % of a frame's budget; the extra is the longer per-tile fade and the one full-canvas draw.

## The rotation: twenty templates

Julian, 2026-09-09: „baue damit 20 Vorlagen, die als Ladebildschirm verwendet werden können, nimm Rücksicht auf die anderen Bedingungen bei mobile und desktop und darauf dass es schnell und flüssig bleiben muss und wenig Traffic produzieren sollte."

**`templates.json` is committed; the pictures are not.** A build is one command and the covers are cached on disk, so 4 MB of derived cover images have no business in the repository while the rights question from 5.5 is open. What is committed is the recipe: twenty authors, the Wikidata item each portrait comes from, its licence, and the frame it is cut to. Eleven more sit in the same file as reserves, and four were dropped because their portrait on Commons is smaller than 500 px (Kafka, Dickinson, Brontë, Chekhov — all four are famous pictures and all four are thumbnails there).

### How the twenty were chosen

1. **A public-domain portrait.** Guessing file names on Commons does not work: of 26 plausible names tried by hand, two existed. `portraits.ts` goes through Wikidata instead — the author's item, its `P18`, and Commons' own licence field — and refuses anything not marked public domain. The tiles are still the open rights question from 5.5; the target picture at least is settled.
2. **A photograph, not a painting**, wherever there was a choice: measured on 2026-09-08 in `lab/mosaic`, a photograph gives a face and a jacket gives a poster. Two painted portraits are in anyway (Mary Shelley, and Tolstoy is a colour photograph of 1908 that behaves like one).
3. **Enough editions.** Every one of the twenty has eight works whose primary author is that person, from 966 editions (Whitman) to 12,431 (Dickens).
4. **A head, not a garden.** This is the step that cannot be automated, and `portrait-sheet.ts` is how it was done: all twenty portraits on one sheet with the frame each is built from drawn on top. Nine of them are seated half-lengths whose head is a fifth of the picture; those got a `crop` by hand. Tolstoy is the extreme — seated among trees, his head a twentieth of the frame.

### What every one of them is built with

The settings live in `build-all.ts`, one place, each argued for where it stands:

| Setting | Why |
|---|---|
| **40 columns** | at 24 a cell is comfortably a book and the face is gone; at 40 both just work, measured from 200 to 440 px wide |
| **3:4, every picture** | the frame a search waits in must not change shape when the rotation turns, and the height can then be set before the file arrives |
| **480 and 640 px** | one is fetched, never both: 480 for a phone frame of about 260 px, 640 for a desktop frame of about 420 |
| **quality 50** | at 1:1 the difference to 65 is a slight softening for 25 % more bytes; at the size this is shown there is nothing in it |
| **colour weight 0.15** | these are grey photographs, and the default 0.6 makes saturated covers expensive and the motif muddy |

### Fast, smooth, and cheap — what that meant in practice

- **One request per search, not twenty.** The template is drawn once per session and kept in `sessionStorage`. Without that, nineteen searches out of twenty pull a file the browser has never seen, and a rotation of twenty is a rotation of twenty *downloads*.
- **A tolerance on the size choice.** `pickImage` accepts a file 20 % smaller than the screen asks for. A photograph would show that; a wall of cover thumbnails has no line in it that must stay straight. Without the tolerance a 260 px frame at two device pixels asks for 520 and gets the 640 px file — 60 % more bytes for pixels nobody can point at.
- **Two device pixels, never three.** Same reasoning, and it is the difference between 105 KB and 240 KB.
- **The frame is sized from the manifest, before the picture arrives** (`reserveFrame`): a cell is a cover, so the grid alone gives the shape. On a cold search the file takes two to four tenths of a second, and without this the page would reflow under a reader who is already waiting.
- **Preload on the first keystroke, not on submit.** Whoever never searches never fetches a mosaic.
- **`prefers-reduced-motion`** gets the finished picture, standing still.

### The twenty, measured

All twenty come out on the same grid, **40 × 36 = 1,440 cells**, because the 3:4 cut makes them the same shape — which is the point: the frame does not change when the rotation turns. Together they are **10,532 covers from 160 works**.

| | |
|---|---|
| On disk | **4.56 MB** for all forty files; 1.79 MB of that is the phone size, 2.78 MB the desktop one |
| A reader fetches **one** | **83–102 KB** on a phone, 124–159 KB on a desktop |
| Manifests | 18 KB each, 362 KB for all twenty — and **that is the one thing still worth shrinking** (see below) |
| Palette | 146 covers (Mary Shelley) to 1,368 (Dickens); the median is 435 |
| Build | **17 min** for twenty from cold, 3.8 min from the cover cache, **zero Google requests** |

The full table is what `build-all.ts` prints; the short version is that the palette size stops mattering surprisingly early. Mary Shelley's 146 covers carry a face; Dickens's 1,368 carry a better one, but not nine times better.

**What does not decide it is the fit.** Tolstoy's first portrait — Prokudin-Gorsky's colour photograph of 1908 — sat at a mean distance of **285, the second best of the twenty, and showed no face**: a soft old picture of a grey man against grey trees, and the mosaic fitted every grey of it perfectly. Swapping it for Sass's studio portrait of the 1880s, contrast 63 instead of 42, fixed it. But Whitman has the lowest contrast of all twenty (35.8) and reads perfectly, because his light and dark are in his beard and Tolstoy's were in a tree. **The number is a reason to look; it was right about one of five.**

## Measured, 2026-09-09

Mark Twain, 897 tiles, grid 40 × 37 = 1,480 cells, 480 px image, in the Browser pane on this Mac (**not** on a phone — the numbers below are a floor, not a promise).

| | |
|---|---|
| The file | **105 KB** as JPEG q60 at 480 px, 223 KB at 720, 356 KB at 960 |
| The same picture as PNG | 750 KB / 1,655 KB / 2,865 KB — **seven times** the JPEG |
| As WebP (q70, from the JPEG) | 81 KB, **12 % less**; a mosaic is high-entropy noise, so no format saves much |
| Manifest | 25 KB for two grids and three orders each; **one grid alone would be 18 KB**, and 2 KB if the browser sorts (see below) |
| Fetch + decode | 19 ms for 223 KB |
| Per frame | **0.16 ms** of JS for proposals 2 and 3 (53 to 92 `drawImage` calls), **0.29 ms** for 3b (up to 186); worst single frame 2.1 ms, proposal 3's opening wall |
| DOM | **4 nodes** for all four panels — one `<img>` and three `<canvas>` |
| Build | 17 s for two grids and six JPEGs with the cover cache warm, **zero Google requests** |

## Seven things that were not obvious

1. **40 columns, not 24.** At 24 columns a cell is comfortably a book you can recognise — and the face is nearly gone. At 40 both just work. This is the whole trade-off of the thing and it has one answer per picture, not one answer in general.
2. **The background decides which half of the picture you see first.** Proposal 2 fills the extremes, and only the extreme that contrasts with the ground is visible: on the site's light surface the dark cells arrive first, which for a portrait is the good half (hair, eyes, shoulders). In dark mode it inverts and the highlights come first. Neither is wrong, but it is not the same animation.
3. **A scrambled wall of covers and a sorted one look alike.** Proposal 3 was invisible in its first version: the sweep changed nothing the eye could find until the picture was nearly complete. Dimming what is not yet sorted gives the front a line, and costs one `fillRect`.
4. **A second author is not interchangeable.** Same grid, same settings: Twain sits at a mean distance of 470, Virginia Woolf at 861, and her face barely reads at loading-screen size. Two reasons, both worth knowing before picking the next one — Twain's eight books gave **897** covers to Woolf's **335**, and Bradley's photograph has true black and true white where Beresford's 1902 portrait is soft all through. **A loading screen needs more contrast than a poster does**, because it is small and it is over in seconds.
5. **A flat rate makes the first third of an animation look still.** With cells resolving at a constant rate, 3b's frames at 10 % and 30 % are hard to tell apart — and a search that comes back in 1.5 seconds never shows anything else. Easing the rate out puts the visible clearing where the reader is and leaves the rest as a settling. The same probably applies to proposals 2 and 3; it has not been tried on them.
6. **Precomputing the orders costs more than it saves.** Each order is two bytes per cell, 3.9 KB at this grid; computing it in the browser from the 2 KB luminance map takes **0.92 ms, once**. A manifest is 18 KB today and could be about 3: ship `lum`, and derive the three orders and the shuffle from it and a seed — `orders.ts` already is that function, and the shuffle is already seeded. The site would then fetch 3 KB of JSON and one 90 KB picture.
7. **A hidden browser pane runs no animation frames.** `requestAnimationFrame` never fires while the pane is hidden, which made all three animations look broken when they were not. The page therefore has a scrubber that renders any moment deterministically, which is also what makes two proposals comparable at all.

### What the set showed that one picture could not

Twenty pictures cannot be judged one at a time — `sheet.ts` puts them on one page, because the weakest is the one that decides what the site looks like. Three things only came out that way:

- **Every one of them has to be a head.** Nine of twenty needed a hand-set crop, and the one that was wrong was wrong in a way no number caught.
- **The set is more uniform than the numbers suggest.** Mean distance runs from 207 to 859 and the pictures do not vary nearly that much; the palette runs from 146 covers to 1,368 and, above roughly 300, the difference is decoration.
- **Colour is the thing that varies.** Twain, Dickens and Conrad come out in browns and greys; Poe sits in a field of red; Alcott in violet. Nothing in the assignment asks for that — it is what those particular books were printed with, which is a nice thing for a site about covers to be showing while it waits.

## The recommendation

**3b for the search.** The criterion that matters is not how an animation ends but how it looks when it is cut, and the most common wait is one or two seconds. 3 and 3b both keep the frame full; 3b is the quieter of the two, and it is the one that leaves nothing behind when it stops — a frozen diagonal front is an obvious half-finished thing, a slightly noisy picture is not. Proposal 1 is next and costs nothing per frame. Proposal 2 explains the most and looks most unfinished early; it belongs where a wait is known to be long, or on the About page, where nobody is interrupted.

On a wait longer than the animation: hold the finished picture, or start the next mosaic from `out/index.json` — which is the rotation doing double duty as the loop.

## Still open

- **The rights question from 5.5**, unchanged and prior to everything: showing someone's cover is one thing, a derived work built out of hundreds of them as a page element is another. Nothing here goes on the site before that is answered.
- **N12: a loading screen must not look like an answer.** A large portrait of Mark Twain while somebody searches for *East of Eden* is a picture with a subject, and the current `AssemblingWall` is deliberately small, dimmed and unlabelled for exactly that reason. Size, dimming and a caption that names what the picture is are a design decision, not a detail.
- **Measure it on a phone**, on the mid-range Android that everything else on this site was measured on. 0.19 ms per frame on a Mac says little about a phone that also has a search in flight. The first frames after a decode cost ten times the steady state (2–3 ms against 0.19), and that is the moment a phone would show it.
- **Shrink the manifest from 18 KB to about 3** by shipping the luminance map alone and deriving the orders in the browser (finding 6).
- **`--max-pages` was never tried below 12.** A build of twenty is 17 minutes and a few thousand Open Library requests, most of them edition pages; halving the page cap would halve both and cost some palette. Nobody has measured how much.
- **How many mosaics the rotation needs**, and whether they should follow the query (an author's own face when their book is searched for) rather than being random. Following the query would mean building a mosaic per curated author, which is 30 s and 8 Open Library searches each.
- **Whether 3b should follow the picture instead of chance.** Resolving the cells whose tone changes most first would bring the face up faster than a random order does, at the price of a faint structure in the clearing. Untried.
- **A silhouette instead of a photograph** (still open from `lab/mosaic` too) — fewer mid-tones should survive 40 columns better.
