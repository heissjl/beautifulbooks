# Beautiful Books

A visual book search: type a title, get one card per book with a mosaic of its covers. Open a book to see every edition, grouped by language, with metadata and purchase links.

Data comes from [Open Library](https://openlibrary.org/developers/api) (primary) and [Google Books](https://developers.google.com/books) (supplementary covers and descriptions).

**Status:** the data layer is being rewritten. See [SPEC.md](SPEC.md) for the full specification, the findings on the previous implementation, and the roadmap.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Vitest.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run test:run   # unit tests
npm run build      # type-check and production build
```

No environment variables are required for local development; without them the app runs on Open Library alone. Optional variables, put them in `.env.local` (git-ignored):

| Variable | Purpose |
|---|---|
| `GOOGLE_BOOKS_API_KEY` | Enables Google Books as a cover source. Without a key the shared anonymous quota is used, which is exhausted most of the time (HTTP 429). |
| `AFFILIATE_BOOKSHOP_ID`, `AFFILIATE_AMAZON_TAG`, `AFFILIATE_ABEBOOKS_ID` | Affiliate parameters for purchase links (SPEC.md §8.3). |
| `DEBUG` | Any value enables request logging in `lib/`. |

### Getting a Google Books API key

The Books API is free; the key only identifies your project so you get your own quota (1,000 requests per day by default, more on request).

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
