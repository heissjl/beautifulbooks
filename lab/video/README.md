# lab/video — a vertical clip of one book's covers

Julian, 2026-09-27: „lass einen agenten das video aus 5.5 im lab bauen". ROADMAP 5.5, plan in [docs/plans/PLAN-struktur.md](../../docs/plans/PLAN-struktur.md) §4. **Generate yes, post by hand**: nothing here uploads anything, and the rights question of 5.5 (covers in a clip on someone else's platform) is open until Julian answers it.

**Status (2026-09-27): built, two example clips rendered as frame sequences and animated previews — no MP4 yet, because ffmpeg is not installed on this machine.** `brew install ffmpeg`, then run `encode.sh` in each output folder (or the render again) and the MP4 follows; the numbers below say what is still unmeasured.

```bash
npx tsx lab/video/render.ts OL893414W                          # Dune, 30 covers in 15 s
npx tsx lab/video/render.ts OL468431W --count 30 --seconds 15  # The Great Gatsby
npx tsx lab/video/render.ts OL893414W --lang de --count 20     # only German editions
# flags: --fps 30, --max-records 1500, --preview false (no WebP)
```

Output in `lab/video/out/<workId>[-<lang>]/` (git-ignored): `frames/NNN.png` (one 1080 × 1920 still per shot), `concat.txt` (ffmpeg concat list with each shot's duration), `encode.sh`, `preview.webp` (animated, half size, opens in any browser), `report.json` (the measurements), and `<workId>.mp4` (H.264, yuv420p, CRF 20, no audio) when ffmpeg is on the PATH. The cache — work data and cover images — is `lab/video/out/cache/`.

## The question

Can a 15-second clip of a book's covers for Instagram or TikTok („30 Cover von *Dune* in 15 Sekunden") be built from the data alone, with no hand work between the work id and the file?

## Measure

- **Distinct designs**: no jacket twice (the wall's folding), no scanned inside page.
- **Covers per second** that can still be read: 30 covers in 12 s of cover time is 2.5 per second, 0.4 s each.
- **Render time** under a minute for *Dune* (PLAN-struktur §4), cold and warm.
- **File size** of the MP4 (Instagram and TikTok take up to several hundred MB; a clip should be a few MB).
- **Zero Google requests**, counted rather than promised.

## How it works

- `storyboard.ts` — **pure**. From a work's editions, covers and signatures: fold (`foldDuplicateCovers` from `lib/works.ts`, the same four tiers as the wall), drop scanned pages (`looksLikeScannedPage`), date each design by the **earliest** edition that carries it (folded scans included), sort by year, and if there are more designs than `count`, **spread** the pick evenly over the years so a cap of 30 still spans 1965 to 2022 instead of stopping in 1985. Undated designs only fill up. Frames are split in whole numbers that sum exactly to `seconds × fps`; if `count` covers would each get less than `minShotSeconds` (0.25 s), fewer are shown. Title card „30 covers of / *Title* / Author · 1965–2022" — never „all" — and an end card with the site name and „Covers: Open Library". Tests: `__tests__/storyboard.test.ts`, on the Gatsby fixtures (three edition pages) and inline data.
- `render.ts` — **I/O**. Open Library's work (`getWork`) and edition pages (`getEditionsPage`) one after another, parsed and assembled with the site's own `parseEditions`/`assembleEditions`; signatures from the built index (`lib/coverindex.ts`, free) and, for the rest, the M-size image hashed here with colour (`signature(…, { colour: true })`) so both kinds fold alike; L-size images for the chosen covers; frames composed with **sharp** (added as a devDependency; it was already installed as Next's optional dependency) — cover fitted into 860 × 1290 on #141414 with a soft shadow, the title small above, „year · publisher" below.
- **The fetch gate** in `render.ts` replaces `globalThis.fetch` for the run: googleapis.com and google.com are **refused** with an error, every request is counted per host, and each host lane runs one request at a time — ≥ 1.1 s after the previous openlibrary.org call ended, ≥ 0.3 s between cover images. So the politeness also holds inside `getWork`, which can fan out.

## What came of it (2026-09-27)

| | *The Great Gatsby* OL468431W | *Dune* OL893414W |
|---|---|---|
| Edition records / with a cover / covers | 1,180 / 329 / 390 | 155 / 100 / 128 |
| Signatures from the index / hashed here | 198 / 192 | 127 / 1 |
| Designs after folding | 280 | 83 |
| Shown | 30, 1925–2026, all with caption | 30, 1965–2022, all with caption |
| Seconds per cover / covers per second | 0.4 / 2.5 | 0.4 / 2.5 |
| Requests openlibrary.org / covers | 15 / 222 | 3 / 31 |
| **Google requests** | **0** | **0** |
| Time cold: data / signatures / frames / total | 31 s / 137 s / 27 s / **196 s** | 3 s / 1 s / 26 s / **30 s** |
| Time warm (everything cached) | **8 s** (frames 6 s) | — |
| 32 PNG frames / animated WebP preview | 49 MB / 0.96 MB | 49 MB / 0.76 MB |
| MP4 | **not made — no ffmpeg** | **not made — no ffmpeg** |
| Median / smallest L image width | 322 / 253 px | 323 / **114** px |

- **The bar from the plan holds for *Dune*:** 30 s cold, under a minute. Gatsby's cold run is three minutes because 192 of its covers are not in the built index and have to be fetched and hashed at 0.3 s apart; that is politeness, not work — warm it is 8 s.
- **Looked at, all 32 frames of each:** the order reads as a history (Chilton 1965, Ace, New English Library, Heyne, Gollancz SF Masterworks, the 2021 film tie-ins), and the captions carry year and publisher for every shot.
- **Folding misses a repeated design across years.** *Dune*'s „Science Fiction's Supreme Masterpiece" Ace jacket appears three times (1999, 2005 Ace Trade, 2010) and the 2021 film poster twice (Aleph, Debolsillo) — same artwork, different printings the four fold tiers keep apart on purpose (the wall shows them too). For a clip it costs three of thirty slots. Open.
- **Covers without a design get in.** A plain red library binding (Chilton 1965) and a title page (Gollancz 1966) pass `looksLikeScannedPage`, which by rule only catches blank white scans. Open: a clip could prefer designs (contrast ≥ 30) without breaking the site rule, which is about deleting from the wall, not choosing thirty.
- **L images are small.** Open Library's „L" is a median 322 px wide, so every cover is upscaled about 2.7× to 860 px; soft but acceptable on a phone. One *Dune* cover is 114 px wide (7.5×) and looks it. Open: skip covers under ~200 px.
- **Not measured yet:** MP4 size and encode time, and whether 0.4 s per cover is readable in motion — the WebP preview plays it, but a phone and a real video player are the test. Frame PNGs are 1.6 MB each because they are lossless; the MP4 will be a fraction of that.
