/**
 * The pure part of both collection tools (ROADMAP 5.10, 5.10b): which
 * catalogue records belong to a collection, and how a collection changes when
 * someone adds, removes or moves a work — Julian in `lab/collections/`, a
 * friend in a draft on `/curate`. No I/O here, so the rules are tested without a
 * server and without Open Library.
 */
import type { CollectionAuthor, CollectionKind, CollectionPick, CollectionRecord } from './collections';
import { isCollectionSlug } from './collections';

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
  if (!title) throw new Error('A title is needed.');
  const slug = (input.slug?.trim() || slugify(title));
  if (!isCollectionSlug(slug)) throw new Error(`Not a usable address: ${slug}`);
  if (existing.some(c => c.slug === slug)) throw new Error(`That address is taken: ${slug}`);
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
 * One tile on a wall: a work and the cover shown for it. A wall may show the
 * same work twice when two printings have their own designs (Julian,
 * 2026-09-29: both Lone Star covers, the two layouts of the Fischer Bücherei),
 * so the work id alone does not name a tile.
 */
export function pickKey(w: Pick<CollectionPick, 'id' | 'coverId'>): string {
  return `${w.id}|${w.coverId}`;
}

/** `OL1W|ol:2` → work and cover; a plain work id → the work alone (older callers). */
export function parsePickKey(key: string): { id: string; coverId?: string } {
  const bar = key.indexOf('|');
  return bar < 0 ? { id: key } : { id: key.slice(0, bar), coverId: key.slice(bar + 1) };
}

export interface PickOptions {
  /** Show this cover in addition to the work's other covers on the wall. */
  again?: boolean;
  /** The cover this pick replaces, when the work is on the wall more than once. */
  was?: string;
}

/**
 * Adds a work, or changes its cover if it is already there — in place, so a
 * new cover does not move a work Julian had arranged. A pick naming a cover
 * the work already shows updates that tile; `again` adds a second tile;
 * `was` says which tile gets the new cover. Without either, the work's first
 * tile changes, as before walls could show a work twice.
 */
export function upsertPick(c: CollectionRecord, pick: CollectionPick, options: PickOptions = {}): CollectionRecord {
  if (c.kind === 'authors' && !(c.authors ?? []).some(a => a.name === pick.author)) {
    throw new Error(`${pick.author} is not on this collection's list of authors. Add them first.`);
  }
  let at = c.works.findIndex(w => w.id === pick.id && w.coverId === pick.coverId);
  if (at < 0 && options.again) return { ...c, works: [...c.works, pick] };
  if (at < 0 && options.was) at = c.works.findIndex(w => w.id === pick.id && w.coverId === options.was);
  if (at < 0) at = c.works.findIndex(w => w.id === pick.id);
  const works = at < 0 ? [...c.works, pick] : c.works.map((w, i) => (i === at ? merged(w, pick) : w));
  return { ...c, works };
}

/**
 * A known work with a new pick. A credit belongs to one printing's image
 * (6.52): when the cover changes, the old cover's ISBN, artists and ISFDB
 * record go with it rather than being carried onto a cover they never named.
 */
function merged(old: CollectionPick, pick: CollectionPick): CollectionPick {
  const next: CollectionPick = { ...old, ...pick, addedAt: old.addedAt ?? pick.addedAt };
  if (old.coverId !== pick.coverId) {
    if (!pick.coverIsbn) delete next.coverIsbn;
    if (!pick.coverArtists) delete next.coverArtists;
    if (!pick.isfdbRecord) delete next.isfdbRecord;
  }
  return next;
}

/** Takes a work off the wall — every tile of it, or only the one with `coverId`. */
export function removePick(c: CollectionRecord, id: string, coverId?: string): CollectionRecord {
  return { ...c, works: c.works.filter(w => w.id !== id || (coverId !== undefined && w.coverId !== coverId)) };
}

/**
 * A new order from the tool, as tile keys (`pickKey`) or plain work ids. A
 * plain id places the work's first tile not yet placed. Keys it does not
 * know are ignored, and tiles it left out keep their relative order at the
 * end: a stale page must never be able to drop a work by sending an old list.
 */
export function reorder(c: CollectionRecord, ids: string[]): CollectionRecord {
  const out: CollectionPick[] = [];
  for (const key of ids) {
    const { id, coverId } = parsePickKey(key);
    const w = c.works.find(x => x.id === id && (coverId === undefined || x.coverId === coverId) && !out.includes(x));
    if (w) out.push(w);
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
  if (!name || author.keys.length === 0) throw new Error('A name and an Open Library key are needed.');
  const list = c.authors ?? [];
  const same = list.find(a => a.name === name);
  if (same) {
    const keys = [...same.keys, ...author.keys.filter(k => !same.keys.includes(k))];
    return { ...c, authors: list.map(a => (a === same ? { ...a, keys } : a)) };
  }
  return { ...c, authors: [...list, { name, keys: [...author.keys] }] };
}
