# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Read this first

**[SPEC.md](SPEC.md) is the source of truth.** It defines the product, the domain model (Work / Edition), the functional requirements with acceptance queries, the decisions already taken, the implementation plan, and the roadmap. Do not re-derive any of that from the code. If code and spec disagree, the spec wins unless the user says otherwise.

The spec is written in German; code, comments, commit messages and this file are English (decision E7).

## Current state (2026-09-06)

The UI layer (`app/`, `components/`) is kept. The data layer (`lib/`) is being rewritten according to SPEC.md §7. Until that rewrite lands:

- `lib/aggregator.ts` and `lib/sources/legacy-*.ts` are the **old** implementation. They fetch external APIs from the browser and fan out one editions request per search result. Do not extend them; replace them per the spec.
- New, spec-conformant modules (steps 2–3, done): `lib/model.ts`, `lib/normalize.ts`, `lib/works.ts`, `lib/debug.ts`, `lib/sources/http.ts`, `lib/sources/openlibrary.ts` (+ `-parse.ts`), `lib/sources/googlebooks.ts` (+ `-parse.ts`). The `legacy-*.ts` clients exist only for the old aggregator and go away in step 5. Tests in `lib/__tests__/` run against fixtures in `lib/__fixtures__/`, recorded with `npx tsx scripts/record-fixtures.ts`.
- Google Books fixtures are missing: the unauthenticated API answered HTTP 429 (daily quota) at recording time. Set `GOOGLE_BOOKS_API_KEY` and re-run the recorder to add them.
- `scripts/debug-mumbo.ts` is a throwaway probe of the old aggregator.

Progress is tracked by the numbered steps in SPEC.md §7. Check `git log` to see which step was completed last.

## Facts about the APIs that the old code got wrong

- Open Library `/works/{id}/editions.json` returns `authors` as `[{ key: '/authors/OL…A' }]`, **not names**. Reading `a.name` yields `undefined` for every edition. Author names for editions must be taken from the work, not from the edition.
- Open Library search `author_name` contains duplicates and translators; only the first entry is the primary author.
- Google Books has no work concept. Its results must be matched to an Open Library work by normalized title + primary author and must never create a work of their own (decision E5).
- Open Library regularly takes 2–7 s for a search and 3–10 s for an editions page from Germany, occasionally much longer. Every external call needs a timeout and a cache (§4 N3, N4); the values live in `OL_TIMEOUTS`.

## Layout

```
app/                Next.js App Router pages and API routes
  api/search/       search endpoint (to become the only search entry point)
  book/[id]/        detail page (to be switched from edition ID to work ID)
components/         React components, Tailwind; reusable as-is
lib/                data layer (being rewritten, target layout in SPEC.md §7)
  sources/          Open Library and Google Books clients
types/              shared TypeScript types
scripts/            ad-hoc probes, not part of the build
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
