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

No environment variables are required for local development. Affiliate IDs for purchase links are read from the environment when present (see SPEC.md §8.3).

## License

MIT
