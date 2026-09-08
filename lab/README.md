# lab/ — experiments beside the website

Decided 2026-09-08 (ROADMAP 0.11, proposal in [docs/plans/PLAN-struktur.md](../docs/plans/PLAN-struktur.md)). Things that need the project's data, fixtures and context but are **not the website**: a video clip built from a cover wall, a measurement of another catalogue, a rendering experiment.

Rules, also in CLAUDE.md:

1. **One folder per experiment**, with a `README.md` that says which question it answers, how success is recognised, and where it stands.
2. **`lab/` may import from `lib/`. `app/`, `components/`, `lib/` and `scripts/` never import from `lab/`.** An ESLint `no-restricted-imports` rule enforces this, not discipline.
3. **Run with `npx tsx lab/<name>/<script>.ts`.** Dependencies go into the root `package.json` as `devDependencies`; one lockfile for everything. Only an experiment with heavy dependencies (Remotion, Puppeteer) gets its own `package.json`, and that is the moment the root becomes a workspace root — not before.
4. **Tests under `lab/<name>/__tests__/`**; Vitest picks them up without configuration. As everywhere: no network in tests, fixtures from `lib/__fixtures__/`.
5. **`lab/` is exempt from the roadmap's phase order**, because it is not the website. But every experiment has a line in ROADMAP.md, and nothing from `lab/` reaches the website without going through the roadmap: promotion to `scripts/` or `app/` is its own item with a measurement.
6. **No Google Books from `lab/`** without a measurement (E10): the key is the site's key and the 1,000 requests a day are shared. Scripts run with `googleBooks: false`.
7. **No scratch files in the repository root.** Working files live in `lab/<name>/` or in the session's scratchpad; `/scratch-*` is git-ignored.

Experiments:

| Folder | Question | Roadmap | Status |
|---|---|---|---|
| `video/` | Can a 15-second clip of a book's covers be built from the data alone? Storyboard pure and tested, render via ffmpeg. | 5.5 | not started; plan in PLAN-struktur §4 |
| `mosaic/` | Can one picture — a shadowy motif — be built from a book's covers as tiles, good enough for Instagram or Pinterest? Assignment pure and tested, render with pngjs. | 5.5 | not started; plan in [mosaic/README.md](mosaic/README.md) |
