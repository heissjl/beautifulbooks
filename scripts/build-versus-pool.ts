/**
 * Freezes the cover game's pool into data/versus-pool.json (ROADMAP 5.8a).
 *
 *   npx tsx scripts/build-versus-pool.ts
 *
 * Frozen rather than built per request: the votes in the store name covers,
 * and a pool that shifted with the next build of the index would orphan them.
 * Built data in the repository, read-only at run time — allowed by E18.
 *
 * **A thousand covers from 239 books** since 2026-09-11 (Julian: "mach dann
 * eine version mit 1000 covers"): up to `PER_BOOK` distinct designs of each
 * book, every book its first before any its second. It grew from the 200-book
 * pool, whose covers come first where they still pass, and whose votes count
 * on its board (`inherits`).
 *
 * **It measures.** A mix takes only covers that fit the game (`fitsGame` in
 * lib/hotornot/pool.ts: sharp enough, not mostly white, not a classic Reclam),
 * and the index holds none of that. So this script fetches Open Library's L
 * image of each cover in exactly the order `mixCandidates` tries them, until
 * the book has `PER_BOOK` that fit, and keeps every measure in
 * data/cover-measures.json: a second run fetches only what is new. A cover that
 * did not answer is not written down — a silent archive.org is not a small
 * image — and is tried again on the next run.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverUrlFor } from '../lib/coverurl';
import { decode } from '../lib/imagehash';
import {
  MAX_ASPECT, MAX_WHITE, MIN_ASPECT, MIN_HEIGHT, RECLAM_CONTRAST, RECLAM_YELLOW, buildPool, fitsGame, mixCandidates, poolName,
  type MixOptions, type PoolCover, type RawIndex,
} from '../lib/hotornot/pool';
import { measureCover, type CoverMeasure } from '../lib/hotornot/quality';

const ROOT = join(import.meta.dirname, '..');
const MEASURES_FILE = join(ROOT, 'data', 'cover-measures.json');
const POOL_FILE = join(ROOT, 'data', 'versus-pool.json');
/** Images fetched at once. archive.org is slow, not fast; a few at a time is polite. */
const CONCURRENCY = 6;
const TIMEOUT_MS = 40_000;
const PER_BOOK = 5;
/** Pools this one grew from; their votes and reports count on its board. */
const INHERITS = ['mix-200-paperwhite'];

const EXCLUDED = [
  {
    id: 'ol:10942061',
    reason: 'A Slaughterhouse-Five reading guide with "Note: This is not the actual book cover" printed on it; '
      + 'taken out with the "not a cover" button in the lab test, 2026-09-11.',
  },
  // The four below were seen on the contact sheet of the 61 books the pool grew by, 2026-09-11.
  {
    id: 'ol:13524082',
    reason: 'The Scarlet Letter: a plain placeholder with "Note: This is not the actual book cover" printed on it.',
  },
  {
    id: 'ol:13569803',
    reason: 'The Moonstone: the same kind of placeholder, "Note: This is not the actual book cover".',
  },
  {
    id: 'ol:6352405',
    reason: 'The Woman in White: a page of text from inside the book, not its cover.',
  },
  {
    id: 'ol:14051611',
    reason: 'The Song of Achilles: a merchandise photo of the book beside a tote bag, not the cover itself.',
  },
  {
    id: 'ol:6287717',
    reason: 'Filed under Jane Eyre: a theatre poster ("UR ASAMLET", a Hamlet staging), seen on the standings, 2026-09-11.',
  },
  // Seen on the five contact sheets of the 1000-cover pool, 2026-09-11. Two placeholder templates a
  // seller generated, and flat boards with nothing on them. None of the rules can tell: they are sharp,
  // coloured and not white.
  ...['8770513', '13909028', '13204626'].map(n => ({
    id: `ol:${n}`,
    reason: 'A generated placeholder: title in a box on dark blue, "COVER COMING SOON".',
  })),
  // The last two found by dHash distance ≤ 12 to the ones above; the same search also hit a designed
  // Song of Solomon, so it is a way to look, not a rule.
  ...['8812382', '14260867', '10158974', '13822747', '11556120', '13284909', '13256006'].map(n => ({
    id: `ol:${n}`,
    reason: 'A generated placeholder: title in a box on a flat colour, "Note: This is not the actual book cover".',
  })),
  ...['15122901', '12290731', '12618705', '9327737', '12917662', '13320765', '9442803'].map(n => ({
    id: `ol:${n}`,
    reason: 'A flat board of one colour with nothing on it.',
  })),
];

