# lab/video/screen — the Goodreads clip, recorded from the site

Julian, 2026-10-09: „können wir ein kurzvideo machen, dass zeigt, dass man seine goodreads to-read liste in unsere seite ziehen kann und damit einfach seine lieblingsedition findet und bestellen kann?“, then „eher 15, hochformat, erstmal nur text, schlage ein buch aus der kuratierten liste vor, lass es uns bauen“. ROADMAP 5.5b, plan [docs/plans/PLAN-5.5b-goodreads-clip.md](../../../docs/plans/PLAN-5.5b-goodreads-clip.md). **Generate yes, post by hand**, after the rights question of 5.5.

**Status (2026-10-09): built; a 14.9 s clip, 448 frames, an animated preview and an MP4** (H.264, 1080 × 1920, 30 fps, 11.2 MB), encoded with macOS's own AVFoundation (`encode.swift`) rather than ffmpeg: Homebrew has no ffmpeg bottles for macOS 13 and was still compiling its dependencies from source after more than ten minutes, so Julian had it stopped.

```bash
WALLS=on npx next dev -p 3107                     # with the main folder's .env.local sourced
npx tsx lab/video/screen/record.ts --warm         # walk the flow once: caches fill
npx tsx lab/video/screen/record.ts                # film it: out/raw/, out/take.json
python3 lab/video/screen/compose.py               # cut it: out/frames/, out/preview.webp, out/encode.sh
sh lab/video/screen/out/encode.sh                 # out/goodreads-clip.mp4 via encode.swift (AVFoundation)
npx tsx lab/video/screen/verdicts.ts "Title" …    # which curated covers the publisher's image confirms
npx tsx lab/video/screen/peek.ts <url> [ms]       # a page's text after it settles
```

## The question

Can the site's own flow — Goodreads export onto `/create`, the shelf as a collection, a book's covers, the shops for one printing — be filmed as a 15-second phone clip with nothing staged in the page?

## How

- **`record.ts`** drives a headless Chrome over the DevTools protocol (`cdp.ts`, Node's own WebSocket): a phone of 360 × 640 CSS px at three device pixels, light theme, the dev server's badge hidden. The file goes in through a real `drop` event on the page's drop zone, the buttons are the page's buttons. Filmed with full-size JPEG screenshots in a loop, about 62 ms each (about 16 fps), because a protocol screencast frame comes in CSS pixels, 360 × 640, whatever the device scale. It writes the frames, the phase marks and every tap (time and centre) to `out/take.json`. The last tap rests on Bookshop.org but clicks nothing: no shop is opened and no `/go/` click is counted.
- **`compose.py`** cuts the take at the marks (the editor between "Make a collection" and the collection is skipped), plays the rest at 0.9–1.4 times, and lays over it only what is plainly not the page: a title card, the file flying in, a soft dot for each tap, a caption band low on the screen (a headline and a line under it), an end card. Fonts are the site's own (Xanh Proportional, Jost), converted once from the WOFF2 files next/font leaves under `.next/static/media/`.
- **The demo export** `goodreads_library_export.csv` is invented: twelve books, nine on "to-read", titles and authors taken from `data/curated.json` (Open Library records), no ISBNs. Never a real reader's export.

## Measured (2026-10-09)

- The warm take runs 15.0 s from drop to the shops; 230 frames. Cut: 14.9 s, 448 frames at 30 fps; preview 1.75 MB (360 px wide, 15 fps); frames 98 MB.
- The book is *Wide Sargasso Sea*, Penguin 1997 (`ol:10191445`, ISBN 978-0-14-018983-4), the curated cover. **It is not a confirmed cover**: on 2026-10-09 Google Books answered every `isbn:` lookup with no result (ROADMAP 1.13), so no cover on the site could get the verdict `verified`, and the last line says "See where to buy that edition", not "order that edition". `verdicts.ts` checked 19 curated works with the ISBN lookup itself (21 more earlier with a weaker test that mistook `pending` for confirmed); none came out confirmed, for the same reason.
- Google requests: the warm runs and the checks asked Google from this Mac (one page-0 search and one ISBN lookup per book page, cached afterwards); none of them came back with a result.

## Open

- Julian's look at the edit (`docs/tests/2026-10-09-goodreads-clip.mp4` and `-preview.webp` in the main folder, git-ignored).
- A confirmed cover for the last scene once Google answers ISBN lookups again — then "Order that edition" and Bookshop.org leading.
- The title card is plain words; whether it should carry the wordmark or a few covers is Julian's call.
