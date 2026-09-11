# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Read this first

**[SPEC.md](SPEC.md) is the source of truth for what the site is:** product, domain model (Work / Edition / Cover), functional and non-functional requirements with acceptance queries, decisions E1–E17, and the measured limits. Do not re-derive any of that from the code. If code and spec disagree, the spec wins unless the user says otherwise.

**[ROADMAP.md](ROADMAP.md) holds every item exactly once**, open or done, with an owner (Julian or Claude). Its head section „Steuerung“ links every other document, lists the next steps and draws the dependencies between open items; its phases are ordered by dependency (0, 2, 1, 6, 3, 5, 4), not by number, and the numbers never change. Take work from there. **[docs/features.md](docs/features.md)** lists what the site can do today, one row per feature with spec section, roadmap item and code; **[docs/roadmap-archive.md](docs/roadmap-archive.md)** keeps the full text of every ticked item. **[docs/history.md](docs/history.md)** is the record of what was built and measured, kept under the old section numbers (§5, §7, §8.x, §9, §10) that code comments still cite; the implementation plans, finished and open, are in `docs/plans/` with an index in `docs/plans/README.md` that says which is which. When an item is done, tick it in the roadmap and shorten it to a few lines saying what came of it, with links to the history entry and the archive; move its full text to docs/roadmap-archive.md under its number; add a row to docs/features.md; the measurements go to the history, and the spec is updated if the behaviour changed. Finished items stay on the roadmap so that what is open and what is settled can be read in one place.

**Nothing is finished in the chat.** Every finding, decision, measurement and change lands in a file before the turn ends: a requirement or a rule in SPEC.md, an open or ticked item in ROADMAP.md, a measurement in docs/history.md. A number that was only said in conversation is lost, and the next session will re-measure it or, worse, guess it. This holds for the small things too — a threshold that turned out wrong, a source that was slower than assumed, an idea the user mentioned in passing. If the user says something worth keeping, write it down and say where it went.

The spec is written in German; code, comments, commit messages and this file are English (decision E7).

## Current state (2026-09-10)

The site has been live since 2026-09-08 at https://beautifulcovers.vercel.app in hobby mode (E20). What it can do is listed in [docs/features.md](docs/features.md); what is next, in the head of [ROADMAP.md](ROADMAP.md).

The data layer was rewritten in 2026-09-06 (docs/history.md, old §7); the old aggregator and legacy clients are gone (step 5). The UI talks only to `/api/search` and `/api/works/[id]`; external APIs are called server-side only.

- **Availability check (§9.3 step 16):** `lib/availability.ts` compares each shop's page for an ISBN with its page for an impossible control ISBN. Most shops cannot be checked: Amazon .com always answers with a bot check, eBay/ThriftBooks/Blackwell's/Booklooker refuse outright, and Hugendubel and genialokal return byte-identical HTML for a real and an invented ISBN because they render results in the browser. Hence the four states found it / can't tell / won't answer / no answer, and `can't tell` must never be worded as "the shop does not have it". It is not a stock check. `scripts/check-buylinks.ts` runs the same measurement from the command line before launch. **This feature is not cleared for production**: four of the six shops disallow the probed path in robots.txt and Amazon's Associates terms forbid automated access, so a decision is due before the first deployment (SPEC §8.7). Do not deploy without resolving it.
- **Buy links carry a verdict (§9.3 step 13, done 2026-09-07):** selecting a cover asks `/api/isbn/<isbn13>` and `verifyIsbnCover` says whether the publisher's registered image is this cover, a different one, or absent. **The wording lives in `lib/verdicts.ts` and nowhere else**, because the sidebar and the About page both need it and drifted apart when each had its own copy. The verdict reuses the wall's folding rather than a second threshold, so the sidebar and the wall never contradict each other. On `differs` the search links move above the buy links. **No retailer is ever contacted**: the buy links are URL templates and the only lookup is Google Books, so the wording names the publisher's image as the evidence and must not be changed to claim anything about shops. Google answers a transient 503 often; `getIsbnCovers` retries once and reports `unavailable`, which the client must not cache as "no cover".
- **Google Books quota (§8.7, step 13a done 2026-09-07):** a cold detail page costs **2** Google requests, not 11. The title search runs once, on page 0; the ISBN lookup that reveals the cover a shop currently ships runs only when a cover is selected (`lib/isbn.ts`, `components/useIsbnCovers.ts`). Never move it back into `getWorkPage`: the free quota is the binding constraint before launch, and an integration test asserts page 0 makes exactly one Google call.
- **Paged cover loading (§9.3 step 11, done 2026-09-07):** `/api/works/[id]?offset=<0|100|…>&signatures=<0|1>` returns **one page** of editions, never the whole work. Open Library orders editions by record age, so page 0 is the newest printings only; loading just that page showed 43 of Gatsby's 379 covers. `getWorkPage` in `lib/work.ts` builds a page (Google Books runs on page 0 only, so the quota does not grow with the page count); `useWorkPages` in `components/` loads pages sequentially in the background; `lib/pages.ts` (`mergeWorkPages`, `orderGroups`) combines them and keeps the language tabs from reshuffling. **Folding happens in the browser**, over every page loaded so far, which is why `lib/imagesig.ts` (signature type, `hamming`, `BLANK_CONTRAST`) is split from `lib/imagehash.ts` (jpeg-js and pngjs decoders, server only). Never import `imagehash` from client code. `getWorkDetail` still exists as the whole-work path for tests.

