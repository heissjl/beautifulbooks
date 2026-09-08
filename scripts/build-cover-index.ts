/**
 * Builds the cover index (PLAN-speicher §3.4, ROADMAP 6.10).
 *
 * Reads data/index-works.json, walks every edition page of each work, hashes
 * each cover with colour, and writes data/cover-index.json. Run by hand, the
 * result committed — the same pattern as scripts/record-fixtures.ts.
 *
 * Three properties it must keep:
 *
 * 1. **No Google.** `googleBooks: false` throughout. A run over fifty works
 *    would otherwise spend fifty of the thousand daily requests (E10), and
 *    the index has no use for Google's editions anyway.
 * 2. **Polite.** Open Library takes 3-10 s per edition page. Works are walked
 *    one at a time and images fetched a few at a time; a run takes half an
 *    hour or more and that is correct, not a defect.
 * 3. **Resumable.** The file is written after every work. A run that dies in
 *    the fortieth minute keeps thirty-nine minutes of work, and a second run
 *    skips what is already there unless --force is given.
 *
 * Usage:
 *   npx tsx scripts/build-cover-index.ts [--max-pages=N] [--force] [--only=OL123W]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { signature } from '../lib/imagehash';
import { getWorkPage } from '../lib/work';
import { OL_EDITIONS_PAGE } from '../lib/sources/openlibrary';
import type { Cover } from '../lib/model';
import type { IndexWork } from './pick-index-works';

const WORKS_FILE = path.join(process.cwd(), 'data', 'index-works.json');
const INDEX_FILE = path.join(process.cwd(), 'data', 'cover-index.json');

/** Rows are arrays, not objects: 25.000 objects with keys weigh several times more. */
export type WorkRow = [id: string, title: string, author: string];
export type CoverRow = [
  work: number, cover: string, hash: string,
  contrast: number, mean: number, saturation: number, hues: string,
];

export interface CoverIndexFile {
  builtAt: string;
  works: WorkRow[];
  covers: CoverRow[];
}

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const MAX_PAGES = Number(arg('max-pages') ?? 8);
const FORCE = process.argv.includes('--force');
const ONLY = arg('only');
const IMAGE_CONCURRENCY = 6;

function load(): CoverIndexFile {
  if (!FORCE && existsSync(INDEX_FILE)) return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  return { builtAt: new Date().toISOString().slice(0, 10), works: [], covers: [] };
}

function save(index: CoverIndexFile) {
  index.builtAt = new Date().toISOString().slice(0, 10);
  writeFileSync(INDEX_FILE, JSON.stringify(index) + '\n');
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * One edition page, with retries.
 *
 * Open Library times out often enough to matter — measured on 2026-09-07,
 * four of fourteen cold searches ran into the cap — and the first run of this
 * script lost nine of fifty works to a single slow page each. Three tries
 * with a growing pause turn that from a lost work into a slow one.
 */
async function pageWithRetry(workId: string, offset: number) {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await getWorkPage(workId, { offset, googleBooks: false });
    } catch (err) {
      last = err;
      await sleep(1500 * (attempt + 1));
    }
  }
  throw last;
}

/**
 * Every cover of a work, across its edition pages.
 *
 * A page that keeps failing ends the walk but **keeps what came before**: a
 * partial wall is worth indexing, and the index says of itself that it is a
 * snapshot. Only a work whose very first page fails is skipped entirely.
 */
async function coversOf(workId: string): Promise<Cover[]> {
  const covers = new Map<string, Cover>();
  let offset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    let result;
    try {
      result = await pageWithRetry(workId, offset);
    } catch (err) {
      if (page === 0) throw err;
      process.stdout.write(`(Seite ${page} gab auf, ${covers.size} Cover behalten) `);
      break;
    }
    if (!result) break;
    for (const cover of result.covers) covers.set(cover.id, cover);
    if (result.page.nextOffset === undefined) break;
    offset = result.page.nextOffset;
    if (offset % OL_EDITIONS_PAGE !== 0) break;
  }
  return [...covers.values()];
}

/** Signatures with colour, a few images at a time, no deadline. */
async function hashAll(covers: readonly Cover[], workIndex: number): Promise<CoverRow[]> {
  const rows: CoverRow[] = [];
  const queue = [...covers];
  let done = 0;

  const worker = async () => {
    for (;;) {
      const cover = queue.shift();
      if (!cover) return;
      try {
        const res = await fetch(cover.urlSmall ?? cover.url, { signal: AbortSignal.timeout(15_000) });
        if (res.ok) {
          const sig = signature(new Uint8Array(await res.arrayBuffer()), { colour: true });
          if (sig?.hues && sig.saturation !== undefined && sig.mean !== undefined) {
            rows.push([
              workIndex, cover.id, sig.hash,
              Math.round(sig.contrast), Math.round(sig.mean), sig.saturation, sig.hues,
            ]);
          }
        }
      } catch {
        // A cover that will not load is simply absent; the index never
        // pretends to know an image it could not read.
      }
      if (++done % 25 === 0) process.stdout.write(`    ${done}/${covers.length}\r`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, covers.length) }, worker));
  return rows;
}

async function main() {
  const { works } = JSON.parse(readFileSync(WORKS_FILE, 'utf8')) as { works: IndexWork[] };
  const index = load();
  const known = new Set(index.works.map(w => w[0]));
  const todo = works.filter(w => (ONLY ? w.id === ONLY : !known.has(w.id)));

  console.log(`${works.length} Werke in der Liste, ${known.size} schon im Index, ${todo.length} zu tun.`);
  console.log(`Höchstens ${MAX_PAGES} Ausgabenseiten je Werk (${MAX_PAGES * OL_EDITIONS_PAGE} Datensätze).\n`);

  const startedAt = Date.now();
  for (const [n, work] of todo.entries()) {
    const t0 = Date.now();
    process.stdout.write(`[${n + 1}/${todo.length}] ${work.title.slice(0, 38)} … `);
    let covers: Cover[];
    try {
      covers = await coversOf(work.id);
    } catch (err) {
      console.log(`Quelle schwieg: ${(err as Error).message}`);
      continue;
    }
    const workIndex = index.works.length;
    index.works.push([work.id, work.title, work.author]);
    const rows = await hashAll(covers, workIndex);
    index.covers.push(...rows);
    save(index);
    console.log(`${String(rows.length).padStart(4)} von ${String(covers.length).padStart(4)} Covern gehasht  (${Math.round((Date.now() - t0) / 1000)} s)`);
  }

  const minutes = Math.round((Date.now() - startedAt) / 60000);
  const kb = Math.round(readFileSync(INDEX_FILE).length / 1024);
  console.log(`\nFertig in ${minutes} min: ${index.works.length} Werke, ${index.covers.length} Cover, ${kb} KB.`);
}

main();
