# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Read this first

**[SPEC.md](SPEC.md) is the source of truth.** It defines the product, the domain model (Work / Edition), the functional requirements with acceptance queries, the decisions already taken, the implementation plan, and the roadmap. Do not re-derive any of that from the code. If code and spec disagree, the spec wins unless the user says otherwise.

The spec is written in German; code, comments, commit messages and this file are English (decision E7).

## Current state (2026-09-07)

The data layer was rewritten per SPEC.md §7; the old aggregator and legacy clients are gone (step 5). The UI talks only to `/api/search` and `/api/works/[id]`; external APIs are called server-side only.

- **Availability check (§9.3 step 16):** `lib/availability.ts` compares each shop's page for an ISBN with its page for an impossible control ISBN. Most shops cannot be checked: Amazon .com always answers with a bot check, eBay/ThriftBooks/Blackwell's/Booklooker refuse outright, and Hugendubel and genialokal return byte-identical HTML for a real and an invented ISBN because they render results in the browser. Hence the four states found it / can't tell / won't answer / no answer, and `can't tell` must never be worded as "the shop does not have it". It is not a stock check. `scripts/check-buylinks.ts` runs the same measurement from the command line before launch.
- **Buy links carry a verdict (§9.3 step 13, done 2026-09-07):** selecting a cover asks `/api/isbn/<isbn13>` and `verifyIsbnCover` says whether shops show this cover, a different one, or nothing known. The verdict reuses the wall's folding rather than a second threshold, so the sidebar and the wall never contradict each other. On `differs` the search links move above the buy links. **No retailer is ever contacted**: the buy links are URL templates and the only lookup is Google Books, so the wording names the publisher's image as the evidence and must not be changed to claim anything about shops. Google answers a transient 503 often; `getIsbnCovers` retries once and reports `unavailable`, which the client must not cache as "no cover".
- **Google Books quota (§8.7, step 13a done 2026-09-07):** a cold detail page costs **2** Google requests, not 11. The title search runs once, on page 0; the ISBN lookup that reveals the cover a shop currently ships runs only when a cover is selected (`lib/isbn.ts`, `components/useIsbnCovers.ts`). Never move it back into `getWorkPage`: the free quota is the binding constraint before launch, and an integration test asserts page 0 makes exactly one Google call.
- **Paged cover loading (§9.3 step 11, done 2026-09-07):** `/api/works/[id]?offset=<0|100|…>&signatures=<0|1>` returns **one page** of editions, never the whole work. Open Library orders editions by record age, so page 0 is the newest printings only; loading just that page showed 43 of Gatsby's 379 covers. `getWorkPage` in `lib/work.ts` builds a page (Google Books runs on page 0 only, so the quota does not grow with the page count); `useWorkPages` in `components/` loads pages sequentially in the background; `lib/pages.ts` (`mergeWorkPages`, `orderGroups`) combines them and keeps the language tabs from reshuffling. **Folding happens in the browser**, over every page loaded so far, which is why `lib/imagesig.ts` (signature type, `hamming`, `BLANK_CONTRAST`) is split from `lib/imagehash.ts` (jpeg-js and pngjs decoders, server only). Never import `imagehash` from client code. `getWorkDetail` still exists as the whole-work path for tests.

