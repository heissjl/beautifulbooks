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
 * Since 2026-10-20 each row carries the image's aspect as an eighth, optional
 * column (ROADMAP 6.70b, `lib/coverindexrow.ts`): the image is decoded anyway.
 * Rows built before that lack it, and `--fill-aspect` adds it without a
 * rebuild — first from the game's measures (`data/cover-measures.json`, no
 * request), then from Open Library's cover record, which states a scan's size
 * in about 0.18 s without the scan (docs/umgang.md §1). One request at a
 * time, a pause between, written every 250 rows, and it stops at the first
 * refused connection, 403 or 429. `--offline` takes the measures only;
 * `--limit=N` asks at most N records; `--pause-ms=N` (default 500).
 *
 * Usage:
 *   npx tsx scripts/build-cover-index.ts [--max-pages=N] [--force] [--only=OL123W]
 *   npx tsx scripts/build-cover-index.ts --fill-aspect [--offline] [--limit=N] [--pause-ms=N]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { signature } from '../lib/imagehash';
import { getWorkPage } from '../lib/work';
import { OL_EDITIONS_PAGE } from '../lib/sources/openlibrary';
import type { Cover } from '../lib/model';
import type { IndexWork } from './pick-index-works';
import { aspectOf, fillAspects, rowAspect, type CoverRow } from '../lib/coverindexrow';

const WORKS_FILE = path.join(process.cwd(), 'data', 'index-works.json');
const INDEX_FILE = path.join(process.cwd(), 'data', 'cover-index.json');

const MEASURES_FILE = path.join(process.cwd(), 'data', 'cover-measures.json');

/** Rows are arrays, not objects: 25.000 objects with keys weigh several times more. */
export type WorkRow = [id: string, title: string, author: string];
export type { CoverRow };

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
const FILL_ASPECT = process.argv.includes('--fill-aspect');
const OFFLINE = process.argv.includes('--offline');
const LIMIT = arg('limit') === undefined ? Infinity : Number(arg('limit'));
const PAUSE_MS = Number(arg('pause-ms') ?? 500);

function load(): CoverIndexFile {
  if (!FORCE && existsSync(INDEX_FILE)) return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
  return { builtAt: new Date().toISOString().slice(0, 10), works: [], covers: [] };
}

function save(index: CoverIndexFile) {
  index.builtAt = new Date().toISOString().slice(0, 10);
  write(index);
}

/** Without touching `builtAt`: filling a column does not make the snapshot newer. */
function write(index: CoverIndexFile) {
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

/**
 * One image, with retries. On 2026-09-26 archive.org answered a third of the
 * image requests of 71 works in a row with errors, within seconds, and the
 * same images loaded fine a few minutes later; without a retry those works
 * went into the index with a third of their covers. Three tries with a
 * growing pause turn a throttled minute into a slow one.
 */
const failures = new Map<string, number>();

async function imageWithRetry(url: string): Promise<Uint8Array | null> {
  let why = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(5000 * attempt * attempt);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      why = String(res.status);
      if (res.status === 404) break;
    } catch (err) {
      why = (err as Error).name;
    }
  }
  failures.set(why, (failures.get(why) ?? 0) + 1);
  return null;
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
      // A cover that will not load is simply absent; the index never
      // pretends to know an image it could not read.
      const bytes = await imageWithRetry(cover.urlSmall ?? cover.url);
      const sig = bytes ? signature(bytes, { colour: true }) : null;
      if (sig?.hues && sig.saturation !== undefined && sig.mean !== undefined) {
        const row: CoverRow = [
          workIndex, cover.id, sig.hash,
          Math.round(sig.contrast), Math.round(sig.mean), sig.saturation, sig.hues,
        ];
        if (sig.aspect !== undefined) row.push(sig.aspect);
        rows.push(row);
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
    const lost = [...failures].map(([why, n]) => `${n}× ${why}`).join(', ');
    failures.clear();
    console.log(`${String(rows.length).padStart(4)} von ${String(covers.length).padStart(4)} Covern gehasht  (${Math.round((Date.now() - t0) / 1000)} s)${lost ? `  nicht geladen: ${lost}` : ''}`);
  }

  const minutes = Math.round((Date.now() - startedAt) / 60000);
  const kb = Math.round(readFileSync(INDEX_FILE).length / 1024);
  console.log(`\nFertig in ${minutes} min: ${index.works.length} Werke, ${index.covers.length} Cover, ${kb} KB.`);
}

