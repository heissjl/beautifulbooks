# Beautiful Books

A visual book search: type a title, get one card per book with a mosaic of its covers. Open a book to see the editions those catalogues have a cover for, grouped by language, with metadata and purchase links.

Data comes from [Open Library](https://openlibrary.org/developers/api) (primary) and [Google Books](https://developers.google.com/books) (supplementary covers and descriptions).

**Status:** live since 2026-09-08 at https://beautifulcovers.vercel.app, in hobby mode. What the site is: [SPEC.md](SPEC.md). What it can do today: [docs/features.md](docs/features.md). What remains, in order, with links to everything else: [ROADMAP.md](ROADMAP.md). What was built and measured: [docs/history.md](docs/history.md). The detailed plans: [docs/plans/README.md](docs/plans/README.md). Which session works on what: `npm run worktrees`.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Vitest.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run test:run   # unit tests
npm run build      # type-check and production build
```

Copy `.env.example` to `.env.local` (git-ignored) and fill in what you have. Without any of it the app runs on Open Library alone, except that the legal pages (`/contact`, `/privacy`) refuse to render until the `IMPRINT_*` values are set — a legal notice with blank lines is worse than an error.

| Variable | Purpose |
|---|---|
| `GOOGLE_BOOKS_API_KEY` | Enables Google Books as a cover source. Without a key the shared anonymous quota is used, which is exhausted most of the time (HTTP 429). Use a second key for development so a working session cannot spend the production quota (ROADMAP.md 0.2). |
| `NEXT_PUBLIC_SITE_URL` | Absolute origin of the deployment for canonical URLs, sitemap and Open Graph image. |
| `NEXT_PUBLIC_SITE_MODE` | `hobby` (default when unset) or `shop`, see below. Any other value fails the build. |
| `IMPRINT_NAME`, `IMPRINT_STREET`, `IMPRINT_CITY`, `IMPRINT_EMAIL` | Name, address and e-mail for the legal notice and the privacy notice. Read on the server only; never in the repository. |
| `AFFILIATE_AMAZON_TAG_US`, `_UK`, `_DE`, `AFFILIATE_BOOKSHOP_ID_US`, `_UK` | Affiliate parameters for purchase links, per market (SPEC.md §2.4, ROADMAP.md phase 4). Ignored unless `NEXT_PUBLIC_SITE_MODE=shop`. |
| `DEBUG` | Any value enables request logging in `lib/`. |

### Hobby and shop mode

The public site runs in **hobby mode** (SPEC.md E20, `docs/plans/PLAN-2-mvp-hobby.md`): the retailer links are there but neutral — affiliate variables are ignored even if set — the availability check is off, and no page says a link can earn anything. **Shop mode** turns those on; it runs locally or on a preview deployment until the full legal notice and a commercial hosting plan are in place. One code, one variable; `main` is production and is hobby.

### Getting a Google Books API key

The Books API is free; the key only identifies your project so you get your own quota: 1,000 requests per day. There is no self-service way to raise it (the "adjustable" path ends in the Google Search help pages); the last untried route is enabling billing, see ROADMAP.md 0.3.

1. Open https://console.cloud.google.com/ and sign in with a Google account.
2. Create a project (top bar, project picker, "New project"), e.g. `beautifulbooks`.
3. In that project go to "APIs & Services" > "Library", search for **Books API**, open it and click **Enable**.
4. Go to "APIs & Services" > "Credentials" > "Create credentials" > **API key**. Copy the key.
5. Recommended: click the key, under "API restrictions" choose "Restrict key" and select only **Books API**. Leave "Application restrictions" on "None" (the key is used server-side only).
6. Create `.env.local` in the project root with `GOOGLE_BOOKS_API_KEY=<your key>` and restart `npm run dev`.
7. Record the missing fixtures: `npx tsx scripts/record-fixtures.ts`.

No billing account is needed for the Books API.

## License

MIT
