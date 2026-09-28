# lab/video — a vertical clip of one book's covers

Julian, 2026-09-27: „lass einen agenten das video aus 5.5 im lab bauen". ROADMAP 5.5, plan in [docs/plans/PLAN-struktur.md](../../docs/plans/PLAN-struktur.md) §4. **Generate yes, post by hand**: nothing here uploads anything, and the rights question of 5.5 (covers in a clip on someone else's platform) is open until Julian answers it.

**Status (2026-09-27): built; third version in the site's design language with calm, in-place motion (dissolves, no travel); Dune and Gatsby rendered as frame sequences, stills and animated previews — no MP4 yet, because ffmpeg is not installed on this machine.** `brew install ffmpeg`, then run `encode.sh` in each output folder and the MP4 follows; the numbers below say what is still unmeasured.

```bash
npx tsx lab/video/render.ts OL893414W                          # Dune, 30 covers, 20 s
npx tsx lab/video/render.ts OL468431W --count 30 --seconds 15  # the literal „30 in 15" (faster beat)
npx tsx lab/video/render.ts OL893414W --lang de --count 20     # only German editions
# flags: --fps 30, --max-records 1500, --preview false, --preview-fps 15, --preview-width 360
```

Output in `lab/video/out/<workId>[-<lang>]/` (git-ignored): `frames/NNNN.jpg` (every frame, 1080 × 1920, JPEG q90), `stills/` (full-size PNGs of six key moments: title, first cover, a dissolve, the wall filling, the wall, the end card), `encode.sh`, `preview.webp` (animated, 360 px wide at 15 fps, opens in any browser), `report.json` (the measurements), and `<workId>.mp4` (H.264, yuv420p, CRF 20, no audio) when ffmpeg is on the PATH. Caches: work data and cover images in `lab/video/out/cache/`, the site's fonts as TTF in `lab/video/out/fonts/`.

**Needs:** Python 3 with Pillow and fontTools+brotli for the text (`text.py`; present on Julian's machine), and a `.next` folder in the worktree or the main checkout, i.e. one `npm run dev` or `npm run build`, so next/font has fetched Fraunces and Geist. Without them the text falls back to Georgia/Helvetica and the report says `"fonts": "system"`.

## The question

Can a 15-second clip of a book's covers for Instagram or TikTok („30 Cover von *Dune* in 15 Sekunden") be built from the data alone, with no hand work between the work id and the file?

## Measure

- **Distinct designs**: no artwork twice (the wall's folding plus the game's `sameJacket`), no scanned inside page, no plain title page, no image too small to show large.
- **Covers per second** that can still be read. The default is now **20 s, not 15**: 30 covers plus a title card, the closing wall and an end card left 0.3 s per cover at 15 s. At 20 s a cover stays 0.8 s at the start and 0.3 s at the end, 2.1 per second on average; `--seconds 15` gives the literal version. Whether it reads on a phone is still to be judged on the MP4.
- **Render time** under a minute for *Dune* (PLAN-struktur §4). Met by the first version (32 stills, 30 s); the second draws all 600 frames and takes 95 s warm.
- **File size** of the MP4 (Instagram and TikTok take up to several hundred MB; a clip should be a few MB).
- **Zero Google requests**, counted rather than promised.

## How it works

- `storyboard.ts` — **pure**, tested in `__tests__/storyboard.test.ts` (24 tests, Gatsby fixtures and inline data, no network).
  - *Which covers.* The wall's rules first — `foldDuplicateCovers`, `looksLikeScannedPage` — so the clip never disagrees with the site about what one design is. Then the clip's own, which are a choice of thirty and not a verdict on any cover: the game's `sameJacket` (lib/hotornot/pool.ts) folds the same artwork across printings, which the wall keeps apart on purpose; the game's `looksPlain` drops a title on plain paper or a bare binding; a spread (wider than 0.9 of its height) goes; an L image under 300 px goes while enough others remain. Of a `sameJacket` group the earliest printing with a large enough image is shown. The size and tone rules need the L image, so they apply to covers `render.ts` has measured (`measures`).
  - *Caption.* Year and publisher of the earliest edition that carries **the image shown** — a folded scan lends its year only when the shown image has no dated edition.
  - *Order and pick.* By year; with more designs than `count`, spread evenly over the years, undated only to fill up.
  - *Rhythm.* Title card 1.6 s; covers that start slow and accelerate (`accel` 3: the first stays three times as long as the last — 0.8 s down to 0.3 s at the defaults); the wall of every cover shown 2.6 s; end card 1.8 s. Frames are split by largest remainder and always sum to `seconds × fps`. Each cover dissolves in over about 40 % of its shot, never under 0.15 s (it would flicker) and never the whole shot; the shortest shot is therefore 0.2 s; the wall has a stagger and a fade time per tile; `gridLayout` picks the column count (3–8) that gives the largest 2:3 tiles.
- `render.ts` — **I/O**. Open Library's work and edition pages one after another; signatures from the built index (`lib/coverindex.ts`) or the M image hashed with colour; then **choose and measure**: the chosen covers' L images are fetched and measured (width, height, mean, contrast, saturation), rejected ones free their slot, and the choice is made again until nothing new is chosen (5 rounds for Dune, 8 for Gatsby). The fetch gate refuses googleapis.com/google.com, counts requests per host, one request at a time per host, ≥ 1.1 s between openlibrary.org calls, ≥ 0.3 s between covers.
- `text.py` — every line of text in one run, in the **site's own font files**: next/font's self-hosted Fraunces and Geist WOFF2 from `.next/**/static/media`, found by their name table, converted to TTF once, with the axes set the site uses (display: Fraunces opsz 72, weight 500 like `h1`; wordmark: Fraunces italic; body: Geist 400, kicker Geist 500 with 0.12 em tracking). Python because sharp's text on macOS goes through CoreText, which ignores a font file handed to it — every attempt came out in Helvetica. Lines outside the latin subset (Cyrillic publishers) fall back to Arial Unicode.
- `frames.ts` — draws the frames, light theme from `app/globals.css`: `--bg` #f4f0e8, ink #1a1714 / #5a534a / #746c62, `--line`, the terracotta `--accent` #945138 once per frame (the timeline dot, the title rule, the URL). Header row as `SiteHeader`: italic wordmark left, a hairline under it, the counter „07 / 30" right. Book title in the display serif, author in ink-3. Covers as cards with `rounded-card` corners and the two-part `cover-shadow`, scaled ×2.5. At the foot a timeline from the first to the last year with a tick per cover and the dot travelling to each cover's year.
  - Motion, **in place, nothing travels** (third version): title lines fade in one after another and an accent rule draws out from the centre; a crossfade to the first cover; each next cover **dissolves in where the current one stands**, growing from 98 % to 100 % with its shadow coming up, then drifts on by 1.5 % over the shot; the caption changes in two halves (the old one fades out, then the new one fades in — two captions dissolving through each other read as a smudge), the counter likewise, and the timeline dot fades out at the old year and in at the new one instead of sliding; at the end the last cover dissolves away and the wall fills in place, each tile fading in, tile by tile; the end card (wordmark, „Covers, side by side.", a rule, beautifulcovers.vercel.app in the accent, „Covers from Open Library") crossfades in.

## What came of it

### Third version (2026-09-27): calm, in place

Julian on the second version: „beim überarbeiteten clip stört mich, dass die animation seitwärts ist. das ist zu unruhig für das menschliche auge". The carousel push, the rising text, the travelling timeline dot and the cover flying into the wall are all gone; every change is a dissolve where things stand (see „How it works"). The push-in was reduced from 3 % to 1.5 % so that it reads as stillness rather than motion. Dissolves are at least 0.15 s (5 frames at 30 fps), which also raised the shortest shot to 0.2 s + one standing frame.

