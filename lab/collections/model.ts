/**
 * The pure part of the collection tool (ROADMAP 5.10): which catalogue
 * records belong to a collection, and how the file changes when Julian adds,
 * removes or moves a work. No I/O here, so the rules are tested without a
 * server and without Open Library.
 */
import type { CollectionAuthor, CollectionKind, CollectionPick, CollectionRecord } from '../../lib/collections';
import { isCollectionSlug } from '../../lib/collections';

/** One work from an Open Library search, as far as this tool needs it. */
export interface SearchDoc {
  key: string;
  title: string;
  author_key?: string[];
  author_name?: string[];
  edition_count?: number;
  first_publish_year?: number;
  cover_i?: number;
}

export interface Candidate {
  id: string;
  title: string;
  /** The collection's own name for the author, never the catalogue's spelling. */
  author: string;
  editions: number;
  firstPublished?: number;
  coverId?: string;
}

/**
 * Works whose **first** author is one of this author's keys.
 *
 * The first entry is the primary author (CLAUDE.md, API facts); a search by
 * author key also returns anthologies, companions and criticism that merely
 * list her among others, and those are not her books. The author name is
 * taken from the collection, so the file only ever carries names Julian
 * agreed to — the test on `data/collections.json` relies on it.
 */
export function authorCandidates(docs: SearchDoc[], author: CollectionAuthor): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const d of docs) {
    const id = d.key.replace('/works/', '');
    const first = d.author_key?.[0];
    if (!first || !author.keys.includes(first) || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: d.title,
      author: author.name,
      editions: d.edition_count ?? 0,
      firstPublished: d.first_publish_year,
      coverId: d.cover_i && d.cover_i > 0 ? `ol:${d.cover_i}` : undefined,
    });
  }
  return out;
}

/** Case, spacing and punctuation do not make a different publisher. */
export function normalizePublisher(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Whether an edition belongs to a series, by its publisher field.
 *
 * Exact match after normalizing, not "contains": "Penguin" would otherwise
 * claim Penguin Classics, Penguin Modern Classics and Puffin reprints alike,
 * and a series is exactly the spellings Julian confirmed (5.4b).
 */
export function inSeries(publishers: string[] | undefined, spellings: string[]): boolean {
  if (!publishers?.length || spellings.length === 0) return false;
  const wanted = new Set(spellings.map(normalizePublisher));
  return publishers.some(p => wanted.has(normalizePublisher(p)));
}

export function slugify(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function newCollection(input: { title: string; slug?: string; kind: CollectionKind; intro?: string }, existing: CollectionRecord[]): CollectionRecord {
  const title = input.title.trim();
  if (!title) throw new Error('Titel fehlt');
  const slug = (input.slug?.trim() || slugify(title));
  if (!isCollectionSlug(slug)) throw new Error(`Ungültiger Slug: ${slug}`);
  if (existing.some(c => c.slug === slug)) throw new Error(`Slug gibt es schon: ${slug}`);
  return {
    slug,
    title,
    kind: input.kind,
    intro: input.intro?.trim() ?? '',
    published: false,
    ...(input.kind === 'series' ? { publishers: [] } : { authors: [] }),
    works: [],
  };
}

/**
 * Adds a work, or changes its cover if it is already there — in place, so a
 * new cover does not move a work Julian had arranged.
 */
export function upsertPick(c: CollectionRecord, pick: CollectionPick): CollectionRecord {
  if (c.kind === 'authors' && !(c.authors ?? []).some(a => a.name === pick.author)) {
    throw new Error(`${pick.author} steht nicht auf der Autorinnenliste dieser Sammlung`);
  }
  const at = c.works.findIndex(w => w.id === pick.id);
  const works = at < 0 ? [...c.works, pick] : c.works.map((w, i) => (i === at ? { ...w, ...pick, addedAt: w.addedAt ?? pick.addedAt } : w));
  return { ...c, works };
}

export function removePick(c: CollectionRecord, id: string): CollectionRecord {
  return { ...c, works: c.works.filter(w => w.id !== id) };
}

/**
 * A new order from the tool. Ids it does not know are ignored, and works it
 * left out keep their relative order at the end: a stale page must never be
 * able to drop a work by sending an old list.
 */
export function reorder(c: CollectionRecord, ids: string[]): CollectionRecord {
  const byId = new Map(c.works.map(w => [w.id, w]));
  const out: CollectionPick[] = [];
  for (const id of ids) {
    const w = byId.get(id);
    if (w && !out.includes(w)) out.push(w);
  }
  for (const w of c.works) if (!out.includes(w)) out.push(w);
  return { ...c, works: out };
}

/**
 * Removing an author from the list takes her works off the wall too — the
 * file must never hold a work by someone outside the list.
 */
export function removeAuthor(c: CollectionRecord, name: string): CollectionRecord {
  return { ...c, authors: (c.authors ?? []).filter(a => a.name !== name), works: c.works.filter(w => w.author !== name) };
}

export function addAuthor(c: CollectionRecord, author: CollectionAuthor): CollectionRecord {
  const name = author.name.normalize('NFC').trim();
  if (!name || author.keys.length === 0) throw new Error('Name und Key nötig');
  const list = c.authors ?? [];
  const same = list.find(a => a.name === name);
  if (same) {
    const keys = [...same.keys, ...author.keys.filter(k => !same.keys.includes(k))];
    return { ...c, authors: list.map(a => (a === same ? { ...a, keys } : a)) };
  }
  return { ...c, authors: [...list, { name, keys: [...author.keys] }] };
}
