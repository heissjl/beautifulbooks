/**
 * An author collection from an Open Library list or subject tag (ROADMAP
 * 5.10f; Julian, 2026-09-25: the Feminist Press list „add them into the draft
 * of women writers", and the Tiptree award „start this draft").
 *
 *   npx tsx lab/collections/from-openlibrary.ts list:hopeevey/OL203409L women-writers
 *   npx tsx lab/collections/from-openlibrary.ts "subject:collection:otherwise_tiptree_award=winner" tiptree-award "The Otherwise (Tiptree) Award"
 *
 * - **A list** is read through `/query.json?key=<list>&seeds=` (its
 *   `seeds.json` answers 500 for about half the lists). An edition seed names
 *   the printing and so the cover; a work seed gets the work's own cover.
 *   Author and subject seeds are dropped, redirects followed, and a work
 *   listed twice comes in once.
 * - **A subject tag** is an Open Library search; each work comes with the
 *   cover the catalogue shows first, ordered by first publication.
 *
 * Each work's first author joins the collection's list of authors — the list
 * Julian keeps (SPEC F8.2); running this script for a source is his OK for
 * the names it brings, and the script prints them. Works already on the wall
 * keep their place and cover. Everything is written as a draft into
 * `data/collections.json` (or `COLLECTIONS_FILE`), read fresh just before
 * the write. Open Library only, never Google (lab rule 6), gently.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addAuthor, upsertPick } from '../../lib/collectionedit';
import type { CollectionPick, CollectionRecord } from '../../lib/collections';

const ROOT = join(import.meta.dirname, '..', '..');
const OUT_FILE = process.env.COLLECTIONS_FILE ?? join(ROOT, 'data', 'collections.json');
const CACHE_FILE = join(import.meta.dirname, 'ol-cache.json');
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const cache: Record<string, unknown> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};

async function get<T>(path: string): Promise<T | null> {
  if (path in cache) return cache[path] as T | null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`https://openlibrary.org${path}`, {
        signal: AbortSignal.timeout(40_000),
        headers: { 'user-agent': 'beautifulbooks-lab-collections' },
      });
      if (res.status === 404) { cache[path] = null; break; }
      if (!res.ok) throw new Error(String(res.status));
      cache[path] = await res.json();
      break;
    } catch (err) {
      // A silent catalogue is not an empty source: after three tries, stop the run.
      if (attempt === 3) throw new Error(`Open Library did not answer for ${path}: ${err instanceof Error ? err.message : err}`);
      await sleep(4000);
    }
  }
  writeFileSync(CACHE_FILE, JSON.stringify(cache));
  await sleep(700);
  return cache[path] as T | null;
}

interface Found { workId: string; coverId?: number; isbn?: string; year?: number }

/** A work record, following merges (`/type/redirect`). */
async function work(key: string): Promise<{ key: string; title: string; authors?: Array<{ author?: { key: string } }>; covers?: number[]; first_publish_date?: string } | null> {
  let k = key;
  for (let hops = 0; hops < 3; hops++) {
    const w = await get<{ key: string; type?: { key: string }; location?: string; title: string; authors?: Array<{ author?: { key: string } }>; covers?: number[] }>(`${k}.json`);
    if (!w) return null;
    if (w.type?.key === '/type/redirect' && w.location) { k = w.location; continue; }
    return w;
  }
  return null;
}

async function fromList(spec: string): Promise<Found[]> {
  const [user, id] = spec.split('/');
  const rows = await get<Array<{ seeds?: Array<{ key?: string; thing?: { key: string } } | string> }>>(`/query.json?key=/people/${user}/lists/${id}&seeds=`);
  const seeds = (rows?.[0]?.seeds ?? []).map(s => (typeof s === 'string' ? s : s.key ?? s.thing?.key ?? ''));
  const out: Found[] = [];
  for (const key of seeds) {
    if (key.startsWith('/books/')) {
      const e = await get<{ works?: Array<{ key: string }>; covers?: number[]; isbn_13?: string[]; isbn_10?: string[]; publish_date?: string }>(`${key}.json`);
      const wk = e?.works?.[0]?.key;
      if (!e || !wk) continue;
      const year = Number(e.publish_date?.match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1]) || undefined;
      out.push({ workId: wk, coverId: (e.covers ?? []).find(c => c > 0), isbn: e.isbn_13?.[0] ?? e.isbn_10?.[0], year });
    } else if (key.startsWith('/works/')) {
      out.push({ workId: key });
    }
  }
  return out;
}