- Cover model (E8, step 6, done): `Cover` is its own entity in `lib/model.ts`; `assembleEditions` in `lib/works.ts` merges same-ISBN editions but never drops a cover. ISBN != cover: reprints change the cover under the same ISBN, so never dedupe by ISBN alone and never promise a cover at a purchase link.
- **Ranking (§9.3 step 10, done 2026-09-07):** relevance is relational, not per-work. `rankContext` in `lib/works.ts` builds the context once per result set (most-read work, derivative ids) and `relevance(work, query, context)` scores against it: Open Library's own position first, then popularity relative to the best work in the same result, then a small title bonus. Calling `relevance` without a context ranks a work against itself and is only meaningful for a single work. Never restore the old "exact title wins" rule: it put a 15-edition record above Nineteen Eighty-Four.
- Cover dedupe (E8 phase 2, §9.3 step 12, done): `lib/imagehash.ts` (dHash, contrast, mean luminance; server only) and `lib/coverhash.ts` (fetch small images with a 4 s budget per page, Next cache 30 d) produce signatures; `foldDuplicateCovers` in `lib/works.ts` runs on the client and folds in three tiers: distance ≤ 8 always, ≤ 20 when both covers share an ISBN, ≤ 16 when publisher matches and the years are within one. Never across publishers above 8, never across known languages. Cover counts fall on a second visit, when more images are cached and hashed. Pass `dedupeCovers: false` in tests that mock fetch with JSON.
- **Never delete a cover for looking blank.** `looksLikeScannedPage` only sorts an image to the end of its group. Measured on Nineteen Eighty-Four, a delete rule flagged four real covers among eight, including the 1949 Harcourt first-edition cloth boards; the numbers that describe a blurb scan also describe a plain white cover.
- Spec-conformant modules (steps 2–5, done): `lib/model.ts`, `lib/normalize.ts`, `lib/works.ts`, `lib/debug.ts`, `lib/sources/http.ts`, `lib/sources/openlibrary.ts` (+ `-parse.ts`), `lib/sources/googlebooks.ts` (+ `-parse.ts`), `lib/search.ts` (search orchestration, two external calls), `lib/work.ts` (detail page orchestration). `lib/market.ts` detects the market (US/UK/DE, decision E9) from an explicit choice, country header or Accept-Language; `lib/buylinks.ts` holds the retailer table per market (`buyLinksFor`, needs an ISBN; Amazon gets `/dp/<ISBN-10>`) and `searchLinksFor` (works without an ISBN: title searches, reverse image search, catalogues). Affiliate env variables carry the market suffix, e.g. `AFFILIATE_AMAZON_TAG_US`. Tests in `lib/__tests__/` run against fixtures in `lib/__fixtures__/`, recorded with `npx tsx scripts/record-fixtures.ts`.
- Fixtures cover both sources; Gatsby also has `openlibrary-editions-100.json` and `-200.json` so paging is testable. Re-record with `GOOGLE_BOOKS_API_KEY` set in `.env.local` (`set -a; source .env.local; set +a; npx tsx scripts/record-fixtures.ts`). Never commit the key; fixtures contain no URLs with keys.
- **A mosaic must never ask Google Books.** `getWorkPage` runs the Google title search on page 0, so `?summary=1` (a search card's mosaic) would cost one Google request per card: 21 for a result page instead of 1. `WorkPageOptions.googleBooks: false` turns it off, and an integration test asserts a mosaic spends none. Measured on five works, Open Library alone fills all four tiles anyway (SPEC §8.7).
- **Google is called in exactly two places, and a search is not one of them.** `searchEditionCandidates` on page 0 of a work (covers, descriptions, preview links) and `lookupIsbnOrThrow` when a cover is selected (the verdict — the trust promise of §9.2). `lib/search.ts` makes one external call, to Open Library; the Google call there was removed on 2026-09-07 because every card that it still gave covers to already filled all four mosaic tiles from Open Library alone. Do not add a third caller without measuring what it buys against the 1,000 a day.
- **The Google quota is 1,000 requests a day** (read from the Cloud console 2026-09-07; a search costs 1, a cold detail page 2, so roughly 500 cold detail pages a day). `lib/googlequota.ts` stops asking when Google itself reports `dailyLimitExceeded` — until the next **Pacific** midnight — or pauses 90 s on a rate limit. A 403 for any other reason must never open it, or a wrong API key silently disables Google for a day. Do not replace this with a counter: the Next data cache means the code cannot tell which of its calls left the machine, so a counter throttles far too early. Tests that provoke a 429 must call `resetGoogleQuota()`, or they silence Google for every test after them.
- **A verdict must never claim more than was checked.** `IsbnVerdict` has `pending` (not asked yet) and `unavailable` (asked, source silent) besides `unknown` (asked, no image on record), and each has its own wording. Falling through to the `unknown` sentence while a lookup runs told the reader something untrue for a second or two, and would have done so all day on an exhausted quota.
- **Rate limits** (`lib/ratelimit.ts`, applied via `app/api/rate.ts`): a bucket per route plus a shared `google` bucket for the requests that can spend the quota. Charge `google` only where a Google request is actually possible — page 0 of a work, a search, an ISBN lookup — never for a mosaic or a later page. The counters are per instance and 5/min is 7,200 a day, so this bounds a burst, not a day; do not describe it as protecting the quota.
- **The cover game (`/versus`, ROADMAP 5.8a, SPEC F7) is the first thing the running site writes to**: Redis from the Vercel Marketplace through `lib/hotornot/store.ts`, variables prefixed `STORAGE_`, with the suffix and the value's scheme matched rather than a name assumed — a REST pair if there is one, otherwise a direct `redis`/`rediss` connection through the `redis` package (the store Julian connected on 2026-09-11 provided only `STORAGE_REDIS_URL`). Off in Vercel production unless `HOTORNOT=on`. A vote is two covers, a winner and a day; never add anything about the voter (N11). A vote is taken only for a pair the server signed (`lib/hotornot/token.ts`), and the token carries a nonce — without one, two players shown the same pair in the same second collided and one vote was lost. The dev memory store and the dev signing key live on `globalThis`, because `next dev` gives API routes and pages separate copies of a module and a module-level variable split them. Whether the store stays is decision E21, and Julian's.
- **`/go/[provider]/[isbn]` rebuilds the target from `lib/buylinks.ts`** and must never take a URL from the request, or it becomes an open redirect. It records provider, market, ISBN, kind and time, and nothing about the reader — no IP, cookie, user agent or referrer. Keep it that way: the About page and the privacy notice say so.
- The detail page's metadata and JSON-LD live in `app/book/[id]/page.tsx` (server); the interactive body is `components/BookDetail.tsx`. Wording for both comes from `lib/seo.ts`, which is covered by tests that reject "all", "every" and "complete".
- Sidebar and phone sheet are **exclusive** (`components/useIsDesktop.ts`), not CSS-hidden duplicates: hiding one would still fetch the cover image twice.
- UI state rules: the URL is the source of truth for search state (`/?q=&lang=`) and for the selected cover on the detail page (`/book/<id>?q=&lang=&cover=`); components derive loading state from a request key instead of setting state inside effects (the `react-hooks/set-state-in-effect` lint rule is an error in this repo, and so is `react-hooks/refs`: a ref may not be read during render, which is why tab order is a pure function of arrival order rather than remembered; a custom hook that hands back `useRef` objects trips it too, because the component reads them in render to pass them on — return **callback refs** instead, see `components/useOverflowsX.ts`).

Steps 1–9 (data layer) and 10–16 (the trust plan: ranking, paged cover wall, tiered dedupe, verified buy links, card mosaics, honest copy) are done and described in docs/history.md. Open work is ROADMAP.md; check `git log` for the last thing finished.

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
  api/rate.ts       rateLimited(request, ...buckets) -> 429 or null, used by every route
  api/search/       GET ?q=&lang=  -> SearchResult (lib/search.ts)
  api/works/[id]/   GET ?offset=&signatures=&summary=  -> WorkPageResponse or WorkSummaryResponse
  api/isbn/[isbn]/  GET ?signatures=  -> IsbnCovers, what a shop shows for an ISBN (lib/isbn.ts)
  book/[id]/        server component: metadata, JSON-LD, ISR; body in components/BookDetail.tsx
    opengraph-image.tsx  1200x630 cover mosaic for shared links
  about/            sources, gaps, what a verdict means
  go/[provider]/[isbn]/  counts a buy-link click and redirects (lib/clicks.ts)
  versus/           the cover game and its board (5.8a, SPEC F7), behind a switch; noindex
  api/versus/       pair, vote, flag; guard.ts answers off (404), busy (429) or no store (503)
  sitemap.ts, robots.ts
components/         React components, Tailwind
  BookDetail.tsx    the whole interactive detail page (client)
  CoverSheet.tsx    phone-only peek bar and sheet for the selected cover
lib/                data layer; types in lib/model.ts
  pages.ts          merging edition pages, tab order (pure, runs on the client)
  imagesig.ts       signature type and hamming distance (client-safe)
  ratelimit.ts      token buckets per IP and route (server only)
  seo.ts            page title, description, schema.org Book (pure)
  clicks.ts         one structured log line per buy-link click (server only)
  sources/          Open Library and Google Books clients and parsers
  __fixtures__/     recorded API responses for tests
scripts/            record-fixtures.ts, check-buylinks.ts
lab/                experiments beside the website (rules in lab/README.md);
                    may import lib/, is never imported by the website
docs/               history.md (what was built and measured), plans/ (implementation
                    plans, finished and open), tests/ (test-session findings),
                    spine-research.md
```

## Commands

```bash
npm run dev        # dev server on :3000
npm run test:run   # vitest, single run
npx tsc --noEmit   # type check without building
npm run build      # must pass before a step is considered done
```

## Working rules

- **`lib/coverindex.ts` and `data/cover-index.json` are server-only.** The file is 410 KB at fifty works and would go to the browser whole if a client component imported it; the client asks `/api/similar/<coverId>` instead. Same trap as `lib/imagehash.ts`. The index is built by `scripts/build-cover-index.ts` and committed — never rebuilt in a request handler, which would call Open Library thousands of times.

- **Similarity thresholds were set by looking, not by arithmetic** (SPEC §2.5, ROADMAP 6.10). Colour ≤ 0.055 and structure ≤ 0.28 are two gates, not a weighted blend: measured over 58,000 random pairs the median is 0.51 colour and 0.48 structure, so any blended threshold loose enough to be interesting admits everything. At the current gates 11% of covers have any neighbour at all. If you change them, look at the pairs again — the numbers alone will mislead you.

- **A failure must never be reported as a finding.** A source that times out is not "no results", an unasked question is not "nothing on record", and a hint must not name a setting that is not set. `searchWorks` still swallows every error into an empty list, which reaches the reader as "No books found"; that is ROADMAP 1.4 and the pattern to avoid everywhere else (SPEC F1.7, F3.3, N12).

- **No copy claims completeness.** The site shows what two open catalogues happen to hold, which is a fraction of what was printed: never "every", "all" or "complete" about covers or editions, in the UI, the metadata or the README. The detail page's counter states what was actually seen, and the surrounding text must not contradict it (SPEC §9.3 step 15).

- One commit per roadmap item; the commit message names it.
- `lib/` must have no `any` and no `console.log` outside a `DEBUG` guard.
- New logic in `lib/` gets a unit test next to it or under `lib/__tests__/`. Tests that need API data use recorded fixtures under `lib/__fixtures__/`, never live calls.
- **Verify against `npm run dev`, not against production** (Julian, 2026-09-09). Loading states are easier to catch locally anyway, and every request to the live site spends the Google quota. After a deploy, check production **once** — the one page, the one search, the thing that changed — and never poll it: repeated automated requests trip Vercel's bot mitigation, which answers 403 with `x-vercel-mitigated: challenge` and looks exactly like an outage (ROADMAP 2.4).
- Verify UI changes in the browser with the five acceptance queries from SPEC.md §3 F1 before calling a step done.
- Work ROADMAP.md in the order its phases are listed — dependency order (0, 2, 1, 6, 3, 5, 4), not the numbers. Do not start a later phase while an earlier one has items that do not wait on Julian; phase 6 may be taken at any time.
- **Several sessions work in parallel, each in its own worktree, and some push straight to `origin/main`.** Run `npm run worktrees -- --fetch` at the start of a session and before any merge into `main`: it writes `docs/worktrees.md` (git-ignored, so never stale in a commit) with every branch's distance to production and the roadmap items named in its commits. On 2026-09-10 the local `main` was six commits ahead of and fifteen behind production, and nothing in the repository showed it. Merge `origin/main` into your branch before merging into `main`, and never assume `main` is production — `origin/main` is. A commit subject names its roadmap item; that is what the overview reads.

- **`lab/` is for experiments that are not the website** (decision 0.11, 2026-09-08; rules in `lab/README.md`). One folder per experiment with a README (question, measure, status). `lab/` may import from `lib/`, which has no import from `next` and runs under `npx tsx`; `app/`, `components/`, `lib/` and `scripts/` never import from `lab/`, and an ESLint rule enforces it. Tests under `lab/<name>/__tests__/`, no network. `lab/` is exempt from the phase order, but every experiment has a roadmap line, nothing reaches the website without its own roadmap item, and no experiment asks Google Books without a measurement (E10). No scratch files in the repository root: `/scratch-*` is git-ignored.
