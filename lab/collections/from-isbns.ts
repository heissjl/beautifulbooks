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

async function resolve(isbn: string) {
  const edition = await getJson<Edition>(`/isbn/${isbn}.json`);
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
  const noCover: string[] = [];
  const notFound: string[] = [];

  const maxWorks = Number(process.env.MAX_WORKS) || Infinity;
  for (const e of entries) {
    if (works.length >= maxWorks) break;
    if (e.skip) continue;
    let hit = await resolve(e.isbn);
    let coverFrom = e.isbn;
    for (const alt of e.fallbackIsbns ?? []) {
      if (hit?.cover) break;
      const other = await resolve(alt);
      if (other?.cover && (!hit || other.workKey === hit.workKey)) { hit = other; coverFrom = alt; }
      else if (!hit && other) hit = other;
    }
    if (!hit) { notFound.push(`${e.no ?? '-'} ${e.title} (${e.isbn})`); continue; }
    const id = hit.workKey.replace('/works/', '');
    if (works.some(w => w.id === id)) continue;
    const work = await getJson<Work>(`${hit.workKey}.json`);
    const authorKey = work?.authors?.[0]?.author?.key;
    const author = authorKey ? await getJson<{ name?: string }>(`${authorKey}.json`) : null;
    if (!hit.cover) { noCover.push(`${e.no ?? '-'} ${e.title} (${e.isbn})`); continue; }
    works.push({
      id,
      title: work?.title ?? e.title,
      author: (author?.name ?? '').normalize('NFC'),
      coverId: `ol:${hit.cover}`,
      addedAt: new Date().toISOString().slice(0, 10),
      from: `isbn:${coverFrom}`,
      coverIsbn: coverFrom,
    });
    process.stdout.write(`${works.length} `);
  }

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
  if (at >= 0) file.collections[at] = { ...record, published: file.collections[at].published };
  else file.collections.push(record);
  const tmp = `${OUT_FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ curatedAt: new Date().toISOString().slice(0, 10), collections: file.collections }, null, 2)}\n`);
  renameSync(tmp, OUT_FILE);

  console.log(`\n${slug}: ${works.length} of ${entries.length} on the wall`);
  if (noCover.length) console.log(`no cover on record for the series printing (${noCover.length}):\n  ${noCover.join('\n  ')}`);
  if (notFound.length) console.log(`ISBN unknown to Open Library (${notFound.length}):\n  ${notFound.join('\n  ')}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
