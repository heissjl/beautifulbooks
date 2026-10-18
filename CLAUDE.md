# CLAUDE.md

Guidance for Claude Code when working in this repository. Shortened on 2026-10-18 (ROADMAP 6.44) from 7,000 words to this; every rule that stood here still stands — here as a line, or where the line points. The checklist old line → new place is in docs/history.md (2026-10-18, 6.44).

## Read this first

**[SPEC.md](SPEC.md) is the source of truth for what the site is:** product, domain model (Work / Edition / Cover), requirements with acceptance queries, decisions E1–E23, measured limits. Do not re-derive any of that from the code; if code and spec disagree, the spec wins unless the user says otherwise.

**[ROADMAP.md](ROADMAP.md) holds every item exactly once**, open or done, with an owner (Julian or Claude); its head „Steuerung" links every other document and lists the next steps. Phases are worked in dependency order (0, 2, 1, 6, 3, 5, 4), never a later one while an earlier one has items that do not wait on Julian — phase 6 any time; numbers never change. **[docs/features.md](docs/features.md)** says what the site can do, **[docs/roadmap-archive.md](docs/roadmap-archive.md)** keeps every ticked item's full text, **[docs/history.md](docs/history.md)** records what was built and measured (old §5, §7, §8.x, §9, §10 still cited in code), plans live in `docs/plans/`. Ticking an item has five steps — `/abhaken <Nr>` walks them (6.40). Finished items stay on the roadmap.

**Nothing is finished in the chat.** Every finding, decision, measurement and change lands in a file before the turn ends — a rule in SPEC.md, an item in ROADMAP.md, a number in docs/history.md, a tool lesson in docs/umgang.md. If the user says something worth keeping, write it down and say where it went.

**Before the first use of an external service or tool in a session, read its section in [docs/umgang.md](docs/umgang.md)** (Julian, 2026-10-09) — one section per tool, from Open Library to the Cockpit; a new lesson goes there in the same session, dated. What the old code got wrong about the catalogue APIs: [docs/api-fakten.md](docs/api-fakten.md).

The spec is German; code, comments, commit messages and this file are English (E7). Replies to Julian are German.

## The site (2026-10-18)

**"Buy Its Covers", https://buyitscovers.com**, live since 2026-09-08 in hobby mode (E20, no commission), Vercel Pro since 2026-10-05; the old `beautifulcovers.vercel.app` and five bought domains redirect 308 (docs/domain-recherche.md). `app/.well-known/atproto-did/route.ts` proves the Bluesky handle and must stay. Repository, Vercel project, the cookie `bb_visitor` and the log prefix `bb.` keep the old initials — renaming the cookie would cut every reader off from their collections. **The name is written once, `SITE_NAME` in `lib/seo.ts`** (a test fails on a second copy); in running text it is set in italics, in metadata, titles and mail upright. The UI talks only to `/api/search` and `/api/works/[id]`; external APIs are called server-side only.

## Rules that hold

Each line is a rule that was broken once or would cost the site something. The reasoning and the measurements are in docs/history.md under the item named.

**Catalogues and quota**
- **Google is called in exactly two places, and a search is not one of them:** the title search on page 0 of a work and the ISBN lookup when a cover is selected. A cold detail page costs 2 requests, a mosaic (`googleBooks: false`) and a search 0 — integration tests assert both. No third caller without measuring what it buys against the **1,000 requests a day** (§8.7).
- **The quota breaker** (`lib/googlequota.ts`) opens only on Google's own `dailyLimitExceeded` (until Pacific midnight) or pauses 90 s on a rate limit; any other 403 must never open it; never a counter instead — the data cache hides which calls left the machine. Tests that provoke a 429 call `resetGoogleQuota()`. An empty field search is believed only after two canary ISBNs (1.13); when Google cannot be asked, Open Library's record answers (1.12) and the verdict takes a `catalogue…` state that never passes as `verified`.
- **Rate limits** (`lib/ratelimit.ts`): a bucket per route plus a shared `google` bucket charged only where a Google request is possible — never a mosaic or a later page. Per instance: they bound a burst, not the quota.
- Every external call has a timeout and a cache (N3, N4; `OL_TIMEOUTS`). **Never poll production** — repeated requests trip Vercel's bot mitigation (403, `x-vercel-mitigated: challenge`), which looks like an outage; one check after a deploy, the rest against `npm run dev`. Open Library blocks an address that asks too much (umgang §1).

