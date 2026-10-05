/**
 * Does the fold hide larger scans of a chosen cover? (lab/calibre, ROADMAP 5.16a)
 *
 *   npx tsx lab/calibre/measure-fold.ts <curated slug>     # the covers of a collection that have a book in Calibre
 *   npx tsx lab/calibre/measure-fold.ts --work OL17417W    # one work: every group the fold would make, first scan against largest
 *
 * Julian, 2026-10-03, after the app found scans of 2813 × 4536 where the
 * collection's covers were 310 × 500: „macht unsere faltung hier probleme,
 * dass wir dadurch nicht die großen cover finden?" A collection names one
 * cover id per work, and the site's fold keeps the first scan of a design it
 * meets, not the largest. This measures, for every cover of a collection
 * that has a sure book in the Calibre library: how many other scans of the
 * same design the work has (dHash distance ≤ 8, the fold's unconditional
 * tier), and how large the largest of them is.
 *
 * **Run it once, not in a loop, and not beside another script that asks Open
 * Library.** On 2026-10-04, after two runs of this measurement and a parallel
 * session's own, openlibrary.org refused every connection from this Mac
 * (`ECONNREFUSED`, the Internet Archive's block for an address that asked too
 * much). Requests to the catalogue are therefore one at a time with a pause.
 *
 * Reads the library, writes nothing. Open Library only: the editions of each
 * work, a medium image per cover for the hash, and the full image of the
 * same-design ones for their size (cached in cover-sizes.json).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickCovers } from './covers';
import { CoverSizes } from './download';
import { imageSizeFast } from './image';
import { coverFile, findLibrary, readLibrary } from './library';
import { matchPicks } from './match';
import { defaultBackupRoot } from './safety';
import { getEditionsPage, getWork, hamming, parseEditions, signature, userAgent } from './site';
import { curatedRecords, picksFromCurated } from './source';

const SITE = 'https://buyitscovers.com';
/** The fold's unconditional tier (SAME_COVER_MAX_DISTANCE in lib/works.ts). */
const SAME_IMAGE = 8;
/** The loosest tier, which the site applies only with matching colours (SAME_DESIGN_MAX_DISTANCE): counted here to see what lies just beyond. */
const NEAR = 13;
const MAX_PAGES = 3;
/** Between two requests to the catalogue (not the image host, which is not rate-limited by cover id). */
const PAUSE_MS = 1500;
const pause = () => new Promise((r) => setTimeout(r, PAUSE_MS));

async function hashOf(coverId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://covers.openlibrary.org/b/id/${coverId.slice(3)}-M.jpg?default=false`, { headers: { 'user-agent': userAgent(SITE) }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    return signature(new Uint8Array(await res.arrayBuffer()))?.hash ?? null;
  } catch {
    return null;
  }
}

async function inBatches<T, R>(items: readonly T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
  return out;
}

async function coversOfWork(workId: string): Promise<{ ids: string[]; editions: number }> {
  const work = await getWork(workId);
  if (!work) return { ids: [], editions: 0 };
  const ids = new Set<string>();
  let editions = 0;
  for (let offset = 0; offset < MAX_PAGES * 100; offset += 100) {
    await pause();
    const page = await getEditionsPage(workId, offset);
    editions = page.size;
    for (const c of pickCovers(parseEditions(page.entries, work))) ids.add(c.coverId);
    if (offset + 100 >= page.size) break;
  }
  return { ids: [...ids], editions };
}

/** One work as the fold sees it: greedy groups in arrival order, the first scan standing for the group. */
async function oneWork(workId: string): Promise<void> {
  const sizes = new CoverSizes(join(defaultBackupRoot(), 'cover-sizes.json'), SITE);
  const { ids, editions } = await coversOfWork(workId);
  const hashes = await inBatches(ids, 6, hashOf);
  const groups: { rep: string; hash: string; members: string[] }[] = [];
  ids.forEach((id, at) => {
    const hash = hashes[at];
    if (!hash) return;
    const group = groups.find((g) => hamming(g.hash, hash) <= SAME_IMAGE);
    if (group) group.members.push(id);
    else groups.push({ rep: id, hash, members: [id] });
  });
  const area = (z: { width: number; height: number } | null) => (z ? z.width * z.height : 0);
  let folded = 0;
  let hidden = 0;
  for (const g of groups.filter((x) => x.members.length > 1)) {
    const measured = await inBatches(g.members, 4, async (id) => ({ id, size: await sizes.get(id) }));
    const rep = measured[0];
    const best = measured.slice().sort((a, b) => area(b.size) - area(a.size))[0];
    folded++;
    const larger = area(best.size) > area(rep.size) * 1.1;
    if (larger) hidden++;
    console.log(`${g.members.length} scans · shown ${rep.size ? `${rep.size.width}×${rep.size.height}` : '?'} (${rep.id}) · largest ${best.size ? `${best.size.width}×${best.size.height}` : '?'} (${best.id})${larger ? '  <- the larger scan is folded away' : ''}`);
  }
  console.log(`\n${workId}: ${ids.length} covers in ${editions} editions, ${hashes.filter((h) => !h).length} not hashed; ${groups.length} designs after folding, ${folded} of them with more than one scan; in ${hidden} the scan shown is not the largest.`);
  await new Promise((r) => setTimeout(r, 2000));
}

