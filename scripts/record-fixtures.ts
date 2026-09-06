/**
 * Records API responses for the acceptance queries in SPEC.md §3 F1 into
 * lib/__fixtures__/<slug>/. Tests run against these files, never against the
 * live APIs.
 *
 * Run: npx tsx scripts/record-fixtures.ts [slug ...]
 *
 * Open Library search responses are trimmed via the `fields` parameter.
 * Editions responses are reduced to the fields the app reads (see
 * EDITION_FIELDS) because the raw entries are large and mostly irrelevant.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const QUERIES: { slug: string; query: string; expectAuthor: string }[] = [
  { slug: 'mumbo-jumbo', query: 'mumbo jumbo', expectAuthor: 'Reed' },
  { slug: '1984', query: '1984', expectAuthor: 'Orwell' },
  { slug: 'gravitys-rainbow', query: "gravity's rainbow", expectAuthor: 'Pynchon' },
  { slug: 'the-great-gatsby', query: 'the great gatsby', expectAuthor: 'Fitzgerald' },
  { slug: 'pride-and-prejudice', query: 'pride and prejudice', expectAuthor: 'Austen' },
];

const OL_SEARCH_FIELDS = [
  'key', 'title', 'subtitle', 'author_name', 'author_key', 'first_publish_year',
  'edition_count', 'cover_i', 'cover_edition_key', 'language', 'subject',
].join(',');

const EDITION_FIELDS = [
  'key', 'title', 'subtitle', 'authors', 'works', 'publishers', 'publish_date',
  'languages', 'isbn_10', 'isbn_13', 'covers', 'number_of_pages', 'physical_format',
];

const TIMEOUT_MS = 90_000;
const OUT_DIR = path.join(process.cwd(), 'lib', '__fixtures__');

async function getJson(url: string): Promise<unknown> {
  const started = Date.now();
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'beautifulbooks-fixture-recorder (dev)' },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const json = await res.json();
  console.log(`  ${Date.now() - started} ms  ${url}`);
  return json;
}

async function getJsonWithRetry(url: string, attempts = 3): Promise<unknown> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await getJson(url);
    } catch (err) {
      lastErr = err;
      const wait = 2000 * 2 ** i;
      console.warn(`  retry in ${wait} ms: ${(err as Error).message}`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function pick<T extends object>(obj: T, fields: string[]): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f in obj) out[f] = (obj as Record<string, unknown>)[f];
  }
  return out as Partial<T>;
}

async function record({ slug, query, expectAuthor }: (typeof QUERIES)[number]) {
  console.log(`\n== ${slug} ("${query}")`);
  const dir = path.join(OUT_DIR, slug);
  await mkdir(dir, { recursive: true });

  const olSearch = (await getJson(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=20&fields=${OL_SEARCH_FIELDS}`,
  )) as { docs: Array<{ key: string; author_name?: string[]; edition_count?: number }> };
  await writeFile(path.join(dir, 'openlibrary-search.json'), JSON.stringify(olSearch, null, 2));

  // Google Books rate-limits unauthenticated clients aggressively (HTTP 429).
  // A failure here is logged and skipped so the Open Library fixtures still land.
  try {
    const key = process.env.GOOGLE_BOOKS_API_KEY ? `&key=${process.env.GOOGLE_BOOKS_API_KEY}` : '';
    const gbSearch = (await getJsonWithRetry(
      `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(query)}&maxResults=20&printType=books&orderBy=relevance${key}`,
    )) as { totalItems?: number; items?: Array<{ id: string; volumeInfo: unknown; saleInfo?: unknown }> };
    const gbTrimmed = {
      totalItems: gbSearch.totalItems,
      items: (gbSearch.items ?? []).map(i => ({ id: i.id, volumeInfo: i.volumeInfo, saleInfo: i.saleInfo })),
    };
    await writeFile(path.join(dir, 'googlebooks-search.json'), JSON.stringify(gbTrimmed, null, 2));
  } catch (err) {
    console.warn(`  Google Books skipped: ${(err as Error).message}`);
  }

  // Editions of the primary work: first doc whose author matches, else the
  // doc with the most editions.
  const docs = olSearch.docs ?? [];
  const primary =
    docs.find(d => d.author_name?.some(a => a.includes(expectAuthor))) ??
    docs.slice().sort((a, b) => (b.edition_count ?? 0) - (a.edition_count ?? 0))[0];
  if (!primary) {
    console.warn('  no primary work found, skipping editions');
    return;
  }
  const workId = primary.key.replace('/works/', '');
  const editions = (await getJson(
    `https://openlibrary.org/works/${workId}/editions.json?limit=100`,
  )) as { size?: number; entries: object[] };
  const trimmed = {
    workId,
    size: editions.size,
    entries: editions.entries.map(e => pick(e, EDITION_FIELDS)),
  };
  await writeFile(path.join(dir, 'openlibrary-editions.json'), JSON.stringify(trimmed, null, 2));
  console.log(`  primary work ${workId}, ${trimmed.entries.length} editions recorded`);
}

async function main() {
  const only = new Set(process.argv.slice(2));
  for (const q of QUERIES) {
    if (only.size && !only.has(q.slug)) continue;
    try {
      await record(q);
    } catch (err) {
      console.error(`  FAILED ${q.slug}:`, err);
    }
  }
}

main();