| | *Dune* | *Gatsby* |
|---|---|---|
| Frames / time to draw them | 600 / 120 s | 600 / 121 s |
| Total (warm caches) | 125 s | 128 s |
| JPEG frames / preview WebP (360 px, 15 fps) | 84 MB / **2.3 MB** | 94 MB / **2.8 MB** |
| Google requests | 0 | 0 |

Choice of covers unchanged from the second version (same 30 per book). Drawing is ~30 % slower than with the push, because a dissolve composites two faded full-size cards per frame.


### Second version (2026-09-27, after Julian looked at the Dune preview)

Julian: „schau ob man die design-sprache des videos noch verbessern kann und mehr an die website anlehnt. außerdem vllt übergänge oder so. irgendwas fehlt noch".

| | *Dune* OL893414W | *The Great Gatsby* OL468431W |
|---|---|---|
| Designs after the wall's folding → eligible for the clip | 83 → 49 | 280 → 208 |
| Left out: same artwork / plain / spread / under 300 px | 15 / 2 / 1 / 16 | 53 / 2 / 2 / 15 |
| L images measured, rounds | 69, 5 | 94, 8 |
| Shown, years | 30, 1965–2021 | 30, 1925–2026 |
| First / last cover on screen, average | 0.8 s / 0.3 s, 2.1 covers/s | the same |
| Smallest / median L width shown | 303 / 323 px | 301 / 324 px |
| **Google requests** | **0** | **0** |
| Frames, time to draw them | 600 in 91 s (0.15 s each) | 600 in 91 s |
| Total, warm / with fetching | 95 s / — | — / 166 s (72 s fetching and measuring 84 L images) |
| 600 JPEG frames / preview WebP (360 px, 15 fps) | 89 MB / **2.5 MB** | 99 MB / **3.0 MB** |
| Fonts | site (Fraunces, Geist) | site |

- **What changed on the screen:** see „How it works". Stills of every key moment are in `out/<id>/stills/`.
- **Fixed from the first version:** the repeated Ace jacket and the film poster are one slot each now (`sameJacket`), the red binding and the title page are gone (`looksPlain`), and no cover under 300 px is shown — the 114 px one included. The first *Dune* frame had said „1965 · Chilton Books" under a 1970s Berkley paperback, because a design was dated by its earliest folded scan; now it is dated by the image shown.
- **One *Dune* run took 1,002 s** instead of 95 s: the Mac slept during it. The 95 s is the undisturbed measurement.
- **What the data still gets wrong:** Gatsby's first cover is Alvin Lustig's New Classics jacket (1940s) captioned **1925**, because the edition record at Open Library carries the year of first publication. And a *Dune Messiah* cover sits in *Dune*'s wall, because Open Library filed that edition under this work. Both are catalogue errors the clip shows as they are; the site shows them too.
- **Not measured yet:** the MP4 (size, encode time) and how it plays on a phone — the WebP preview is 360 px at 15 fps and drops half the frames, so the pushes look choppier there than they will in the video.

### First version (2026-09-27, morning)

Frames only, one still per shot on #141414, Georgia/Helvetica captions, 0.4 s per cover on an even beat, no transitions. *Dune* 30 s cold, *Gatsby* 196 s cold / 8 s warm, zero Google. Looked at, it showed the weaknesses the second version fixes: the same Ace jacket three times, the film poster twice, a plain red binding and a title page, a 114 px image blown up 7.5×.