async function main(): Promise<void> {
  if (process.argv[2] === '--work') return oneWork(process.argv[3] ?? '');
  const slug = process.argv[2];
  const record = curatedRecords(join(__dirname, '../..')).find((r) => r.slug === slug);
  if (!record) throw new Error('Usage: npx tsx lab/calibre/measure-fold.ts <curated slug>');
  const library = findLibrary();
  const books = readLibrary(library);
  const source = picksFromCurated(record);
  const matches = matchPicks(source.picks, books);
  const sizes = new CoverSizes(join(defaultBackupRoot(), 'cover-sizes.json'), SITE);
  const px = (s: { width: number; height: number } | null | undefined) => (s ? `${s.width}×${s.height}` : '?');
  const area = (s: { width: number; height: number } | null | undefined) => (s ? s.width * s.height : 0);

  let measured = 0;
  let withLarger = 0;
  let beatsCalibre = 0;
  for (const [i, pick] of source.picks.entries()) {
    const bookId = matches[i].sure;
    if (bookId === undefined || !pick.coverId.startsWith('ol:')) continue;
    const book = books.find((b) => b.id === bookId);
    const file = book ? coverFile(library, book) : '';
    const inCalibre = file && existsSync(file) ? imageSizeFast(readFileSync(file)) : null;
    await pause();
    const work = await getWork(pick.workId);
    if (!work) continue;
    const coverIds = new Set<string>([pick.coverId]);
    let editions = 0;
    for (let offset = 0; offset < MAX_PAGES * 100; offset += 100) {
      await pause();
      const page = await getEditionsPage(pick.workId, offset);
      editions = page.size;
      for (const c of pickCovers(parseEditions(page.entries, work))) coverIds.add(c.coverId);
      if (offset + 100 >= page.size) break;
    }
    const ids = [...coverIds];
    const hashes = await inBatches(ids, 6, hashOf);
    const mine = hashes[ids.indexOf(pick.coverId)];
    if (!mine) {
      console.log(`${pick.title}: the collection's cover could not be hashed`);
      continue;
    }
    const same = ids.filter((id, at) => id !== pick.coverId && hashes[at] && hamming(hashes[at] as string, mine) <= SAME_IMAGE);
    const near = ids.filter((id, at) => id !== pick.coverId && hashes[at] && hamming(hashes[at] as string, mine) > SAME_IMAGE && hamming(hashes[at] as string, mine) <= NEAR);
    const nearSizes = await inBatches(near, 4, async (id) => ({ id, size: await sizes.get(id) }));
    const nearBest = nearSizes.sort((a, b) => area(b.size) - area(a.size))[0];
    const own = await sizes.get(pick.coverId);
    const others = await inBatches(same, 4, async (id) => ({ id, size: await sizes.get(id) }));
    const best = others.sort((a, b) => area(b.size) - area(a.size))[0];
    measured++;
    const larger = !!best && area(best.size) > area(own) * 1.1;
    if (larger) withLarger++;
    if (larger && area(best.size) >= area(inCalibre) * 0.9) beatsCalibre++;
    console.log(
      `${pick.title.slice(0, 38).padEnd(38)} collection ${px(own).padEnd(9)} · Calibre ${px(inCalibre).padEnd(9)} · ${String(ids.length).padStart(3)} covers in ${editions} editions, ${same.length} same design` +
        (best ? ` · largest ${px(best.size)} (${best.id})${larger ? '  <- larger' : ''}` : '') +
        (near.length ? ` · ${near.length} at 9–13, largest ${px(nearBest?.size)}` : '') +
        (hashes.some((h) => !h) ? ` · ${hashes.filter((h) => !h).length} not hashed` : ''),
    );
  }
  console.log(`\n${measured} covers measured: for ${withLarger} the work holds a larger scan of the same design; for ${beatsCalibre} of those it is at least as large as the cover in Calibre.`);
  // The size cache writes itself a moment after the last answer.
  await new Promise((r) => setTimeout(r, 2000));
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
