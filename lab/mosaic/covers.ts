/**
 * The half of a mosaic run that touches the world: which works, which covers,
 * which target picture (lab/mosaic/README.md).
 *
 * Extracted from `render.ts` on 2026-09-09 so that the loading-screen
 * experiment (`lab/loading`) builds its tiles the same way a poster does.
 * There must be exactly one answer to "which covers are this author's", or
 * the two experiments would slowly disagree about it.
 *
 * **No Google Books** (lab/README.md rule 6, E10): every page is loaded with
 * `googleBooks: false`, so a run costs nothing from the 1,000 a day. It does
 * cost Open Library one request per hundred edition records plus one image
 * per cover, which is why both are cached on disk under `out/cache`.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decode, signature, type RgbaImage } from '../../lib/imagehash';
import { looksLikeScannedPage, type ImageSignature } from '../../lib/imagesig';
import type { Cover, Edition } from '../../lib/model';
import { authorMatchKey, looksLikeSecondaryLiterature } from '../../lib/normalize';
import { searchWorks } from '../../lib/sources/openlibrary';
import { fetchBytes } from '../../lib/sources/http';
import { getWorkPage } from '../../lib/work';
import { foldDuplicateCovers } from '../../lib/works';
import { tileOf, type Tile } from './mosaic';

export const CACHE_DIR = path.join('lab', 'mosaic', 'out', 'cache');

/** Where a line of progress goes; silent by default in a library. */
export type Log = (line: string) => void;

export interface WorkRef {
  id: string;
  title: string;
  editionCount: number;
  /** The primary author as Open Library spells it, not as the flag was typed. */
  author: string;
}

/**
 * The works whose covers become tiles.
 *
 * Keeps only the works whose **primary author is that person**, which is what
 * separates Orwell's books from the shelf of books about Orwell; study guides
 * go too. Both filters are the ones the site itself uses, and every work that
 * survives is printed, because a mosaic that quietly included a Cliffs Notes
 * cover would be a small lie about whose book this is.
 */
export async function worksOfAuthor(author: string, maxWorks: number, log: Log = () => {}): Promise<WorkRef[]> {
  /*
    Remembered on disk like the edition pages, and for the same reason: the
    search is the **only** live call a rebuild makes, and on 2026-09-09
    openlibrary.org was unreachable for a quarter of an hour while the covers
    it redirects to answered normally. A build of twenty pictures should not
    depend on that.
  */
  await mkdir(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `author_${author.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${maxWorks}.json`);
  try {
    const cached = JSON.parse(await readFile(file, 'utf8')) as WorkRef[];
    log(`${cached.length} works by ${cached[0]?.author ?? author} (remembered):`);
    for (const w of cached) log(`  ${w.id}  ${w.title} (${w.editionCount} editions)`);
    return cached;
  } catch {
    // Not asked before; ask Open Library.
  }
  const wanted = authorMatchKey(author);
  const found = await searchWorks(author);
  const mine = found
    .filter(w => authorMatchKey(w.authors[0] ?? '') === wanted)
    .filter(w => !looksLikeSecondaryLiterature(w.title))
    .sort((a, b) => (b.editionCount ?? 0) - (a.editionCount ?? 0))
    .slice(0, maxWorks);
  if (mine.length === 0) throw new Error(`no works found whose author is ${author}`);
  log(`${mine.length} works by ${mine[0].authors[0]}:`);
  for (const w of mine) log(`  ${w.id}  ${w.title} (${w.editionCount ?? 0} editions)`);
  const refs = mine.map(w => ({ id: w.id, title: w.title, editionCount: w.editionCount ?? 0, author: w.authors[0] ?? author }));
  await writeFile(file, JSON.stringify(refs));
  return refs;
}

interface WorkCovers { title: string; covers: Cover[]; editions: Edition[] }

/** One page, with a single retry: Open Library times out often enough to matter. */
async function pageWithRetry(workId: string, offset: number) {
  try {
    return await getWorkPage(workId, { offset, googleBooks: false });
  } catch {
    return await getWorkPage(workId, { offset, googleBooks: false });
  }
}

/**
 * Every edition page of one work, Open Library only, remembered on disk.
 *
 * When Open Library stops answering part-way the run keeps the pages it got
 * and **says so**, because a mosaic built from half a book is fine but
 * pretending that half is the whole book is not (the rule in CLAUDE.md: a
 * failure is never a finding). An incomplete work is therefore not written to
 * the cache either, so the next run asks again instead of freezing the gap.
 */
async function workCovers(workId: string, maxPages: number, log: Log): Promise<WorkCovers & { complete: boolean }> {
  const file = path.join(CACHE_DIR, `work_${workId}.json`);
  try {
    return { ...JSON.parse(await readFile(file, 'utf8')) as WorkCovers, complete: true };
  } catch {
    // Not cached yet; ask Open Library.
  }
  const byCover = new Map<string, Cover>();
  const editions: Edition[] = [];
  let offset: number | undefined = 0;
  let title = workId;
  let complete = true;
  for (let page = 0; page < maxPages && offset !== undefined; page++) {
    let loaded;
    try {
      loaded = await pageWithRetry(workId, offset);
    } catch (err) {
      log(`    Open Library stopped answering at page ${page}: ${(err as Error).message}`);
      complete = false;
      break;
    }
    if (!loaded) throw new Error(`no such work: ${workId}`);
    title = loaded.work.title;
    editions.push(...loaded.editions);
    for (const cover of loaded.covers) {
      const seen = byCover.get(cover.id);
      if (!seen) byCover.set(cover.id, { ...cover, editionIds: [...cover.editionIds] });
      else for (const id of cover.editionIds) if (!seen.editionIds.includes(id)) seen.editionIds.push(id);
    }
    offset = loaded.page.nextOffset;
  }
  const result: WorkCovers = { title, covers: [...byCover.values()], editions };
  if (complete) await writeFile(file, JSON.stringify(result));
  return { ...result, complete };
}

