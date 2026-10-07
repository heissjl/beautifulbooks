/**
 * Adds the covers of the thematic collections to the cover game's pool (5.8a, 5.10).
 *
 *   npx tsx scripts/add-collection-covers-to-pool.ts [--add=<slug,slug…>] [--images=<scratch dir>]
 *
 * Which collections: the ones the pool already draws from, plus `--add`
 * (Julian, 2026-09-27: „füge die cover von den collections jai lu, denoel,
 * folio, spektrum, heyne und alle von heinz edelmann dem versus game hinzu").
 * The very first run took every collection but LEFT_OUT.
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
 *
 * **`--keep-earlier`** does the smaller thing: the pool keeps every cover it
 * has and only the `--add` collections are looked at. That is what „add these
 * three series" means, and it is also what spares Open Library: a full run has
 * to look at every collection cover again — 2,884 of them on 2026-10-06, each
 * one an image — because a design signature does not live in the cover index.
 * With `--keep-earlier` a run that adds three series fetches the images of
 * those three and of the pool covers sharing a book with them, and nothing else.
 * What it does not do: bring earlier collections to their live state. A
 * collection Julian has edited online since the last full run keeps the covers
 * the pool holds, votes and all, until a run without this switch.
 *
 * **The signatures are cached** in `data/cover-signatures.json` (2026-10-06),
 * for every cover outside `data/cover-index.json` — the collection covers. The
 * measures were cached since the first run; the signature was not, so each run
 * refetched the lot. Both caches make a run reproducible without the network.
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
/** Design signatures of covers the index does not hold, so a run need not fetch their images again. */
const SIGS_FILE = join(ROOT, 'data', 'cover-signatures.json');
const SUFFIX = '-collections';
/** Left out on Julian's word: author portraits, edition suhrkamp, the Library of America („national library"), and since 2026-09-30 the Suhrkamp BasisBibliothek („entferne die suhrkamp basisbibliothek aus dem spiel"). */
const LEFT_OUT = ['suhrkamp-taschenbuch-author-portraits', 'edition-suhrkamp', 'library-of-america', 'suhrkamp-basisbibliothek', 'rowohlts-monographien'];
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
// COLLECTIONS_FILE: the collections as the site shows them (drafts published on /curate replace the file's
// record), so the game takes Julian's online edits rather than the file's older version (2026-09-30).
const records = (JSON.parse(readFileSync(process.env.COLLECTIONS_FILE ?? join(ROOT, 'data', 'collections.json'), 'utf8')) as { collections: CollectionRecord[] }).collections;
const index = JSON.parse(readFileSync(join(ROOT, 'data', 'cover-index.json'), 'utf8')) as RawIndex;
const measuresFile = JSON.parse(readFileSync(MEASURES_FILE, 'utf8')) as { measuredAt: string; measures: Record<string, CoverMeasure> };
const measures = measuresFile.measures;
/** `id -> [hash, saturation, hues]`, the compact form of a `DesignSignature`. */
type StoredSignature = [string, number, string];
const sigsFile = existsSync(SIGS_FILE)
  ? (JSON.parse(readFileSync(SIGS_FILE, 'utf8')) as { measuredAt: string; signatures: Record<string, StoredSignature> })
  : { measuredAt: '', signatures: {} };

/** Only the `--add` collections are looked at; every cover the pool holds stays. */
const KEEP = process.argv.includes('--keep-earlier');
// A second run starts from the pool as it was before the first, unless it keeps what is there.
const earlierIds = new Set(pool.collections?.ids ?? []);
const base = KEEP ? pool.covers : pool.covers.filter(c => !earlierIds.has(c.id));
const baseName = pool.name.endsWith(SUFFIX) ? pool.name.slice(0, -SUFFIX.length) : pool.name;
const inherits = pool.name.endsWith(SUFFIX) ? (pool.inherits ?? []) : [...(pool.inherits ?? []), pool.name];

/** Design signatures of the pool's covers: from the index, and from the cache for the covers it does not hold. */
const sigOf = new Map<string, DesignSignature>(index.covers.map(row => [row[1], { hash: row[2], saturation: row[5], hues: row[6] }]));
for (const [id, [hash, saturation, hues]] of Object.entries(sigsFile.signatures)) if (!sigOf.has(id)) sigOf.set(id, { hash, saturation, hues });
/** Signatures this run computed, to be written back to the cache. */
const freshSigs = new Map<string, DesignSignature>();

