/**
 * Adds the covers of the thematic collections to the cover game's pool (5.8a, 5.10).
 *
 *   npx tsx scripts/add-collection-covers-to-pool.ts [--images=<scratch dir>]
 *
 * Julian, 2026-09-26: „nimm die cover der collections (außer suhrkamp autoren,
 * edition suhrkamp, national library) mit in das versus game". The pool stays
 * frozen (see scripts/build-versus-pool.ts); this appends to it under a new
 * name that inherits the old one, so every vote cast so far still counts.
 *
 * What a collection cover must bring:
 *
 *   - **an Open Library image** (`ol:`): the site-served stopgap images of
 *     Jules Verne and Tolkien have no route the game can show them through;
 *   - **sharp enough to be shown large** (`sharpEnough`) and **crisp**
 *     (`crispEnough`), measured on the L image like every cover the pool adds;
 *   - **not a design the pool already has** for the same work (`sameJacket`).
 *
 * The whiteness and Reclam rules of `fitsGame` are not applied: those guard a
 * random draw from the index against title pages, and every collection cover
 * was chosen by eye. A Poésie/Gallimard cover is white by design.
 *
 * Run again after a collection changes: the covers this script added last time
 * are taken out and chosen afresh, the measures are cached.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { coverUrlFor } from '../lib/coverurl';
import { decode, signature } from '../lib/imagehash';
import type { CollectionRecord } from '../lib/collections';
import { crispEnough, sameJacket, sharpEnough, type DesignSignature, type PoolCover, type RawIndex } from '../lib/hotornot/pool';
import { measureCover, type CoverMeasure } from '../lib/hotornot/quality';

const ROOT = join(import.meta.dirname, '..');
const POOL_FILE = join(ROOT, 'data', 'versus-pool.json');
const MEASURES_FILE = join(ROOT, 'data', 'cover-measures.json');
const SUFFIX = '-collections';
/** Left out on Julian's word: author portraits, edition suhrkamp, and the Library of America („national library"). */
const LEFT_OUT = ['suhrkamp-taschenbuch-author-portraits', 'edition-suhrkamp', 'library-of-america'];
const CONCURRENCY = 4;
const TIMEOUT_MS = 40_000;

const IMAGES = process.argv.find(a => a.startsWith('--images='))?.slice('--images='.length);
if (IMAGES) mkdirSync(IMAGES, { recursive: true });

interface PoolFile {
  name: string;
  inherits?: string[];
  covers: PoolCover[];
  collections?: { addedAt: string; from: string[]; leftOut: string[]; ids: string[] };
  [key: string]: unknown;
}

const pool = JSON.parse(readFileSync(POOL_FILE, 'utf8')) as PoolFile;
const records = (JSON.parse(readFileSync(join(ROOT, 'data', 'collections.json'), 'utf8')) as { collections: CollectionRecord[] }).collections;
const index = JSON.parse(readFileSync(join(ROOT, 'data', 'cover-index.json'), 'utf8')) as RawIndex;
const measuresFile = JSON.parse(readFileSync(MEASURES_FILE, 'utf8')) as { measuredAt: string; measures: Record<string, CoverMeasure> };
const measures = measuresFile.measures;

// A second run starts from the pool as it was before the first.
const earlierIds = new Set(pool.collections?.ids ?? []);
const base = pool.covers.filter(c => !earlierIds.has(c.id));
const baseName = pool.name.endsWith(SUFFIX) ? pool.name.slice(0, -SUFFIX.length) : pool.name;
const inherits = pool.name.endsWith(SUFFIX) ? (pool.inherits ?? []) : [...(pool.inherits ?? []), pool.name];

/** Design signatures of the pool's covers, from the index. */
const sigOf = new Map<string, DesignSignature>(index.covers.map(row => [row[1], { hash: row[2], saturation: row[5], hues: row[6] }]));