- Cover model (E8, step 6, done): `Cover` is its own entity in `lib/model.ts`; `assembleEditions` in `lib/works.ts` merges same-ISBN editions but never drops a cover. ISBN != cover: reprints change the cover under the same ISBN, so never dedupe by ISBN alone and never promise a cover at a purchase link.
- **Ranking (§9.3 step 10, done 2026-09-07):** relevance is relational, not per-work. `rankContext` in `lib/works.ts` builds the context once per result set (most-read work, derivative ids) and `relevance(work, query, context)` scores against it: Open Library's own position first, then popularity relative to the best work in the same result, then a small title bonus. Calling `relevance` without a context ranks a work against itself and is only meaningful for a single work. Never restore the old "exact title wins" rule: it put a 15-edition record above Nineteen Eighty-Four.
- Cover dedupe (E8 phase 2, §9.3 step 12, done): `lib/imagehash.ts` (dHash, contrast, mean luminance; server only) and `lib/coverhash.ts` (fetch small images with a 4 s budget per page, Next cache 30 d) produce signatures; `foldDuplicateCovers` in `lib/works.ts` runs on the client and folds in three tiers: distance ≤ 8 always, ≤ 20 when both covers share an ISBN, ≤ 16 when publisher matches and the years are within one. Never across publishers above 8, never across known languages. Cover counts fall on a second visit, when more images are cached and hashed. Pass `dedupeCovers: false` in tests that mock fetch with JSON.
- **Never delete a cover for looking blank.** `looksLikeScannedPage` only sorts an image to the end of its group. Measured on Nineteen Eighty-Four, a delete rule flagged four real covers among eight, including the 1949 Harcourt first-edition cloth boards; the numbers that describe a blurb scan also describe a plain white cover.
- Spec-conformant modules (steps 2–5, done): `lib/model.ts`, `lib/normalize.ts`, `lib/works.ts`, `lib/debug.ts`, `lib/sources/http.ts`, `lib/sources/openlibrary.ts` (+ `-parse.ts`), `lib/sources/googlebooks.ts` (+ `-parse.ts`), `lib/search.ts` (search orchestration, two external calls), `lib/work.ts` (detail page orchestration). `lib/market.ts` detects the market (US/UK/DE, decision E9) from an explicit choice, country header or Accept-Language; `lib/buylinks.ts` holds the retailer table per market (`buyLinksFor`, needs an ISBN; Amazon gets `/dp/<ISBN-10>`) and `searchLinksFor` (works without an ISBN: title searches, reverse image search, catalogues). Affiliate env variables carry the market suffix, e.g. `AFFILIATE_AMAZON_TAG_US`. Tests in `lib/__tests__/` run against fixtures in `lib/__fixtures__/`, recorded with `npx tsx scripts/record-fixtures.ts`.
- Fixtures cover both sources; Gatsby also has `openlibrary-editions-100.json` and `-200.json` so paging is testable. Re-record with `GOOGLE_BOOKS_API_KEY` set in `.env.local` (`set -a; source .env.local; set +a; npx tsx scripts/record-fixtures.ts`). Never commit the key; fixtures contain no URLs with keys.
- UI state rules: the URL is the source of truth for search state (`/?q=&lang=`) and for the selected cover on the detail page (`/book/<id>?q=&lang=&cover=`); components derive loading state from a request key instead of setting state inside effects (the `react-hooks/set-state-in-effect` lint rule is an error in this repo, and so is `react-hooks/refs`: a ref may not be read during render, which is why tab order is a pure function of arrival order rather than remembered).

Progress is tracked by the numbered steps in SPEC.md §7 (steps 1–9, done) and §9.3 (steps 10–15, the trust plan from the 2026-09-06 analysis: ranking, complete cover wall via paged loading, tiered dedupe, verified buy links, card mosaics, honest copy). Check `git log` to see which step was completed last.

## Facts about the APIs that the old code got wrong

- Open Library `/works/{id}/editions.json` returns `authors` as `[{ key: '/authors/OL…A' }]`, **not names**. Reading `a.name` yields `undefined` for every edition. Author names for editions must be taken from the work, not from the edition.
- Open Library search `author_name` contains duplicates and translators; only the first entry is the primary author. The same person can have several author keys (Reed: OL27626A and OL11412010A). Translators are removed in `withoutTranslators` (lib/works.ts) from edition evidence: an author key that never appears on an edition in the work's main language is a translator; editions without a language field are no evidence.
- Open Library editions carry a `covers` array with possibly several ids; take all of them, not just `[0]`.
- Google Books cover URLs: keep `zoom=1` and request size with `&fife=w800`. `zoom=2`+ is a page from the book scan and may not be the cover at all.
- Google Books has no work concept. Its results must be matched to an Open Library work by normalized title + primary author and must never create a work of their own (decision E5).
- Open Library regularly takes 2–7 s for a search and 3–10 s for an editions page from Germany, occasionally much longer. Every external call needs a timeout and a cache (§4 N3, N4); the values live in `OL_TIMEOUTS`.

## Layout

```
app/                Next.js App Router pages and API routes
  api/search/       GET ?q=&lang=  -> SearchResult (lib/search.ts)
  api/works/[id]/   GET ?offset=&signatures=  -> WorkPageResponse, one page (lib/work.ts + buy links)
  api/isbn/[isbn]/  GET ?signatures=  -> IsbnCovers, what a shop shows for an ISBN (lib/isbn.ts)
  book/[id]/        detail page, id = Open Library work id
components/         React components, Tailwind
lib/                data layer, layout in SPEC.md §7; types in lib/model.ts
  pages.ts          merging edition pages, tab order (pure, runs on the client)
  imagesig.ts       signature type and hamming distance (client-safe)
  sources/          Open Library and Google Books clients and parsers
  __fixtures__/     recorded API responses for tests
scripts/            record-fixtures.ts
```

## Commands

```bash
npm run dev        # dev server on :3000
npm run test:run   # vitest, single run
npx tsc --noEmit   # type check without building
npm run build      # must pass before a step is considered done
```

## Working rules

- One commit per step of SPEC.md §7; the commit message names the step.
- `lib/` must have no `any` and no `console.log` outside a `DEBUG` guard.
- New logic in `lib/` gets a unit test next to it or under `lib/__tests__/`. Tests that need API data use recorded fixtures under `lib/__fixtures__/`, never live calls.
- Verify UI changes in the browser with the five acceptance queries from SPEC.md §3 F1 before calling a step done.
- Do not add features from SPEC.md §8 while §7 is unfinished.
