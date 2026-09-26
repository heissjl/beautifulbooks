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
  /** The ISBN of the printing whose image `coverId` is — what a cover credit is looked up by (6.52). */
  coverIsbn?: string;
  /** Cover artists for that printing, as ISFDB names them; set only where ISFDB agrees on one credit (6.52). */
  coverArtists?: string[];
  /** The ISFDB publication record the credit comes from, for the link beside it. */
  isfdbRecord?: string;
  /** Why a known credit is not shown, e.g. the image is of another printing than the ISBN's. */
  creditWithheld?: string;
}

/** A tile on a collection wall: a curated work, and its cover credit where the collection shows one. */
export interface WallWork extends CuratedWork {
  coverArtists?: string[];
}

export interface CollectionRecord {
  slug: string;
  title: string;
  kind: CollectionKind;
  intro: string;
  published: boolean;
  /**
   * Show the cover artist under each tile (Julian, 2026-09-25: „just for
   * sf-related collections i want the cover artist data displayed on the
   * wall itself"). Only `isfdb` exists: ISFDB is the one source that names
   * artists per printing, and it covers science fiction and fantasy.
   */
  coverCredits?: 'isfdb';
  /**
   * Where the covers come from when not every one was picked by eye: a list
   * or a tag brings the catalogue's image (5.10f). Absent means by hand for
   * an author collection and the series printing for a series. Set back by
   * hand once every cover has been looked at.
   */
  coverSource?: 'catalogue';
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
  /** Set when the wall shows cover credits; the page then names the source. */
  coverCredits?: 'isfdb';
  coverSource?: 'catalogue';
  works: WallWork[];
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
    const works: WallWork[] = [];
    for (const p of r.works) {
      const coverId = coverNumber(p.coverId);
      if (coverId === null || seen.has(p.id)) continue;
      seen.add(p.id);
      const credit = r.coverCredits === 'isfdb' && p.coverArtists?.length ? { coverArtists: p.coverArtists } : {};
      works.push({ id: p.id, title: p.title, author: p.author, coverId, ...credit });
    }
    const scope = r.kind === 'series' ? (r.publishers ?? []) : (r.authors ?? []).map(a => a.name);
    out.push({ slug: r.slug, title: r.title, kind: r.kind, intro: r.intro, published: r.published, scope, works, ...(r.coverCredits ? { coverCredits: r.coverCredits } : {}), ...(r.coverSource ? { coverSource: r.coverSource } : {}) });
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

export function collectionBySlug(slug: string, options: { includeDrafts?: boolean } = {}): Collection | null {
  return allCollections(options).find(c => c.slug === slug) ?? null;
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
export function coverLine(kind: CollectionKind, coverSource?: 'catalogue'): string {
  if (coverSource === 'catalogue') return 'each with a cover from Open Library, not all of them chosen by hand yet';
  return kind === 'series'
    ? 'each with the cover Open Library holds for its printing in the series'
    : 'one cover each, chosen by hand';
}

/**
 * Publication switched on the running site (ROADMAP 5.10g): slug → published,
 * kept in the store and winning over the file's `published`, so Julian can
 * publish a draft from /curate without a deploy. Only differences from the
 * file are kept; a switch back to what the file says removes the entry, so
 * file and site never drift apart unnoticed.
 */
export type PublishOverrides = Record<string, boolean>;

export function applyOverrides(records: CollectionRecord[], overrides: PublishOverrides): CollectionRecord[] {
  return records.map(r => (r.slug in overrides ? { ...r, published: overrides[r.slug] } : r));
}

export function nextOverrides(current: PublishOverrides, record: Pick<CollectionRecord, 'slug' | 'published'>, published: boolean): PublishOverrides {
  const next = { ...current };
  if (published === record.published) delete next[record.slug];
  else next[record.slug] = published;
  return next;
}

/** The file's records, unparsed — for the server module that applies overrides. */
export function collectionRecords(): CollectionRecord[] {
  return (collectionsFile as { collections: CollectionRecord[] }).collections;
}

/**
 * Collections whose content comes from a draft published on /curate
 * (5.10g; Julian, 2026-09-25: his choices in a draft „weren't saved properly"
 * — they were, but only the file reached the site). slug → record; replaces
 * the file's record of that slug, or adds a new collection.
 */
export type ContentOverrides = Record<string, CollectionRecord>;

export function applyContent(records: CollectionRecord[], content: ContentOverrides): CollectionRecord[] {
  const out = records.map(r => content[r.slug] ?? r);
  for (const [slug, r] of Object.entries(content)) if (!records.some(x => x.slug === slug)) out.push(r);
  return out;
}

/**
 * The order of the collections, set by Julian on /curate (5.10h; Julian,
 * 2026-09-25: „i need a way to arrange the 4 collections shown on the
 * starting page"). Slugs in the order given come first; any collection the
 * order does not name keeps its place from the file, after them — so a new
 * collection never disappears for want of a position.
 */
export function applyOrder(records: CollectionRecord[], order: string[]): CollectionRecord[] {
  const rank = new Map(order.map((slug, i) => [slug, i]));
  return records
    .map((r, i) => ({ r, key: rank.has(r.slug) ? (rank.get(r.slug) as number) : order.length + i }))
    .sort((a, b) => a.key - b.key)
    .map(x => x.r);
}

