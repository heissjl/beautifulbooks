/**
 * An international (non-English) cover for each work of a collection
 * (Julian, 2026-09-26: „ok instead of russian, let's just aim for
 * international covers of the works within the relaunch series", then
 * „you can't find an international cover for each book? seems unlikely").
 *
 *   npx tsx lab/international-covers/international.ts [slug] [out.json]
 *
 * Defaults: slug `sf-masterworks-relaunch`, output
 * `lab/collections/lists/sf-relaunch-international.json`. Reads
 * `data/collections.json` and never writes it.
 *
 * 1. Every page of each work's `/works/<id>/editions.json`; candidates are
 *    covers of non-English editions, by language tag, or — for an edition
 *    with no language field — by ISBN group or publisher (`foreignCandidates`).
 * 2. For a work still without one: the author's other work records
 *    (`search.json?q=author_key:…`). A record tagged only with other
 *    languages is an unmerged translation; it is taken when its title is the
 *    book's or an edition says `translation_of` the book (`matchSeparateWork`),
 *    or when `translations.json` names it — by hand after looking, or from a
 *    Wikipedia interlanguage link or Wikidata label (`translated-titles.ts`).
 *    Everything else is written to `unmatched.json` for a person to check.
 * 3. One cover per work, the wall in order (`chooseVaried`). A cover listed
 *    in `rejected.json` (a person looked and ruled it out) is never chosen.
 *
 * Open Library only, gentle and cached (`ol.ts`). A work whose requests
 * failed is `failed`, retried once at the end, never counted as `none`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionRecord } from '../../lib/collections';
import { allEditions, get, SourceFailed } from './ol';
import {
  chooseVaried, foreignCandidates, foreignWorkLanguage, matchSeparateWork, sortCandidates, translationCandidates,
  type AuthorWorkDoc, type EditionWithOriginal, type ForeignCandidate, type TranslationMatch,
} from './pick';

const ROOT = join(import.meta.dirname, '..', '..');
const HAND_FILE = join(import.meta.dirname, 'translations.json');
const UNMATCHED_FILE = join(import.meta.dirname, 'unmatched.json');
const REJECTED_FILE = join(import.meta.dirname, 'rejected.json');
/** Separate works looked into per author, most editions first — a bound on requests for prolific authors. */
const MAX_FOREIGN_WORKS_PER_AUTHOR = 60;

interface Row {
  order: number;
  id: string;
  title: string;
  author: string;
  coverId: string | null;
  language: string | null;
  via: ForeignCandidate['via'] | null;
  edition: string | null;
  publishDate: string | null;
  isbn: string | null;
  candidates: ForeignCandidate[];
  status: 'found' | 'none' | 'failed';
}

type Work = { id: string; title: string; author: string };
type Found = ForeignCandidate[] | 'failed';

async function editionCandidates(workId: string): Promise<Found> {
  try {
    return foreignCandidates(await allEditions(workId));
  } catch (err) {
    if (!(err instanceof SourceFailed)) throw err;
    console.error(`\n${workId}: ${err.message}`);
    return 'failed';
  }
}

async function authorKey(workId: string): Promise<string | null> {
  const work = await get<{ authors?: Array<{ author?: { key: string } }> }>(`/works/${workId}.json`);
  return work?.authors?.[0]?.author?.key?.replace('/authors/', '') ?? null;
}

async function authorWorks(key: string): Promise<AuthorWorkDoc[]> {
  const out: AuthorWorkDoc[] = [];
  for (let page = 1; page <= 4; page++) {
    const q = new URLSearchParams({ q: `author_key:${key}`, fields: 'key,title,language,cover_i,cover_edition_key,edition_count', sort: 'editions', limit: '500', page: String(page) });
    const body = await get<{ docs?: AuthorWorkDoc[] }>(`/search.json?${q}`);
    const docs = body?.docs ?? [];
    out.push(...docs);
    if (docs.length < 500) break;
  }
  return out;
}

interface Unmatched { author: string; authorKey: string; books: string[]; works: Array<{ work: string; title: string; language: string; cover: number | null }> }

/** Step 2: separate translation works for the works still without a candidate. */
/** An entry of `translations.json`: foreign work → the relaunch work it translates, and how that is known. */
interface TranslationEntry { id: string; via: TranslationMatch; lang?: string; title?: string }

function readTranslations(): Record<string, TranslationEntry> {
  if (!existsSync(HAND_FILE)) return {};
  const raw = JSON.parse(readFileSync(HAND_FILE, 'utf8')) as Record<string, string | TranslationEntry>;
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, typeof v === 'string' ? { id: v, via: 'by-hand' as const } : v]));
}

function addAll(list: ForeignCandidate[], more: ForeignCandidate[]) {
  for (const c of more) if (!list.some(x => x.cover === c.cover)) list.push(c);
}

