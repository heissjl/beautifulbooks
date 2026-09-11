/**
 * Freezes the cover game's pool into data/versus-pool.json (ROADMAP 5.8a).
 *
 *   npx tsx scripts/build-versus-pool.ts
 *
 * Frozen rather than built per request: the votes in the store name covers,
 * and a pool that shifted with the next build of the index would orphan them.
 * Built data in the repository, read-only at run time — allowed by E18.
 *
 * One cover from each of two hundred books, minus the covers a person has
 * already judged not to be covers. A book that loses its cover that way gets
 * another of its own.
 *
 * **It measures, since 2026-09-11.** A mix takes only covers sharp enough to
 * be shown large (`sharpEnough` in lib/hotornot/pool.ts), and the index holds
 * no pixel sizes. So this script fetches Open Library's L image of each cover
 * in exactly the order `mixCandidates` tries them, until the book has one that
 * passes, and keeps every size in data/cover-sizes.json: a second run measures
 * only what is new and draws the same pool. A cover that did not answer is not
 * written down — a silent archive.org is not a small image — and is tried
 * again on the next run.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverUrlFor } from '../lib/coverurl';
import { decode } from '../lib/imagehash';
import {
  MAX_ASPECT, MIN_ASPECT, MIN_HEIGHT, buildPool, mixCandidates, poolName, sharpEnough,
  type CoverSize, type MixOptions, type PoolCover, type RawIndex,
} from '../lib/hotornot/pool';

const ROOT = join(import.meta.dirname, '..');
const SIZES_FILE = join(ROOT, 'data', 'cover-sizes.json');
/** Books measured at once. archive.org is slow, not fast; a few at a time is polite. */
const CONCURRENCY = 4;
const TIMEOUT_MS = 40_000;

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
];

const POOL_FILE = join(ROOT, 'data', 'versus-pool.json');
const base: MixOptions = { mode: 'mix', size: 200, seed: 'paperwhite', exclude: EXCLUDED.map(e => e.id) };
const index = JSON.parse(readFileSync(join(ROOT, 'data', 'cover-index.json'), 'utf8')) as RawIndex;

/**
 * A pool under the same name grows, it is not drawn again: the votes in the
 * store name its covers. The first `mix-200-paperwhite` went online with 139
 * books while the index was still being built for the rest.
 */
const earlier = existsSync(POOL_FILE) ? (JSON.parse(readFileSync(POOL_FILE, 'utf8')) as { name: string; covers: PoolCover[] }) : null;
const options: MixOptions = earlier?.name === poolName(base) ? { ...base, keep: earlier.covers.map(c => c.id) } : base;

interface SizesFile {
  measuredAt: string;
  sizes: Record<string, CoverSize>;
}
const sizes: Record<string, CoverSize> = existsSync(SIZES_FILE)
  ? (JSON.parse(readFileSync(SIZES_FILE, 'utf8')) as SizesFile).sizes
  : {};
const silent: string[] = [];
let fetched = 0;

function save() {
  const sorted = Object.fromEntries(Object.entries(sizes).sort(([a], [b]) => a.localeCompare(b)));
  const file: SizesFile = { measuredAt: new Date().toISOString().slice(0, 10), sizes: sorted };
  writeFileSync(SIZES_FILE, `${JSON.stringify(file)}\n`);
}

async function measure(id: string): Promise<CoverSize | null> {
  const url = coverUrlFor(id, 'L');
  if (!url) return null;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'image/*', 'User-Agent': 'beautifulbooks/versus-pool (measuring cover sizes)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const image = decode(new Uint8Array(await res.arrayBuffer()));
    return image ? [image.width, image.height] : null;
  } catch {
    return null;
  }
}

/** Walks one book's covers in the pool's order until one is sharp enough. */
async function settle(covers: readonly PoolCover[]) {
  for (const cover of covers) {
    if (!(cover.id in sizes)) {
      const size = await measure(cover.id);
      fetched++;
      if (size) sizes[cover.id] = size;
      else silent.push(cover.id);
    }
    if (sharpEnough(sizes[cover.id])) return;
  }
}

async function main() {
  const books = mixCandidates(index, options);
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < books.length) {
      await settle(books[next++]);
      if (++done % 20 === 0) {
        save();
        console.log(`${done}/${books.length} books, ${fetched} images fetched, ${silent.length} silent`);
      }
    }
  }));
  save();

  const covers = buildPool(index, { ...options, sizes });
  const out = {
    name: poolName(options),
    builtAt: new Date().toISOString().slice(0, 10),
    indexBuiltAt: index.builtAt,
    quality: {
      minHeight: MIN_HEIGHT,
      aspect: [MIN_ASPECT, MAX_ASPECT],
      plain: 'looksPlain in lib/hotornot/pool.ts',
    },
    excluded: EXCLUDED,
    covers,
  };
  writeFileSync(POOL_FILE, `${JSON.stringify(out, null, 1)}\n`);
  const kept = options.keep ?? [];
  if (kept.length > 0) {
    const stayed = kept.filter(id => covers.some(c => c.id === id)).length;
    console.log(`Grown from the earlier ${out.name}: ${stayed} of its ${kept.length} covers kept.`);
  }

  const measured = books.flat().filter(c => c.id in sizes);
  const sharp = measured.filter(c => sharpEnough(sizes[c.id])).length;
  console.log(`${out.name}: ${covers.length} covers from ${new Set(covers.map(c => c.workId)).size} books `
    + `(${books.length} books had a playable cover; ${sharp} of ${measured.length} measured covers sharp enough; `
    + `${silent.length} did not answer), ${EXCLUDED.length} excluded`);
  if (covers.length < options.size) console.log(`Only ${covers.length} of ${options.size}: the index has too few books with a sharp cover.`);
}

main();
