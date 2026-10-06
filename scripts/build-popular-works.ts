/**
 * Builds the list of the most-read works on Open Library (ROADMAP 5.18a).
 *
 *   npx tsx scripts/build-popular-works.ts [--pages=10]
 *
 * Writes data/popular-works.json; commit the result. One request per hundred
 * works, **one at a time with a pause**: on 2026-10-04 Open Library refused
 * every connection from this machine after two sessions had asked in bulk
 * (CLAUDE.md). A refused connection ends the run and writes nothing — half a
 * list under the name of the whole one would be a failure reported as a
 * finding (N12). Never Google Books (E10); why not, in lib/popularworks.ts.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { popularFromDocs, type PopularDoc, type PopularFile } from '../lib/popularworks';
import { userAgent } from '../lib/seo';

const PAGES = Number(process.argv.find(a => a.startsWith('--pages='))?.split('=')[1] ?? 10);
const PER_PAGE = 100;
const PAUSE_MS = 4000;
const FIELDS = 'key,title,author_name,cover_i,first_publish_year,edition_count,already_read_count,readinglog_count,ratings_count';
/** `*:*` is every work; the search refuses a query shorter than three characters. */
const QUERY = `https://openlibrary.org/search.json?q=*:*&sort=already_read&limit=${PER_PAGE}&fields=${FIELDS}`;
const OUT_FILE = path.join(process.cwd(), 'data', 'popular-works.json');

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const docs: PopularDoc[] = [];
  for (let page = 1; page <= PAGES; page++) {
    const started = Date.now();
    const res = await fetch(`${QUERY}&page=${page}`, { headers: { 'user-agent': userAgent() }, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`Open Library answered ${res.status} on page ${page}; nothing written.`);
    const body = (await res.json()) as { docs?: PopularDoc[] };
    const got = body.docs ?? [];
    docs.push(...got);
    console.log(`Seite ${page}/${PAGES}: ${got.length} Werke in ${((Date.now() - started) / 1000).toFixed(1)} s`);
    if (got.length < PER_PAGE) break;
    if (page < PAGES) await sleep(PAUSE_MS);
  }
  const works = popularFromDocs(docs);
  const file: PopularFile = { builtAt: new Date().toISOString().slice(0, 10), query: QUERY, works };
  writeFileSync(OUT_FILE, JSON.stringify(file, null, 1) + '\n');
  console.log(`\n${docs.length} Treffer, ${works.length} Werke in data/popular-works.json (ohne Cover, ohne Autor oder doppelt: ${docs.length - works.length}).`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