/** Step 2: separate translation works for the works still without a candidate. */
async function separateWorks(works: Work[], found: Found[], relaunchIds: Set<string>): Promise<Unmatched[]> {
  const hand = readTranslations();
  const open = works.map((w, i) => ({ w, i })).filter(({ i }) => found[i] !== 'failed' && (found[i] as ForeignCandidate[]).every(c => c.needsCheck));
  const done = new Set<string>();
  const byAuthor = new Map<string, Array<{ w: Work; i: number }>>();
  for (const o of open) {
    try {
      const key = await authorKey(o.w.id);
      if (key) byAuthor.set(key, [...(byAuthor.get(key) ?? []), o]);
    } catch (err) {
      if (!(err instanceof SourceFailed)) throw err;
      found[o.i] = 'failed';
    }
  }
  const unmatched: Unmatched[] = [];
  for (const [key, targets] of byAuthor) {
    try {
      const foreign = (await authorWorks(key))
        .filter(d => !relaunchIds.has(d.key.replace('/works/', '')) && d.cover_i && foreignWorkLanguage(d))
        .slice(0, MAX_FOREIGN_WORKS_PER_AUTHOR);
      const left: Unmatched['works'] = [];
      for (const doc of foreign) {
        const workKey = doc.key.replace('/works/', '');
        const page = await get<{ entries?: EditionWithOriginal[] }>(`/works/${workKey}/editions.json?limit=50`);
        const editions = page?.entries ?? [];
        const auto = matchSeparateWork(doc, editions, targets.map(t => t.w));
        const entry = hand[workKey];
        const target = auto ?? (entry && targets.some(t => t.w.id === entry.id) ? entry.id : null);
        const language = foreignWorkLanguage(doc) as string;
        if (!target) {
          left.push({ work: workKey, title: doc.title, language, cover: doc.cover_i ?? null });
          continue;
        }
        done.add(workKey);
        const list = found[targets.find(t => t.w.id === target)!.i] as ForeignCandidate[];
        addAll(list, translationCandidates(editions, language, workKey, auto ? undefined : entry.via));
      }
      const stillOpen = targets.filter(t => (found[t.i] as ForeignCandidate[]).length === 0);
      if (stillOpen.length && left.length) unmatched.push({ author: targets[0].w.author, authorKey: key, books: stillOpen.map(t => t.w.title), works: left });
    } catch (err) {
      if (!(err instanceof SourceFailed)) throw err;
      console.error(`\n${key}: ${err.message}`);
      for (const t of targets) if ((found[t.i] as ForeignCandidate[]).length === 0) found[t.i] = 'failed';
    }
  }
  // Entries the author search did not reach (a different author record, or past the per-author bound).
  for (const [workKey, entry] of Object.entries(hand)) {
    if (done.has(workKey)) continue;
    const target = open.find(o => o.w.id === entry.id);
    if (!target || found[target.i] === 'failed') continue;
    try {
      const page = await get<{ entries?: EditionWithOriginal[] }>(`/works/${workKey}/editions.json?limit=50`);
      const language = entry.lang ?? 'und';
      addAll(found[target.i] as ForeignCandidate[], translationCandidates(page?.entries ?? [], language, workKey, entry.via));
    } catch (err) {
      if (!(err instanceof SourceFailed)) throw err;
      console.error(`\n${workKey}: ${err.message}`);
      if ((found[target.i] as ForeignCandidate[]).length === 0) found[target.i] = 'failed';
    }
  }
  return unmatched;
}

async function main() {
  const slug = process.argv[2] ?? 'sf-masterworks-relaunch';
  const outFile = process.argv[3] ?? join(ROOT, 'lab', 'collections', 'lists', 'sf-relaunch-international.json');
  const file = JSON.parse(readFileSync(join(ROOT, 'data', 'collections.json'), 'utf8')) as { collections: CollectionRecord[] };
  const collection = file.collections.find(c => c.slug === slug);
  if (!collection) throw new Error(`no collection ${slug}`);
  const works: Work[] = collection.works;
  const relaunchIds = new Set(works.map(w => w.id));

  const found: Found[] = [];
  for (const w of works) {
    found.push(await editionCandidates(w.id));
    const last = found[found.length - 1];
    process.stdout.write(last === 'failed' ? 'x' : last.length ? '+' : '.');
  }
  for (const [i, f] of found.entries()) if (f === 'failed') found[i] = await editionCandidates(works[i].id);
  process.stdout.write('\nseparate works ');
  const unmatched = await separateWorks(works, found, relaunchIds);
  writeFileSync(UNMATCHED_FILE, `${JSON.stringify(unmatched, null, 1)}\n`);

  const rejected = existsSync(REJECTED_FILE) ? (JSON.parse(readFileSync(REJECTED_FILE, 'utf8')) as Record<string, string>) : {};
  const sorted = found.map(f => (f === 'failed' ? f : sortCandidates(f).map(c => (rejected[`ol:${c.cover}`] ? { ...c, rejected: rejected[`ol:${c.cover}`] } : c))));
  const chosen = chooseVaried(sorted.map(f => (f === 'failed' ? [] : f)));
  const rows: Row[] = works.map((w, i) => {
    const f = sorted[i];
    const c = chosen[i];
    return {
      order: i + 1, id: w.id, title: w.title, author: w.author,
      coverId: c ? `ol:${c.cover}` : null,
      language: c?.language ?? null,
      via: c?.via ?? null,
      edition: c?.edition ?? null,
      publishDate: c?.publishDate ?? null,
      isbn: c?.isbn ?? null,
      candidates: f === 'failed' ? [] : f,
      status: f === 'failed' ? 'failed' : c ? 'found' : 'none',
    };
  });
  writeFileSync(outFile, `${JSON.stringify(rows, null, 1)}\n`);

  const count = (s: Row['status']) => rows.filter(r => r.status === s).length;
  const tally = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((m, l) => ({ ...m, [l]: (m[l] ?? 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} ${n}`).join(', ');
  console.log(`\n${slug}: ${count('found')} with an international cover, ${count('none')} none, ${count('failed')} failed, of ${rows.length}`);
  console.log(`chosen per language: ${tally(rows.flatMap(r => (r.language ? [r.language] : [])))}`);
  console.log(`chosen per evidence: ${tally(rows.flatMap(r => (r.via ? [r.via] : [])))}`);
  console.log(`unmatched translation works to check: ${unmatched.reduce((n, u) => n + u.works.length, 0)} (${UNMATCHED_FILE})`);
  console.log(`still none: ${rows.filter(r => r.status === 'none').map(r => `${r.order} ${r.title}`).join('; ')}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