async function fromSubject(tag: string): Promise<Found[]> {
  const body = await get<{ docs: Array<{ key: string; cover_i?: number; first_publish_year?: number }> }>(
    `/search.json?q=${encodeURIComponent(`subject:"${tag}"`)}&fields=key,cover_i,first_publish_year&limit=200`,
  );
  return (body?.docs ?? [])
    .map(d => ({ workId: d.key, coverId: d.cover_i && d.cover_i > 0 ? d.cover_i : undefined, year: d.first_publish_year }))
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

async function main() {
  const [source, slug, title] = process.argv.slice(2);
  if (!source || !slug) throw new Error('usage: from-openlibrary.ts <list:user/OLxxxL | subject:tag> <slug> ["title" for a new collection]');
  const found = source.startsWith('list:') ? await fromList(source.slice(5)) : source.startsWith('subject:') ? await fromSubject(source.slice(8)) : [];
  if (found.length === 0) throw new Error(`${source}: nothing found`);

  const picks: CollectionPick[] = [];
  const authors = new Map<string, string>(); // key -> name
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (const f of found) {
    const w = await work(f.workId);
    if (!w) { skipped.push(`${f.workId} (gone)`); continue; }
    const id = w.key.replace('/works/', '');
    if (seen.has(id)) continue;
    seen.add(id);
    const cover = f.coverId ?? (w.covers ?? []).find(c => c > 0);
    const authorKey = w.authors?.[0]?.author?.key;
    const author = authorKey ? await get<{ name?: string }>(`${authorKey}.json`) : null;
    if (!cover || !authorKey || !author?.name) { skipped.push(`${w.title} (${!cover ? 'no cover' : 'no author'})`); continue; }
    const name = author.name.normalize('NFC');
    authors.set(authorKey.replace('/authors/', ''), name);
    picks.push({
      id,
      title: w.title,
      author: name,
      coverId: `ol:${cover}`,
      addedAt: new Date().toISOString().slice(0, 10),
      from: source,
      ...(f.isbn ? { coverIsbn: f.isbn.replace(/[^0-9X]/gi, '') } : {}),
    });
  }

  // Fresh read just before writing (the curation app and other scripts write this file too).
  const file = JSON.parse(readFileSync(OUT_FILE, 'utf8')) as { curatedAt?: string; collections: CollectionRecord[] };
  let c = file.collections.find(x => x.slug === slug);
  if (!c) {
    if (!title) throw new Error(`${slug} does not exist; give a title to create it`);
    c = { slug, title, kind: 'authors', intro: '', published: false, authors: [], works: [] };
    file.collections.push(c);
  }
  if (c.kind !== 'authors') throw new Error(`${slug} is not an author collection`);
  const before = new Set((c.authors ?? []).map(a => a.name));
  let next = c;
  for (const [key, name] of authors) next = addAuthor(next, { name, keys: [key] });
  let added = 0;
  for (const p of picks) {
    if (next.works.some(w => w.id === p.id)) continue; // keep what is already on the wall, cover and place
    next = upsertPick(next, p);
    added += 1;
  }
  // The catalogue's covers are not a choice by eye; the page must not say they are.
  if (added > 0) next = { ...next, coverSource: 'catalogue' };
  file.collections = file.collections.map(x => (x.slug === slug ? next : x));
  const tmp = `${OUT_FILE}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ ...file, curatedAt: new Date().toISOString().slice(0, 10) }, null, 2)}\n`);
  renameSync(tmp, OUT_FILE);

  const newNames = [...new Set(authors.values())].filter(n => !before.has(n));
  console.log(`${slug}: ${found.length} from ${source}, ${added} added, ${next.works.length} on the wall now`);
  console.log(`new authors on the list (${newNames.length}): ${newNames.join(', ')}`);
  if (skipped.length) console.log(`skipped (${skipped.length}): ${skipped.join('; ')}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