const base: MixOptions = { mode: 'mix', size: 1000, seed: 'paperwhite', perBook: PER_BOOK, exclude: EXCLUDED.map(e => e.id) };
const name = poolName(base);
const index = JSON.parse(readFileSync(join(ROOT, 'data', 'cover-index.json'), 'utf8')) as RawIndex;
const contrastOf = new Map(index.covers.map(row => [row[1], row[3]]));

/** A pool grows from itself or from the pool it inherits: its covers are taken first. */
const earlier = existsSync(POOL_FILE) ? (JSON.parse(readFileSync(POOL_FILE, 'utf8')) as { name: string; covers: PoolCover[] }) : null;
const keep = earlier && (earlier.name === name || INHERITS.includes(earlier.name)) ? earlier.covers.map(c => c.id) : [];
const options: MixOptions = { ...base, keep };

interface MeasuresFile {
  measuredAt: string;
  measures: Record<string, CoverMeasure>;
}
const measures: Record<string, CoverMeasure> = existsSync(MEASURES_FILE)
  ? (JSON.parse(readFileSync(MEASURES_FILE, 'utf8')) as MeasuresFile).measures
  : {};
const silent = new Set<string>();
let fetched = 0;

function save() {
  const sorted = Object.fromEntries(Object.entries(measures).sort(([a], [b]) => a.localeCompare(b)));
  const file: MeasuresFile = { measuredAt: new Date().toISOString().slice(0, 10), measures: sorted };
  writeFileSync(MEASURES_FILE, `${JSON.stringify(file)}\n`);
}

async function measure(id: string): Promise<void> {
  if (id in measures) return;
  const url = coverUrlFor(id, 'L');
  if (!url) return;
  fetched++;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'image/*', 'User-Agent': 'beautifulbooks/versus-pool (measuring covers)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const image = res.ok ? decode(new Uint8Array(await res.arrayBuffer())) : null;
    if (image) measures[id] = measureCover(image);
    else silent.add(id);
  } catch {
    silent.add(id);
  }
}

const fits = (cover: PoolCover) => fitsGame(measures[cover.id], contrastOf.get(cover.id) ?? 0);

/** Walks one book's covers in the pool's order until `PER_BOOK` fit. */
async function settle(covers: readonly PoolCover[]) {
  let fitting = 0;
  for (const cover of covers) {
    await measure(cover.id);
    if (fits(cover) && ++fitting >= PER_BOOK) return;
  }
}

async function inParallel<T>(items: readonly T[], work: (item: T) => Promise<void>, label: string) {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) {
      await work(items[next++]);
      if (++done % 25 === 0) {
        save();
        console.log(`${label}: ${done}/${items.length}, ${fetched} images fetched, ${silent.size} silent`);
      }
    }
  }));
  save();
}

async function main() {
  await inParallel(keep, measure, 'kept covers');
  const books = mixCandidates(index, options);
  await inParallel(books, settle, 'books');

  const covers = buildPool(index, { ...options, measures });
  const out = {
    name,
    builtAt: new Date().toISOString().slice(0, 10),
    indexBuiltAt: index.builtAt,
    inherits: INHERITS,
    perBook: PER_BOOK,
    quality: {
      minHeight: MIN_HEIGHT,
      aspect: [MIN_ASPECT, MAX_ASPECT],
      maxWhite: MAX_WHITE,
      reclam: { yellow: RECLAM_YELLOW, contrast: RECLAM_CONTRAST },
      plain: 'looksPlain in lib/hotornot/pool.ts',
    },
    excluded: EXCLUDED,
    covers,
  };
  writeFileSync(POOL_FILE, `${JSON.stringify(out, null, 1)}\n`);

  const perWork = new Map<string, number>();
  for (const c of covers) perWork.set(c.workId, (perWork.get(c.workId) ?? 0) + 1);
  const spread = [1, 2, 3, 4, 5].map(k => `${k}: ${[...perWork.values()].filter(n => n === k).length}`).join(', ');
  const stayed = keep.filter(id => covers.some(c => c.id === id)).length;
  const measured = books.flat().filter(c => c.id in measures);
  console.log(`${name}: ${covers.length} covers from ${perWork.size} books (books by covers brought — ${spread})`);
  console.log(`${stayed} of ${keep.length} covers of the earlier pool kept; ${measured.filter(fits).length} of ${measured.length} measured candidates fit; `
    + `${silent.size} did not answer; ${EXCLUDED.length} excluded by hand`);
  if (covers.length < options.size) console.log(`Only ${covers.length} of ${options.size}: too few covers fit.`);
}

main();