const inPool = new Set(base.map(c => c.id));
const candidates: PoolCover[] = [];
const seen = new Set<string>();
const from = records.filter(r => !LEFT_OUT.includes(r.slug));
for (const r of from) {
  for (const w of r.works) {
    if (!/^ol:\d+$/.test(w.coverId) || inPool.has(w.coverId) || seen.has(w.coverId)) continue;
    seen.add(w.coverId);
    candidates.push({ id: w.coverId, workId: w.coverWork ?? w.id, title: w.title, author: w.author });
  }
}

let fetched = 0;
const silent = new Set<string>();

async function bytesOf(id: string): Promise<Uint8Array | null> {
  const file = IMAGES ? join(IMAGES, `${id.replace(':', '_')}.jpg`) : null;
  if (file && existsSync(file)) return new Uint8Array(readFileSync(file));
  const url = coverUrlFor(id, 'L');
  if (!url) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 5000 * attempt * attempt));
    fetched++;
    try {
      const res = await fetch(url, { headers: { Accept: 'image/*', 'User-Agent': 'beautifulbooks/versus-pool (measuring covers)' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 404) return null;
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (file) writeFileSync(file, bytes);
      return bytes;
    } catch {
      // Try again.
    }
  }
  return null;
}

async function look(cover: PoolCover): Promise<void> {
  const cached = measures[cover.id];
  const needBytes = !cached || cached.blur === undefined || !sigOf.has(cover.id);
  if (!needBytes) return;
  const bytes = await bytesOf(cover.id);
  const image = bytes ? decode(bytes) : null;
  if (!bytes || !image) { silent.add(cover.id); return; }
  if (!cached || cached.blur === undefined) measures[cover.id] = measureCover(image);
  if (!sigOf.has(cover.id)) {
    const sig = signature(bytes, { colour: true });
    if (sig) sigOf.set(cover.id, { hash: sig.hash, saturation: sig.saturation, hues: sig.hues });
  }
}

async function main() {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < candidates.length) {
      await look(candidates[next++]);
      if (++done % 50 === 0) console.log(`${done}/${candidates.length}, ${fetched} images fetched, ${silent.size} silent`);
    }
  }));
  writeFileSync(MEASURES_FILE, `${JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), measures: Object.fromEntries(Object.entries(measures).sort(([a], [b]) => a.localeCompare(b))) })}\n`);

  const byWork = new Map<string, DesignSignature[]>();
  for (const c of base) {
    const sig = sigOf.get(c.id);
    if (sig) byWork.set(c.workId, [...(byWork.get(c.workId) ?? []), sig]);
  }
  const added: PoolCover[] = [];
  const why = { soft: 0, silent: 0, sameDesign: 0 };
  for (const c of candidates) {
    const m = measures[c.id];
    if (!m) { why.silent++; continue; }
    if (!sharpEnough(m) || !crispEnough(m)) { why.soft++; continue; }
    const sig = sigOf.get(c.id);
    const others = byWork.get(c.workId) ?? [];
    if (sig && others.some(o => sameJacket(o, sig))) { why.sameDesign++; continue; }
    added.push(c);
    if (sig) byWork.set(c.workId, [...others, sig]);
  }

  const out: PoolFile = {
    ...pool,
    name: `${baseName}${SUFFIX}`,
    builtAt: new Date().toISOString().slice(0, 10),
    inherits,
    collections: { addedAt: new Date().toISOString().slice(0, 10), from: from.map(r => r.slug), leftOut: LEFT_OUT, ids: added.map(c => c.id) },
    covers: [...base, ...added],
  };
  writeFileSync(POOL_FILE, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`${out.name}: ${base.length} + ${added.length} from ${from.length} collections = ${out.covers.length} covers`);
  console.log(`${candidates.length} candidates; left out: ${why.soft} too small or soft, ${why.sameDesign} a design the pool has, ${why.silent} did not answer`);
}

main();