/** Whether Open Library has shut the door: stop asking, as docs/umgang.md §1 says. */
function refused(err: unknown): boolean {
  for (let e: unknown = err, depth = 0; e && depth < 6; depth++) {
    const x = e as { code?: unknown; cause?: unknown };
    if (x.code === 'ECONNREFUSED') return true;
    e = x.cause;
  }
  return false;
}

/** The aspect column for rows built before it existed (6.70b), without a rebuild. */
async function fillAspectMain() {
  const index = load();
  const missing = () => index.covers.filter(r => rowAspect(r) === undefined).length;
  console.log(`${index.covers.length} Cover im Index, ${missing()} ohne Seitenverhältnis.`);

  if (existsSync(MEASURES_FILE)) {
    const { measures } = JSON.parse(readFileSync(MEASURES_FILE, 'utf8')) as {
      measures: Record<string, { width: number; height: number }>;
    };
    const n = fillAspects(index.covers, id => (measures[id] ? aspectOf(measures[id].width, measures[id].height) : null));
    console.log(`Aus den Maßen des Spiels: ${n}.`);
    if (n > 0) write(index);
  }
  if (OFFLINE) {
    console.log(`Offline: ${missing()} bleiben ohne.`);
    return;
  }

  const todo = index.covers.filter(r => rowAspect(r) === undefined && /^ol:\d+$/.test(r[1])).slice(0, LIMIT);
  console.log(`Frage ${todo.length} Cover-Datensätze, einen nach dem anderen, ${PAUSE_MS} ms Pause `
    + `(geschätzt ${Math.round((todo.length * (180 + PAUSE_MS)) / 60000)} min).`);
  const startedAt = Date.now();
  const skipped = new Map<string, number>();
  let asked = 0;
  let filled = 0;
  for (const row of todo) {
    if (asked > 0) await sleep(PAUSE_MS);
    asked++;
    let why = '';
    try {
      const res = await fetch(`https://covers.openlibrary.org/b/id/${row[1].slice(3)}.json`, { signal: AbortSignal.timeout(15_000) });
      if (res.status === 403 || res.status === 429) {
        console.log(`\nOpen Library antwortet ${res.status}: angehalten.`);
        break;
      }
      if (res.ok) {
        const { width, height } = await res.json() as { width?: number; height?: number };
        const aspect = aspectOf(width ?? 0, height ?? 0);
        if (aspect !== null) {
          row.push(aspect);
          filled++;
        } else why = 'ohne Größe';
      } else why = String(res.status);
    } catch (err) {
      if (refused(err)) {
        console.log('\nVerbindung verweigert: angehalten (docs/umgang.md §1).');
        break;
      }
      why = (err as Error).name;
    }
    if (why) skipped.set(why, (skipped.get(why) ?? 0) + 1);
    if (asked % 250 === 0) {
      write(index);
      process.stdout.write(`    ${asked}/${todo.length}, ${Math.round((Date.now() - startedAt) / 60000)} min\r`);
    }
  }
  write(index);
  const lost = [...skipped].map(([why, n]) => `${n}× ${why}`).join(', ');
  console.log(`\n${filled} von ${asked} gefragten Covern bekamen ein Seitenverhältnis in ${Math.round((Date.now() - startedAt) / 1000)} s`
    + `${lost ? `; ohne: ${lost}` : ''}. ${missing()} bleiben ohne.`);
}

if (FILL_ASPECT) fillAspectMain();
else main();
