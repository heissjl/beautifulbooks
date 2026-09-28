/**
 * Records Open Library's answer to the "More by …" search (ROADMAP 6.53) for
 * the author keys measured in docs/plans/PLAN-6.53-other-works.md §4.1, into
 * lib/__fixtures__/authors/<key>.json. Tests read these files and never ask
 * Open Library themselves.
 *
 * Run: npx tsx scripts/record-author-fixtures.ts [OL…A ...]
 *
 * The URL is built by the same function the site uses (`authorWorksUrl`), so
 * a fixture is exactly what the route would have been sent. No Google Books.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { authorWorksUrl } from '../lib/sources/openlibrary';

const AUTHORS: { key: string; name: string }[] = [
  { key: 'OL27349A', name: 'F. Scott Fitzgerald' },
  { key: 'OL31353A', name: 'Ursula K. Le Guin' },
  { key: 'OL33146A', name: 'Franz Kafka' },
  { key: 'OL52922A', name: 'Margaret Atwood' },
  { key: 'OL498120A', name: 'Harper Lee' },
  { key: 'OL27626A', name: 'Ishmael Reed' },
  // Reed's second key: measured as scatter, kept to prove the row stays empty.
  { key: 'OL11412010A', name: 'Ishmael Reed (second key)' },
  { key: 'OL151749A', name: 'Margaret Mitchell' },
];

const OUT_DIR = path.join(process.cwd(), 'lib', '__fixtures__', 'authors');

async function main() {
  const only = new Set(process.argv.slice(2));
  await mkdir(OUT_DIR, { recursive: true });
  for (const a of AUTHORS) {
    if (only.size && !only.has(a.key)) continue;
    const url = authorWorksUrl(a.key);
    const started = Date.now();
    const res = await fetch(url, {
      signal: AbortSignal.timeout(60_000),
      headers: { 'User-Agent': 'beautifulbooks-fixture-recorder (dev)' },
    });
    if (!res.ok) {
      console.error(`${a.key} ${a.name}: HTTP ${res.status}`);
      continue;
    }
    const body = (await res.json()) as { numFound?: number; docs?: unknown[] };
    await writeFile(
      path.join(OUT_DIR, `${a.key}.json`),
      JSON.stringify({ numFound: body.numFound, docs: body.docs ?? [] }, null, 2) + '\n',
    );
    console.log(`${String(Date.now() - started).padStart(5)} ms  ${a.key}  ${a.name}: ${body.docs?.length ?? 0} of ${body.numFound} docs`);
  }
}

main();
