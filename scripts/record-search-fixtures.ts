/**
 * Records Open Library's answers for the search overhaul (ROADMAP 6.60,
 * docs/plans/PLAN-search-2026-09.md) into lib/__fixtures__/search/responses.json,
 * keyed by the exact URL the site sends. Tests read that file and never ask
 * Open Library themselves.
 *
 * Run: npx tsx scripts/record-search-fixtures.ts
 *
 * The URLs are built by the functions the site uses (`searchUrl`,
 * `authorLookupUrl`, `authorWorksUrl`), and the author searches follow the
 * site's own pick (`pickAuthor`), so the fixture is what a request would have
 * sent. Requests are spaced 1.2 s apart. No Google Books.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pickAuthor } from '../lib/authorsearch';
import { authorLookupUrl, authorWorksUrl, searchUrl, type OlAuthorDoc } from '../lib/sources/openlibrary';

/** Typos and what the correction turns them into; both sides are recorded. */
const TEXT_QUERIES = [
  'gatsbee', 'gatsby',
  'pride and prejudise', 'pride and prejudice',
  'Tolkein', 'Tolkien',
  'Hemmingway', 'Hemingway',
  'harry poter',
  'piranesi',
];

/** Names typed in the author mode, and the typos among them. */
const AUTHOR_NAMES = ['Harper Lee', 'George Orwell', 'Margaret Mitchell', 'Dostojewski', 'Tolkein', 'Tolkien'];

const OUT_FILE = path.join(process.cwd(), 'lib', '__fixtures__', 'search', 'responses.json');
const responses: Record<string, unknown> = {};

async function get(url: string): Promise<unknown> {
  if (url in responses) return responses[url];
  await new Promise(r => setTimeout(r, 1200));
  const started = Date.now();
  const res = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    headers: { 'User-Agent': 'beautifulbooks-fixture-recorder (dev)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = (await res.json()) as { numFound?: number; docs?: unknown[] };
  responses[url] = { numFound: body.numFound, docs: body.docs ?? [] };
  console.log(`${String(Date.now() - started).padStart(5)} ms  ${body.docs?.length ?? 0} docs  ${decodeURIComponent(url.split('?')[1].split('&')[0])}`);
  return responses[url];
}

async function main() {
  for (const q of TEXT_QUERIES) await get(searchUrl(q));
  for (const name of AUTHOR_NAMES) {
    const body = (await get(authorLookupUrl(name))) as { docs: OlAuthorDoc[] };
    const author = pickAuthor(body.docs);
    if (author) await get(authorWorksUrl(author.keys));
  }
  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(responses, null, 1) + '\n');
  console.log(`${Object.keys(responses).length} responses → ${OUT_FILE}`);
}

main();
