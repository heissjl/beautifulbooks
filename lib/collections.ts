/**
 * Thematic collections (ROADMAP 5.10, SPEC F8): a wall of works chosen by
 * hand around one theme — the books of a list of authors, or the printings
 * of one publisher's series (5.4b).
 *
 * The data is `data/collections.json`, written only by the curation tool in
 * `lab/collections/`. Nothing here asks a catalogue: a collection is what
 * Julian put in it, in the order he put it, each work with the one cover he
 * chose. Who belongs in a collection is his decision too — the `authors` and
 * `publishers` lists are the boundary the tool searches inside, and no code
 * adds a name to them.
 *
 * **A draft is never shown in production.** `published: false` collections
 * are visible under `next dev` so they can be looked at while they grow, and
 * answer 404 on a production build.
 */
import collectionsFile from '@/data/collections.json';
import type { CuratedWork } from './curated';

export type CollectionKind = 'authors' | 'series';

/** One author of an `authors` collection, with every Open Library key that is the same person. */
export interface CollectionAuthor {
  name: string;
  keys: string[];
}

/** One row of a collection's `works`, as the tool writes it. */
export interface CollectionPick {
  id: string;
  title: string;
  author: string;
  /** `ol:<cover id>`, the form the curation tools use throughout. */
  coverId: string;
  firstPublished?: number;
  addedAt?: string;
  /** Where the pick came from, e.g. `curated.json` when it was taken over from the home-page curation. */
  from?: string;
}

export interface CollectionRecord {
  slug: string;
  title: string;
  kind: CollectionKind;
  intro: string;
  published: boolean;
  authors?: CollectionAuthor[];
  /** Publisher spellings of a series, each confirmed by Julian (5.4b). */
  publishers?: string[];
  works: CollectionPick[];
}

export interface Collection {
  slug: string;
  title: string;
  kind: CollectionKind;
  intro: string;
  published: boolean;
  /** The names the collection is drawn from, in the tool's order: authors, or a series' publishers. */
  scope: string[];
  works: CuratedWork[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isCollectionSlug(value: string): boolean {
  return SLUG.test(value);
}

function coverNumber(coverId: string): number | null {
  if (!coverId.startsWith('ol:')) return null;
  const n = Number(coverId.slice(3));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Turns the file into collections a page can render.
 *
 * A pick without a usable cover is left out rather than shown as a blank
 * tile, and a work listed twice keeps its first place. A record with a bad
 * slug is skipped: the slug is a URL, and the tool validates it, so a bad one
 * means the file was edited by hand.
 */
export function parseCollections(records: CollectionRecord[], { includeDrafts }: { includeDrafts: boolean }): Collection[] {
  const out: Collection[] = [];
  const slugs = new Set<string>();
  for (const r of records) {
    if (!isCollectionSlug(r.slug) || slugs.has(r.slug)) continue;
    if (!r.published && !includeDrafts) continue;
    slugs.add(r.slug);
    const seen = new Set<string>();
    const works: CuratedWork[] = [];
    for (const p of r.works) {
      const coverId = coverNumber(p.coverId);
      if (coverId === null || seen.has(p.id)) continue;
      seen.add(p.id);
      works.push({ id: p.id, title: p.title, author: p.author, coverId });
    }
    const scope = r.kind === 'series' ? (r.publishers ?? []) : (r.authors ?? []).map(a => a.name);
    out.push({ slug: r.slug, title: r.title, kind: r.kind, intro: r.intro, published: r.published, scope, works });
  }
  return out;
}

/** Drafts are for `next dev` only. */
export function draftsVisible(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function allCollections({ includeDrafts = draftsVisible() }: { includeDrafts?: boolean } = {}): Collection[] {
  return parseCollections((collectionsFile as { collections: CollectionRecord[] }).collections, { includeDrafts });
}

export function collectionBySlug(slug: string): Collection | null {
  return allCollections().find(c => c.slug === slug) ?? null;
}

/**
 * The authors a collection actually shows, in wall order, each once.
 *
 * Not `scope`: an author the collection is drawn from but has no work on the
 * wall yet must not be named on the page as if she were in it.
 */
export function authorsShown(collection: Collection): string[] {
  const out: string[] = [];
  for (const w of collection.works) if (!out.includes(w.author)) out.push(w.author);
  return out;
}

/**
 * How the covers on a wall were chosen, said as it is (N12). An author
 * collection is picked by eye in the tool; a series built from its ISBNs
 * (`lab/collections/from-isbns.ts`) shows the image Open Library holds for
 * each series printing, which nobody looked at one by one — and for a few
 * it is not the series design at all (SF Masterworks: 4 of 73, 2026-09-25).
 */
export function coverLine(kind: CollectionKind): string {
  return kind === 'series'
    ? 'each with the cover Open Library holds for its printing in the series'
    : 'one cover each, chosen by hand';
}
