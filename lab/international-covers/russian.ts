/**
 * A Russian-language cover for each work of a collection (Julian,
 * 2026-09-26: the SF Masterworks relaunch „with international covers. try
 * all russian covers first").
 *
 *   npx tsx lab/international-covers/russian.ts [slug] [out.json]
 *
 * Defaults: slug `sf-masterworks-relaunch`, output
 * `lab/collections/lists/sf-relaunch-russian.json`. Reads the collection
 * from `data/collections.json` (read only — this script never writes it).
 *
 * For each work, every page of `/works/<id>/editions.json` is read and the
 * editions tagged `/languages/rus` with a cover are kept (`pick.ts`). Where
 * none has one, `search.json` with `language=rus` is asked, and its answer
 * is taken only when it names the same work. A search hit on a *different*
 * work record (a Russian translation catalogued as its own work) is noted
 * as `otherWork` for a person to look at, never taken.
 *
 * Open Library only (lab rule 6), one request at a time, 0.7 s apart, 40 s
 * timeout, three tries. Answers are cached in `cache.json` beside this file
 * (git-ignored); failures are not cached. A work whose requests failed is
 * `failed`, retried once at the end, and never reported as `none`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionRecord } from '../../lib/collections';
import { normalizeTitle } from '../../lib/normalize';
import { allEditions, get, SourceFailed } from './ol';
import { pickLanguageEdition, type LanguageCoverRow } from './pick';

const ROOT = join(import.meta.dirname, '..', '..');
const LANGUAGE = 'rus';

interface SearchDoc {
  key: string;
  title?: string;
  author_name?: string[];
  editions?: { docs?: Array<{ key: string; cover_i?: number; language?: string[]; publish_date?: string[] }> };
}

const SEARCH_FIELDS = 'key,title,author_name,cover_i,language,editions,editions.key,editions.cover_i,editions.language,editions.publish_date';

async function viaSearch(work: { id: string; title: string; author: string }) {
  const q = new URLSearchParams({ q: work.title, author: work.author, language: LANGUAGE, fields: SEARCH_FIELDS, limit: '10' });
  const body = await get<{ docs?: SearchDoc[] }>(`/search.json?${q}`);
  const docs = body?.docs ?? [];
  const russianWithCover = (d: SearchDoc) =>
    (d.editions?.docs ?? []).find(e => e.language?.includes(LANGUAGE) && (e.cover_i ?? 0) > 0);
  const same = docs.find(d => d.key === `/works/${work.id}`);
  const hit = same ? russianWithCover(same) : undefined;
  const lastName = work.author.split(' ').pop()?.toLowerCase() ?? '';
  const other = docs.find(d =>
    d.key !== `/works/${work.id}` && russianWithCover(d) &&
    normalizeTitle(d.title ?? '') === normalizeTitle(work.title) &&
    (d.author_name ?? []).some(a => a.toLowerCase().includes(lastName)));
  return { hit, otherWork: other ? `${other.key.replace('/works/', '')}:ol:${russianWithCover(other)?.cover_i}` : undefined };
}

type Row = LanguageCoverRow & { otherWork?: string };

async function lookUp(order: number, w: { id: string; title: string; author: string }): Promise<Row> {
  const base = { order, id: w.id, title: w.title, author: w.author };
  try {
    const pick = pickLanguageEdition(await allEditions(w.id), LANGUAGE);
    if (pick) {
      return { ...base, coverId: `ol:${pick.cover}`, candidates: pick.candidates, edition: pick.edition.key, publishDate: pick.edition.publish_date ?? null, status: 'found', via: 'editions' };
    }
    const { hit, otherWork } = await viaSearch(w);
    if (hit?.cover_i) {
      return { ...base, coverId: `ol:${hit.cover_i}`, candidates: [hit.cover_i], edition: hit.key, publishDate: hit.publish_date?.[0] ?? null, status: 'found', via: 'search' };
    }
    return { ...base, coverId: null, candidates: [], edition: null, publishDate: null, status: 'none', ...(otherWork ? { otherWork } : {}) };
  } catch (err) {
    if (!(err instanceof SourceFailed)) throw err;
    console.error(`\n${w.title}: ${err.message}`);
    return { ...base, coverId: null, candidates: [], edition: null, publishDate: null, status: 'failed' };
  }
}

async function main() {
  const slug = process.argv[2] ?? 'sf-masterworks-relaunch';
  const outFile = process.argv[3] ?? join(ROOT, 'lab', 'collections', 'lists', 'sf-relaunch-russian.json');
  const file = JSON.parse(readFileSync(join(ROOT, 'data', 'collections.json'), 'utf8')) as { collections: CollectionRecord[] };
  const collection = file.collections.find(c => c.slug === slug);
  if (!collection) throw new Error(`no collection ${slug}`);

  const rows: Row[] = [];
  for (const [i, w] of collection.works.entries()) {
    rows.push(await lookUp(i + 1, w));
    process.stdout.write(rows[i].status === 'found' ? '+' : rows[i].status === 'none' ? '.' : 'x');
  }
  for (const [i, row] of rows.entries()) {
    if (row.status === 'failed') rows[i] = await lookUp(row.order, collection.works[i]);
  }
  writeFileSync(outFile, `${JSON.stringify(rows, null, 1)}\n`);
  const count = (s: Row['status']) => rows.filter(r => r.status === s).length;
  console.log(`\n${slug}: ${count('found')} with a Russian cover, ${count('none')} none, ${count('failed')} failed, of ${rows.length}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