const inPool = new Set(base.map(c => c.id));
const candidates: PoolCover[] = [];
const seen = new Set<string>();
const ADD = (process.argv.find(a => a.startsWith('--add='))?.slice('--add='.length) ?? '').split(',').filter(Boolean);
const earlierFrom = pool.collections?.from;
if (KEEP && ADD.length === 0) throw new Error('--keep-earlier needs --add=<slug,…>: without it there is nothing to look at.');
const wanted = KEEP ? new Set(ADD) : earlierFrom ? new Set([...earlierFrom, ...ADD]) : null;
const from = records.filter(r => (wanted ? wanted.has(r.slug) : !LEFT_OUT.includes(r.slug)) && !LEFT_OUT.includes(r.slug));
for (const slug of ADD) if (!from.some(r => r.slug === slug)) throw new Error(`--add names ${slug}, which is not a collection of this file (or stands in LEFT_OUT).`);
for (const r of from) {
  for (const w of r.works) {
    // A site-served picture (the Jules Verne and Tolkien stopgap) plays under an id naming its file.
    const local = !/^ol:\d+$/.test(w.coverId) && w.image ? `local:${w.image.replace('/collection-covers/', '').replace(/\.jpg$/, '')}` : null;
    const id = local ?? w.coverId;
    if ((!local && !/^ol:\d+$/.test(w.coverId)) || inPool.has(id) || seen.has(id)) continue;
    seen.add(id);
    candidates.push({ id, workId: w.coverWork ?? w.id, title: w.title, author: w.author, ...(local ? { image: w.image } : {}) });
  }
}

let fetched = 0;
const silent = new Set<string>();

async function bytesOf(id: string, image?: string): Promise<Uint8Array | null> {
  if (image) {
    const file = join(ROOT, 'public', image);
    return existsSync(file) ? new Uint8Array(readFileSync(file)) : null;
  }
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
  const bytes = await bytesOf(cover.id, cover.image);
  const image = bytes ? decode(bytes) : null;
  if (!bytes || !image) { silent.add(cover.id); return; }
  if (!cached || cached.blur === undefined) measures[cover.id] = measureCover(image);
  if (!sigOf.has(cover.id)) {
    const sig = signature(bytes, { colour: true });
    if (sig) {
      const design = { hash: sig.hash, saturation: sig.saturation, hues: sig.hues };
      sigOf.set(cover.id, design);
      freshSigs.set(cover.id, design);
    }
  }
}

/** Looks at a list of covers, `CONCURRENCY` at a time, saying where it is. */
async function lookAt(covers: readonly PoolCover[], what: string): Promise<void> {
  let next = 0;
  let done = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < covers.length) {
      await look(covers[next++]);
      if (++done % 50 === 0) console.log(`${what} ${done}/${covers.length}, ${fetched} images fetched, ${silent.size} silent`);
    }
  }));
}

async function main() {
  await lookAt(candidates, 'candidates');
  // A cover of the pool can only fold away a candidate's design if its own signature is known. The
  // index holds the signatures of the covers drawn from it, not those of the collection covers; with
  // `--keep-earlier` those stay in `base`, so the few that share a book with a candidate are looked at.
  const wantedWorks = new Set(candidates.map(c => c.workId));
  const unsigned = base.filter(c => wantedWorks.has(c.workId) && !sigOf.has(c.id));
  if (unsigned.length > 0) {
    console.log(`${unsigned.length} covers the pool already holds share a book with a candidate and have no signature yet`);
    await lookAt(unsigned, 'pool covers');
  }
  writeFileSync(MEASURES_FILE, `${JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), measures: Object.fromEntries(Object.entries(measures).sort(([a], [b]) => a.localeCompare(b))) })}\n`);
  if (freshSigs.size > 0) {
    const signatures: Record<string, StoredSignature> = { ...sigsFile.signatures };
    for (const [id, sig] of freshSigs) signatures[id] = [sig.hash, sig.saturation ?? 0, sig.hues ?? ''];
    writeFileSync(SIGS_FILE, `${JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), signatures: Object.fromEntries(Object.entries(signatures).sort(([a], [b]) => a.localeCompare(b))) })}\n`);
    console.log(`${freshSigs.size} signatures new in the cache, ${Object.keys(signatures).length} in all`);
  }

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
    collections: {
      addedAt: new Date().toISOString().slice(0, 10),
      // `--keep-earlier` adds to what the last run chose instead of replacing it.
      from: KEEP ? [...(earlierFrom ?? []), ...ADD.filter(s => !earlierFrom?.includes(s))] : from.map(r => r.slug),
      leftOut: LEFT_OUT,
      ids: KEEP ? [...earlierIds, ...added.map(c => c.id)] : added.map(c => c.id),
    },
    covers: [...base, ...added],
  };
  writeFileSync(POOL_FILE, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`${out.name}: ${base.length} + ${added.length} from ${from.length} ${KEEP ? 'added' : ''} collections = ${out.covers.length} covers (${out.collections?.from.length} in all)`);
  console.log(`${candidates.length} candidates; left out: ${why.soft} too small or soft, ${why.sameDesign} a design the pool has, ${why.silent} did not answer`);
}

main();
