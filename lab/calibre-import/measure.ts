/**
 * Step 1 of the import: how many books of the Calibre library find their work
 * at Open Library? (lab/calibre-import, ROADMAP 5.17)
 *
 *   npx tsx lab/calibre-import/measure.ts                  # the whole library
 *   npx tsx lab/calibre-import/measure.ts --sample 40      # and 40 matches to check by hand
 *   npx tsx lab/calibre-import/measure.ts --library <folder> --limit 20
 *
 * Reads the library (never writes it), asks Open Library three questions at a
 * time and never Google, and keeps every answer on disk — a second run asks
 * only what is missing, and a book the catalogue was silent about is asked
 * again. Prints the numbers PLAN-5.17 §2 wants and writes `assignments.json`
 * beside the cache for the review page (`serve.ts`).
 *
 * Nothing here is written into the repository: the files hold the list of
 * Julian's books.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findLibrary, readLibrary, type CalibreBook } from '../calibre/library';
import { assignAll, report, sample } from './assign';
import { Catalogue, DiskCache, stateDir } from './lookup';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};

async function main(): Promise<void> {
  const library = findLibrary(flag('library'));
  const limit = Number(flag('limit')) || Infinity;
  const books: CalibreBook[] = readLibrary(library).slice(0, limit);
  const dir = stateDir(library);
  mkdirSync(dir, { recursive: true });
  const cache = new DiskCache(join(dir, 'cache.json'));
  const catalogue = new Catalogue(cache);

  const started = Date.now();
  const assignments = await assignAll(books, catalogue, (_, done) => {
    if (done % 10 === 0 || done === books.length) process.stderr.write(`\r${done} of ${books.length}, ${catalogue.asked} requests`);
  });
  cache.flush();
  process.stderr.write('\n');
  writeFileSync(join(dir, 'assignments.json'), JSON.stringify({ library, measuredAt: new Date().toISOString(), assignments }, null, 1));

  console.log(report(assignments));
  console.log(`${catalogue.asked} requests to Open Library in this run, ${Math.round((Date.now() - started) / 1000)} s`);
  console.log(`kept in ${dir}`);

  const n = Number(flag('sample'));
  if (n > 0) {
    const byId = new Map(books.map((b) => [b.id, b]));
    console.log(`\n${n} matches, drawn with a fixed seed — is the work on the right the book on the left?`);
    for (const a of sample(assignments.filter((x) => x.status === 'match'), n, Number(flag('seed')) || 517)) {
      const b = byId.get(a.bookId);
      console.log(`  #${a.bookId} ${b?.title} — ${b?.authors.join('; ')}\n      → ${a.tile?.title} — ${a.tile?.author ?? '?'}  [${a.reason}] https://openlibrary.org/works/${a.tile?.workId}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
