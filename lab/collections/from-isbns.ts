/**
 * Builds a series collection from a list of ISBNs (ROADMAP 5.10c).
 *
 *   npx tsx lab/collections/from-isbns.ts <list.json> <slug> "<title>" [publisher …]
 *
 * `<list.json>` is an array of `{ no?, title, isbn, fallbackIsbns? }`, e.g.
 * the SF Masterworks tables read off Wikipedia. Each ISBN is one printing of
 * the series, so it names both the work and the cover that belongs on the
 * wall: `/isbn/<isbn>.json` at Open Library gives the edition, its `covers`
 * and its work; the work gives title and first author. Where the series
 * printing has no cover on record, a fallback ISBN of the same title is
 * tried, and after that the work is listed without a cover and reported —
 * never filled with some other printing's image, because the point of a
 * series wall is the series design.
 *
 * `MAX_WORKS=<n>` stops once n works are on the wall, in list order — for a
 * long series such as edition suhrkamp, where Julian wanted „the first 200 …
 * that work … in order nonetheless" (2026-09-25).
 *
 * Open Library only, never Google (lab rule 6); one request at a time with a
 * pause, cached beside this file in `isbn-cache.json` (git-ignored). Writes
 * the collection into `data/collections.json` (or `COLLECTIONS_FILE`) as a
 * draft; an existing collection with the same slug is replaced.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionPick, CollectionRecord } from '../../lib/collections';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT_FILE = process.env.COLLECTIONS_FILE ?? join(ROOT, 'data', 'collections.json');
const CACHE_FILE = join(import.meta.dirname, 'isbn-cache.json');
const PAUSE_MS = 400;

interface Entry {
  no?: string | null;
  title: string;
  isbn: string;
  /** Set by hand after looking: the image under this ISBN is not a cover (a title page, a photo, a stand-in). */
  skip?: string;
  fallbackIsbns?: string[];
  /**
   * Set by hand: the Open Library work this volume belongs to, when the ISBN's
   * edition sits on a stray one-edition work whose title is not the book's
   * („Ullstein Taschenbucher", „Suhrkamp BasisBibliothek (SBB), Nr.16, Demian").
   * The pick then takes id, title and author from this work and keeps the
   * stray one as `coverWork`, the wall that holds the image.
   */
  work?: string;
  /**
   * Set by hand: an Open Library edition key (`OL…M`) for a printing without
   * an ISBN — the pre-1970 volumes of a series, found by title, author,
   * publisher and year. Used instead of `isbn` (which may then be empty).
   */
  edition?: string;
  /**
   * The set this volume belongs to, for a wall of sets (`setSize`): the same
   * work may then appear once per set, and a set with any volume missing is
   * dropped whole, because half a set is not the edition's design.
   */
  set?: string;
}

const cache: Record<string, unknown> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};

