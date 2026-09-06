# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Read this first

**[SPEC.md](SPEC.md) is the source of truth.** It defines the product, the domain model (Work / Edition), the functional requirements with acceptance queries, the decisions already taken, the implementation plan, and the roadmap. Do not re-derive any of that from the code. If code and spec disagree, the spec wins unless the user says otherwise.

The spec is written in German; code, comments, commit messages and this file are English (decision E7).

## Current state (2026-09-06)

The data layer was rewritten per SPEC.md §7; the old aggregator and legacy clients are gone (step 5). The UI talks only to `/api/search` and `/api/works/[id]`; external APIs are called server-side only.

- Cover model (E8, step 6, done): `Cover` is its own entity in `lib/model.ts`; `assembleEditions` in `lib/works.ts` merges same-ISBN editions but never drops a cover. ISBN != cover: reprints change the cover under the same ISBN, so never dedupe by ISBN alone and never promise a cover at a purchase link.
- Cover dedupe (E8 phase 2, done): `lib/imagehash.ts` (dHash + contrast, pure) and `lib/coverhash.ts` (fetch small images with a 4 s budget, Next cache 30 d) feed `foldDuplicateCovers` in `lib/works.ts`; identical scans fold into one cover with `similarIds`. Pass `dedupeCovers: false` in tests that mock fetch with JSON.
- Spec-conformant modules (steps 2–5, done): `lib/model.ts`, `lib/normalize.ts`, `lib/works.ts`, `lib/debug.ts`, `lib/sources/http.ts`, `lib/sources/openlibrary.ts` (+ `-parse.ts`), `lib/sources/googlebooks.ts` (+ `-parse.ts`), `lib/search.ts` (search orchestration, two external calls), `lib/work.ts` (detail page orchestration). `lib/market.ts` detects the market (US/UK/DE, decision E9) from an explicit choice, country header or Accept-Language; `lib/buylinks.ts` holds the retailer table per market (`buyLinksFor`, needs an ISBN; Amazon gets `/dp/<ISBN-10>`) and `searchLinksFor` (works without an ISBN: title searches, reverse image search, catalogues). Affiliate env variables carry the market suffix, e.g. `AFFILIATE_AMAZON_TAG_US`. Tests in `lib/__tests__/` run against fixtures in `lib/__fixtures__/`, recorded with `npx tsx scripts/record-fixtures.ts`.
- Fixtures cover both sources. Re-record with `GOOGLE_BOOKS_API_KEY` set in `.env.local` (`set -a; source .env.local; set +a; npx tsx scripts/record-fixtures.ts`). Never commit the key; fixtures contain no URLs with keys.
- UI state rules: the URL is the source of truth for search state (`/?q=&lang=`) and for the selected cover on the detail page (`/book/<id>?q=&lang=&cover=`); components derive loading state from a request key instead of setting state inside effects (the `react-hooks/set-state-in-effect` lint rule is an error in this repo).

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
  api/works/[id]/   GET ?lang=     -> WorkDetailResponse (lib/work.ts + buy links)
  book/[id]/        detail page, id = Open Library work id
components/         React components, Tailwind
lib/                data layer, layout in SPEC.md §7; types in lib/model.ts
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
