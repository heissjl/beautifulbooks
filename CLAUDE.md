# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Beautiful Books** is a Next.js 15 web application that allows users to explore different covers and editions of books. The app fetches book data from multiple sources (Open Library, Google Books) and displays beautiful mosaics of book covers for each work.

## Tech Stack

- **Framework**: Next.js 15.1.6 (App Router)
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS
- **Testing**: Vitest
- **Package Manager**: npm

## Project Structure

```
beautifulbooks/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   │   └── search/        # Book search endpoint
│   ├── book/[id]/         # Individual book detail pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page with search
├── components/            # React components
│   ├── BookWorkCard.tsx   # Card displaying a work with edition mosaic
│   ├── CoverMosaic.tsx    # Creates cover mosaic from editions
│   └── SearchResults.tsx  # Search results display
├── lib/                   # Core application logic
│   ├── sources/           # Book data source integrations
│   │   ├── base.ts        # Base types and interfaces
│   │   ├── openlibrary.ts # Open Library API client
│   │   └── google-books.ts# Google Books API client
│   └── normalize.ts       # Data normalization and aggregation
├── scripts/               # Utility scripts
│   └── debug-search.ts    # Debug script for testing search
└── types/                 # TypeScript type definitions
    └── book.ts            # Book-related types
```

## Key Concepts

### Book Data Model

The application uses a normalized data model:

- **Edition**: A specific published version of a book (e.g., "2000 Callaway Editions hardcover")
- **Work**: A conceptual book that groups multiple editions together (e.g., "Mumbo Jumbo by Ishmael Reed")

### Data Sources

1. **Open Library** (`lib/sources/openlibrary.ts`)
   - Primary data source
   - Provides work-level grouping
   - Rich edition metadata
   - Search: `/search.json?q={query}`
   - Work details: `/works/{id}/editions.json`

2. **Google Books** (`lib/sources/google-books.ts`)
   - Secondary/fallback source
   - Good cover images
   - Search: `volumes?q={query}`

### Data Flow

1. User enters search query in `app/page.tsx`
2. Request sent to `app/api/search/route.ts`
3. API route calls multiple sources in parallel
4. `lib/normalize.ts` aggregates and deduplicates results
5. Results grouped by work (same title + author)
6. `SearchResults` component displays work cards
7. Each `BookWorkCard` shows a `CoverMosaic` of edition covers

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Run tests
npm test

# Debug search functionality
npm run debug-search "mumbo jumbo"
```

## Key Files

### Core Logic

- `lib/normalize.ts:1-200` - Aggregates books from multiple sources, groups editions into works
- `lib/sources/openlibrary.ts:1-150` - Open Library API integration
- `app/api/search/route.ts:1-50` - Search API endpoint that orchestrates data fetching

### Components

- `components/CoverMosaic.tsx:1-100` - Creates responsive mosaic layouts (1-4 covers)
- `components/BookWorkCard.tsx:1-72` - Displays work card with mosaic and metadata
- `components/SearchResults.tsx:1-50` - Grid layout for search results

### Pages

- `app/page.tsx:1-100` - Home page with search interface
- `app/book/[id]/page.tsx:1-200` - Individual book detail page with all editions

## Common Development Tasks

### Adding a New Data Source

1. Create new file in `lib/sources/` implementing `BookSource` interface
2. Add source to `lib/normalize.ts` aggregation
3. Handle source-specific data normalization

### Modifying Work Grouping Logic

- Edit `groupEditionsByWork()` in `lib/normalize.ts:50-100`
- Current logic groups by normalized title + first author
- Consider: ISBN families, publisher series, language variations

### Improving Cover Mosaics

- Edit `CoverMosaic.tsx` component
- Current layouts: 1 (full), 2 (split), 3 (grid), 4+ (quad grid)
- Fallback: gradient background for missing covers

### Debugging Search Issues

```bash
# Run debug script to see raw data
npm run debug-search "your query"

# Check browser console for API responses
# Check Network tab for API calls to /api/search
```

## Known Issues & TODOs

1. **Work Grouping**: Currently groups by title+author, which may incorrectly merge different works with similar titles (e.g., multiple books titled "Mumbo Jumbo" by different authors)
2. **Cover Quality**: Some editions lack high-quality cover images
3. **Search Performance**: No caching, every search hits external APIs
4. **Rate Limiting**: No rate limiting on API endpoints
5. **Error Handling**: Limited error boundaries and fallback UI

## Testing

- Test files use Vitest
- Run with `npm test`
- Add tests in `*.test.ts` files next to source files
- Current coverage is minimal - needs expansion

## Deployment

This is a Next.js app that can be deployed to:
- Vercel (recommended)
- Netlify
- Any Node.js hosting platform

Environment variables: None currently required (APIs are public)

## Architecture Decisions

### Why Next.js App Router?

- Server-side rendering for better SEO
- API routes for backend logic
- React 19 features and streaming

### Why Multiple Data Sources?

- Redundancy: If one source is down, others provide data
- Coverage: Different sources have different book catalogs
- Quality: Aggregate best covers and metadata from multiple sources

### Why Client-Side Search State?

- Simple implementation for MVP
- Future: Consider URL state for shareable searches

## Code Style

- TypeScript strict mode
- Functional React components
- Tailwind for styling (utility-first)
- Minimal external dependencies
- Comments for complex logic only

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Open Library API](https://openlibrary.org/dev/docs/api)
- [Google Books API](https://developers.google.com/books/docs/v1/using)
- [Tailwind CSS](https://tailwindcss.com/docs)

## Contributing

When working on this project:
1. Read this entire CLAUDE.md file first
2. Check existing issues and TODOs
3. Test search with various queries before committing
4. Run `npm run build` to catch TypeScript errors
5. Keep components small and focused