async function getJson<T>(path: string): Promise<T | null> {
  if (path in cache) return cache[path] as T | null;
  let body: T | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`https://openlibrary.org${path}`, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'user-agent': 'beautifulbooks-lab-collections' },
      });
      if (res.status === 404) break;
      if (!res.ok) throw new Error(String(res.status));
      body = (await res.json()) as T;
      break;
    } catch (err) {
      // A silent catalogue is not "no such book": retry once, then stop the run.
      if (attempt === 2) throw new Error(`Open Library did not answer for ${path}: ${err instanceof Error ? err.message : err}`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  cache[path] = body;
  writeFileSync(CACHE_FILE, JSON.stringify(cache));
  await new Promise(r => setTimeout(r, PAUSE_MS));
  return body;
}

interface Edition { covers?: number[]; works?: Array<{ key: string }>; title?: string }
interface Work { title?: string; authors?: Array<{ author?: { key: string } }>; first_publish_date?: string }

async function resolve(isbn: string, editionKey?: string) {
  const edition = await getJson<Edition>(editionKey ? `/books/${editionKey}.json` : `/isbn/${isbn}.json`);
  const workKey = edition?.works?.[0]?.key;
  if (!edition || !workKey) return null;
  const cover = (edition.covers ?? []).find(c => c > 0);
  return { workKey, cover };
}

async function main() {
  const [listFile, slug, title, ...publishers] = process.argv.slice(2);
  if (!listFile || !slug || !title) throw new Error('usage: from-isbns.ts <list.json> <slug> "<title>" [publisher …]');
  const entries = JSON.parse(readFileSync(listFile, 'utf8')) as Entry[];
  const works: CollectionPick[] = [];
  const setOf = new Map<string, Set<string>>();
  const pickSet = new Map<CollectionPick, string>();
  const noCover: string[] = [];
  const notFound: string[] = [];

  const maxWorks = Number(process.env.MAX_WORKS) || Infinity;
  for (const e of entries) {
    if (works.length >= maxWorks) break;
    if (e.skip) continue;
    let hit = await resolve(e.isbn, e.edition);
    let coverFrom = e.edition && !e.isbn ? '' : e.isbn;
    for (const alt of e.fallbackIsbns ?? []) {
      if (hit?.cover) break;
      const other = await resolve(alt);
      if (other?.cover && (!hit || other.workKey === hit.workKey)) { hit = other; coverFrom = alt; }
      else if (!hit && other) hit = other;
    }
    if (!hit) { notFound.push(`${e.no ?? '-'} ${e.title} (${e.isbn})`); continue; }
    const coverWork = hit.workKey.replace('/works/', '');
    const id = e.work ?? coverWork;
    if (e.set ? setOf.get(id)?.has(e.set) : works.some(w => w.id === id)) continue;
    const work = await getJson<Work>(`/works/${id}.json`);
    const authorKey = work?.authors?.[0]?.author?.key;
    const author = authorKey ? await getJson<{ name?: string }>(`${authorKey}.json`) : null;
    if (!hit.cover) { noCover.push(`${e.no ?? '-'} ${e.title} (${e.isbn})`); continue; }
    works.push({
      id,
      title: work?.title ?? e.title,
      author: (author?.name ?? '').normalize('NFC'),
      coverId: `ol:${hit.cover}`,
      addedAt: new Date().toISOString().slice(0, 10),
      ...(coverFrom ? { from: `isbn:${coverFrom}`, coverIsbn: coverFrom } : { from: `edition:${e.edition}` }),
      ...(coverWork !== id ? { coverWork } : {}),
      ...(e.set ? { set: e.set } : {}),
    });
    if (e.set) {
      pickSet.set(works[works.length - 1], e.set);
      setOf.set(id, (setOf.get(id) ?? new Set()).add(e.set));
    }
    process.stdout.write(`${works.length} `);
  }

  const incomplete: string[] = [];
  for (const set of new Set(entries.filter(e => e.set && !e.skip).map(e => e.set!))) {
    const wanted = entries.filter(e => e.set === set && !e.skip).length;
    const got = works.filter(w => pickSet.get(w) === set).length;
    if (got < wanted) incomplete.push(`${set}: ${got} of ${wanted}`);
  }
  const dropped = new Set(incomplete.map(s => s.slice(0, s.lastIndexOf(':'))));
  for (let i = works.length - 1; i >= 0; i--) if (dropped.has(pickSet.get(works[i]) ?? '')) works.splice(i, 1);

  const file = JSON.parse(readFileSync(OUT_FILE, 'utf8')) as { collections: CollectionRecord[] };
  const record: CollectionRecord = {
    slug,
    title,
    kind: 'series',
    intro: file.collections.find(c => c.slug === slug)?.intro ?? '',
    published: false,
    publishers,
    works,
  };
  const at = file.collections.findIndex(c => c.slug === slug);
  // Keep what other tools added (credits, set size); the works and the boundary are this run's.
  if (at >= 0) file.collections[at] = { ...file.collections[at], ...record, published: file.collections[at].published };
  else file.collections.push(record);
  const tmp = `${OUT_FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ curatedAt: new Date().toISOString().slice(0, 10), collections: file.collections }, null, 2)}\n`);
  renameSync(tmp, OUT_FILE);

  console.log(`\n${slug}: ${works.length} of ${entries.length} on the wall`);
  if (noCover.length) console.log(`no cover on record for the series printing (${noCover.length}):\n  ${noCover.join('\n  ')}`);
  if (incomplete.length) console.log(`sets dropped, not every volume has a cover (${incomplete.length}):\n  ${incomplete.join('\n  ')}`);
  if (notFound.length) console.log(`ISBN unknown to Open Library (${notFound.length}):\n  ${notFound.join('\n  ')}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