**Covers, editions, verdicts**
- **`Cover` is its own entity** (E8, `lib/model.ts`); `assembleEditions` merges same-ISBN editions but never drops a cover. **ISBN ≠ cover**: reprints change the image under one number — never dedupe by ISBN alone, never promise a cover at a purchase link.
- **An ISBN is not a printing and not a cover** (SF Masterworks, 2026-10-08): a label like "first printing" needs a dated record for exactly that image; a credit describes the printing whose image is shown (6.52); check edition, then printing, then image; a correction from outside is checked in the source, recorded either way, and the whole collection is checked for the same fault (umgang §8, [docs/ausgaben-recherche.md](docs/ausgaben-recherche.md)). **Writing to Open Library** only with Julian's yes, under his account, onto the edition whose ISBN and date match, each change with ids in the history.
- **Ranking is relational** (`rankContext`, `relevance(work, query, context)`): Open Library's position, popularity relative to the best work in the result, a small title bonus. Never restore "exact title wins" — it put a 15-edition record above *Nineteen Eighty-Four*. **The first-publication year** goes through `lib/firstyear.ts` (a leading year more than 50 years before the next is dropped).
- **Folding happens in the browser**, over every page loaded so far, in the four tiers of SPEC §2.3 (the fourth, across publishers, needs the colour fields in the signature — 6.36) and never across known languages. `lib/imagesig.ts` is client-safe, `lib/imagehash.ts` server only — never import `imagehash` from client code. Pass `dedupeCovers: false` in tests that mock fetch with JSON.
- **Never delete a cover for looking blank**: `looksLikeScannedPage` only sorts it to the end — a delete rule flagged four real covers of eight on *Nineteen Eighty-Four*.
- **Paged loading**: `/api/works/[id]?offset=&signatures=` returns one page, never the whole work; `useWorkPages` loads pages in the background, `lib/pages.ts` merges them without reshuffling the language tabs; `getWorkDetail` stays as the whole-work path for tests.
- **A verdict never claims more than was checked** (§9.2): `pending`, `unavailable`, `unknown` and the `catalogue…` states each have their own wording in `lib/verdicts.ts` and nowhere else; no retailer is ever contacted — the evidence is the publisher's registered image, the copy must not claim anything about shops; on `differs` the search links lead. Google's transient 503 is retried once and reported `unavailable`, never cached as "no cover".
- **The availability check** (`lib/availability.ts`) is not cleared for production (robots.txt, Amazon's terms; SPEC §8.7); its four states are not a stock check, and `can't tell` is never worded as "the shop does not have it".
- **Similarity thresholds were set by looking**, two gates, not a blend (6.10): change them only after looking at the pairs again. `lib/coverindex.ts` and `data/cover-index.json` are server only, built by a script and committed — the client asks `/api/similar/<coverId>`; never rebuild the index in a request handler.

**Copy and the reader**
- **No copy claims completeness** — never "every", "all" or "complete" about covers or editions, in the UI, metadata or README; the counter states what was seen, the text must not contradict it (§9.3 step 15; `lib/seo.ts` tests reject the words).
- **A failure is never a finding** (N12): a timeout is not "no results", an unasked question is not "nothing on record", a hint never names a setting that is not set. `searchWorks` swallowing errors into "No books found" is the pattern to avoid everywhere else (1.4).
- **The site speaks English or German** (§2.6, E23): copy goes through `t()` (`useT()` in a client component, `translator(locale)` in a server page); **the English sentence is the key**, the German lives only in `lib/i18n/de.ts`, and `lib/__tests__/i18n.test.ts` names every stale sentence — never silence it. The locale is a cookie (`/api/locale/<de|en>`, 6.106); `proxy.ts` rewrites a German reader to the mirror tree `app/de/`; never read the cookie in the root layout (every route would turn dynamic), every new page needs its mirror file, `/de/…` is not a public address, metadata and data stay English. **A translation does the sentence's job, it does not render its words** (Julian, 2026-10-02).
- **Readers' collections (5.13a, F9; `wall` in code) are the one place with a visitor id** (E22): cookie `bb_visitor`, set by the first wall, never for a reader who only looks; the store keeps its SHA-256, never the id. The book pages pass `walls` down as a prop (`BookDetail` renders in the browser); the add control stays in the Share row on a desktop.
- **Reading a photo of books (5.11a) is the one thing the site pays for per use**, in one function (`lib/walls/readphoto.ts`) with a daily cap (`photobudget.ts`). Change the prompt, effort, threshold or cutting **only against the test set** (`npx tsx lab/shelf/evaluate.ts`), never against one photo.
- **The analytics (3.1, `/admin/insights`) never store anything on the reader's device** (§ 25 TDDDG): one `sendBeacon` summary per page left to `/api/seen`, fixed classes, daily totals; Julian's visits are excluded by his admin cookie on the server. Only `no-store` routes (`/go/`, `/api/seen`, the photo route) and the browser signal see every reader — never count readers in a CDN-cached route or an ISR page.
- **`/go/[provider]/[isbn]` rebuilds its target from `lib/buylinks.ts`** (and `lib/localshops.ts`), never from the request — or it is an open redirect; word searches travel as words (`wordsLinkFor`, `lib/__tests__/go-words.test.ts` covers every shop in every market); it logs provider, market, ISBN, kind, time and nothing about the reader. The same holds for `/api/locale` (`backTarget`) and `/img/` (an id, never a URL).

**Stores and operation**
- **Redis** (`lib/redis.ts`, variables prefixed `STORAGE_`) holds everything the running site writes: the game's votes (two covers, a winner, a day — never anything about the voter; only for a pair the server signed, with a nonce), friends' suggestions and `/curate` drafts (a suggestion never changes a page), the readers' collections, the live state of the thematic collections, the analytics' daily totals. The dev memory store and signing key live on `globalThis` (next dev splits modules). Whether the store stays is E21, Julian's. Caps (2.20), fill level (2.18g), photos closing when the store is silent (2.18h); **a copy outside the provider**: `npm run backup` → `../bb-backups/`, never into the repository, a chat or iCloud; `npm run restore` targets only the Redis named in `--to` (2.11).
- **Thematic collections (`/collections`, 5.10, F8)** come from `data/collections.json`, written only by `lab/collections/`; **the file is not what the site shows** — published drafts, switches and order are laid over it at runtime (`liveRecords`; the live state comes from a snapshot, umgang §13). An author collection gets no name added but by Julian (2026-09-24): tool, server and a test on the file enforce it. Never import `lib/collections.ts` into a client component or the footer — it would ship the file to every browser; pass works as props.
- **"My Shelf-Portrait" (`/shelfportrait`, 5.18b, switch `INSPIRATION`)**: readers see "shelfportrait", code and API say "inspiration"; the board lives in the address (`lib/inspiration/board.ts`, pure), a short link in the store up to `LINK_CAP`, past it the long address, never an error; the maker is told from a visitor by module memory or `#mine`, never an id. **It never asks Google** (`/api/inspiration/covers`, not `/api/works`); `lib/inspiration/browse.ts` is server only; a story keeps its words out of Instagram's 250 px top and bottom (`safe`). What a short link stores is in the privacy notice in a sentence Julian approved — change one, change the other.
- **Security headers and CSP** live in `lib/securityheaders.ts`, enforced since 2026-10-18 (2.12a; reports to `/api/csp`); `/img/<size>/<id>` passes raster images only.

**Switches** (`.env.example` explains each): `HOTORNOT`, `WALLS`, `INSPIRATION`, `INSIGHTS=off` (stops every count), `PHOTO`, `GOOGLE_TITLE_SEARCH`, `SUGGEST_PASSWORD`/`SUGGEST_ADMIN_PASSWORD`, `NEXT_PUBLIC_AVAILABILITY_CHECK`. Unset means on everywhere but Vercel production for the reader-facing ones; a `next dev` with the main folder's `.env.local` once pointed at the production Redis — source it for a single build command only (umgang §4).

**Every change asks: does this move a number in the analytics?** (Julian, 2026-10-04; plan `docs/plans/PLAN-3.1-analyse.md`.) Before a change is done, adjust the analytics in the same commit or say in the commit message why nothing is affected: (1) a new or changed shop link goes through `/go/` and `go-words.test.ts`, a new provider gets a label in `labelsFor`; (2) a new paid call or model id is counted and priced in `lib/insights/prices.ts`; (3) a new page type or path is classed by `originOf` in `lib/insights/signals.ts`; (4) what a book page or result list renders — `data-cover-id`, `data-results`, `useReportVerdict`, `pagesLoaded`, the `/book/` links — is what the signals read, a new verdict status joins `VERDICTS`; (5) never a counter in a cached route; (6) anything newly stored or sent: no identifier, no free text beyond the empty-search words, classes not values, and the privacy notice (both languages), `docs/recht-hobbyseite.md` §4 and plan §6 change with it — Julian approves the sentence; (7) a new KPI goes to plan §3, features.md and a test in `lib/__tests__/insights*.test.ts`.

## Code rules

- `lib/` has no `any` and no `console.log` outside a `DEBUG` guard; new logic in `lib/` gets a unit test next to it or under `lib/__tests__/`; tests that need API data use recorded fixtures under `lib/__fixtures__/`, never live calls (recording: umgang §2).
- **The URL is the source of truth** for search state (`/?q=&lang=`) and for the selected cover (`/book/<id>?…&cover=`); components derive loading state from a request key, never set state inside effects — `react-hooks/set-state-in-effect` and `react-hooks/refs` are errors here (a ref is not read during render; hooks hand back **callback refs**, see `components/useOverflowsX.ts`).
- Sidebar and phone sheet are **exclusive** (`components/useIsDesktop.ts`), not CSS-hidden duplicates: hiding one would still fetch the cover twice.
- Page metadata and JSON-LD live in `app/book/[id]/page.tsx` (server), the interactive body in `components/BookDetail.tsx`; wording for both from `lib/seo.ts`.
- **`lab/` is for experiments that are not the website** (0.11, `lab/README.md`): one folder per experiment with a README (question, measure, status); `lab/` may import `lib/`, which has no import from `next`; `app/`, `components/`, `lib/` and `scripts/` never import from `lab/` (an ESLint rule enforces it). `lab/` is exempt from the phase order, but every experiment has a roadmap line, nothing reaches the site without its own item, no experiment asks Google without a measurement (E10). No scratch files in the repository root (`/scratch-*` is git-ignored). Lab output too dear to recompute goes to `../bb-lab-cache/<lab>/`.
- **Generated files are never edited by hand** — a hook refuses it and names the script (6.39): `docs/worktrees.md`, `docs/cockpit.html`, `data/cover-index.json` and the other `scripts/build-*` outputs, `public/loading/`.

## Working rules

- Verify against `npm run dev`, not production; look at every UI change at **390 × 844 and 1280 × 800** and **measure** (`/messen <url>`), run the five acceptance queries of SPEC §3 F1, and `npm run build` must pass before a step is done (N14; umgang §9).
- Julian's screenshots and recordings stay local in `docs/tests/` (git-ignored); the report carries everything in text.
- One commit per roadmap item, the subject names it, the message answers the analytics checklist. Push only when Julian says so — `origin/main` is production, the local `main` is not; sessions work in parallel in their own worktrees, hooks refresh the overview and make a push to `main` ask (6.39; umgang §11). Production logs keep an hour (umgang §4); the Cockpit is a view, never a second list (umgang §12).

## Layout

```
app/          App Router: pages, api/ (rate.ts guards every route), book/[id], go/, versus/, collections/, create/ + c/[id], shelfportrait/, suggest/, curate/, admin/insights, de/ (mirror tree)
components/   React, Tailwind — BookDetail.tsx (the detail page), CoverSheet.tsx (phone), i18n.tsx
lib/          data layer and pure logic; model.ts, sources/ (Open Library, Google), __fixtures__/, __tests__/
scripts/      build-* generators, record-fixtures, worktrees, cockpit/, backup/restore
lab/          experiments beside the site (never imported by it); docs/ history, plans/, tests/, umgang.md
```

## Commands

```bash
npm run dev        # dev server on :3000
npm run test:run   # vitest, single run
npx tsc --noEmit   # type check
npm run build      # must pass before a step is considered done
```