/**
 * The cover image, from disk if we have already asked for it.
 *
 * Outside Next there is no data cache, and trying three grids on one book
 * would otherwise download the same few hundred images three times. Open
 * Library redirects covers to archive.org and documents a rate limit, so
 * asking twice for what has not changed is rude as well as slow. The cache
 * lives under `out/`, which is git-ignored; deleting it costs one refetch.
 */
async function coverBytes(cover: Cover): Promise<Uint8Array> {
  const file = path.join(CACHE_DIR, `${cover.id.replace(/[^a-z0-9]/gi, '_')}.img`);
  try {
    return new Uint8Array(await readFile(file));
  } catch {
    const bytes = await fetchBytes(cover.urlSmall ?? cover.url, { timeoutMs: 15_000, revalidate: 0 });
    await writeFile(file, bytes);
    return bytes;
  }
}

/** Downloads with a small pool; a cover that will not load is simply left out. */
async function fetchAll(covers: readonly Cover[], concurrency = 8): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  const queue = [...covers];
  const worker = async () => {
    while (queue.length > 0) {
      const cover = queue.shift()!;
      try {
        out.set(cover.id, await coverBytes(cover));
      } catch {
        // Left out on purpose: a missing cover costs one tile, and stopping
        // the run over it would cost the picture.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, covers.length) }, worker));
  return out;
}

export interface Palette {
  tiles: Tile[];
  images: Map<string, RgbaImage>;
  covers: Cover[];
  signatures: Map<string, ImageSignature>;
  /** How many works could not be loaded in full because Open Library stopped answering. */
  incomplete: number;
}

/** Every usable cover of these works, decoded, folded and reduced to tiles. */
export async function loadPalette(workIds: readonly string[], maxPages = 12, log: Log = () => {}): Promise<Palette> {
  await mkdir(CACHE_DIR, { recursive: true });
  const tiles: Tile[] = [];
  const images = new Map<string, RgbaImage>();
  const signatures = new Map<string, ImageSignature>();
  const covers: Cover[] = [];
  let incomplete = 0;

  for (const workId of workIds) {
    let loaded;
    try {
      loaded = await workCovers(workId, maxPages, log);
    } catch (err) {
      log(`  ${workId}: skipped, Open Library did not answer (${(err as Error).message})`);
      incomplete++;
      continue;
    }
    const { title, covers: workCoverList, editions, complete } = loaded;
    if (!complete) incomplete++;
    const bytes = await fetchAll(workCoverList);
    const sigs = new Map<string, ImageSignature>();
    for (const [id, data] of bytes) {
      const sig = signature(data);
      if (sig) sigs.set(id, sig);
    }
    // One tile per design, not per scan: the same rule the cover wall uses.
    // Folded per work, because the rules compare publisher, ISBN and year of
    // editions, and two different books never share those.
    const folded = foldDuplicateCovers(workCoverList.filter(c => bytes.has(c.id)), sigs, editions);
    const usable = folded.filter(c => !looksLikeScannedPage(sigs.get(c.id)));
    let added = 0;
    for (const cover of usable) {
      if (images.has(cover.id)) continue;
      const image = decode(bytes.get(cover.id)!);
      if (!image) continue;
      images.set(cover.id, image);
      signatures.set(cover.id, sigs.get(cover.id)!);
      covers.push(cover);
      tiles.push(tileOf(cover.id, image));
      added++;
    }
    log(`  ${title}: ${workCoverList.length} covers, ${folded.length} designs, ${added} tiles${complete ? '' : ' (partial)'}`);
  }
  if (tiles.length === 0) throw new Error('no covers loaded; Open Library answered nothing');
  return { tiles, images, covers, signatures, incomplete };
}

/**
 * The picture the covers have to add up to.
 *
 * `auto` takes the most contrasted jacket at full size — deliberately
 * refetched rather than reused from the tiles, whose medium images are six
 * pixels per cell and would leave the target a blur.
 */
export async function targetImage(
  option: string,
  covers: readonly Cover[],
  signatures: ReadonlyMap<string, ImageSignature>,
): Promise<{ image: RgbaImage; what: string }> {
  let bytes: Uint8Array;
  let what: string;
  if (option === 'auto') {
    // **Contrast decides**, not how many editions carry it. Picking by
    // edition count on Nineteen Eighty-Four chose a jacket whose luminance
    // spans 57 to 90 of 255 (measured 2026-09-08): a nearly flat picture, and
    // a mosaic of it is a wall of covers with no motif in it. A target has to
    // have light and dark.
    const ranked = [...covers]
      .filter(c => (signatures.get(c.id)?.contrast ?? 0) > 0)
      .sort((a, b) => (signatures.get(b.id)!.contrast) - (signatures.get(a.id)!.contrast));
    const best = ranked[0];
    if (!best) throw new Error('no covers to pick a target from');
    bytes = await fetchBytes(best.url, { timeoutMs: 15_000, revalidate: 0 });
    what = `${best.id} (the most contrasted jacket, contrast ${Math.round(signatures.get(best.id)!.contrast)})`;
  } else if (/^https?:/.test(option)) {
    bytes = await fetchBytes(option, { timeoutMs: 20_000, revalidate: 0 });
    what = option;
  } else {
    bytes = new Uint8Array(await readFile(option));
    what = option;
  }
  const image = decode(bytes);
  if (!image) throw new Error(`could not decode the target picture: ${what}`);
  return { image, what };
}
