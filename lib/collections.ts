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
import { english, type Translate } from './i18n/translate';
import collectionsFile from '@/data/collections.json';
import type { CuratedWork } from './curated';
import { isHiddenCover } from './hiddencovers';

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
  /** The artwork on the cover as the printing credits it, e.g. „The Opera Cloak by William Strang" (`coverCredits: artwork`). */
  coverArt?: string;
  /** Where that credit was read: a URL, or an Internet Archive identifier with the quoted sentence. */
  coverArtSource?: string;
  /** The ISFDB publication record the credit comes from, for the link beside it. */
  isfdbRecord?: string;
  /** Why a known credit is not shown, e.g. the image is of another printing than the ISBN's. */
  creditWithheld?: string;
  /**
   * The Open Library work that holds this cover, when it is not `id`: a
   * translation filed as a work of its own (5.10i). The tile opens that wall,
   * where the cover exists, instead of the original's, where it does not.
   */
  coverWork?: string;
  /**
   * A cover served from the site itself, `/collection-covers/<slug>/<file>.jpg`,
   * for a printing Open Library has no image of and cannot take one for yet
   * (its cover store was down on 2026-09-26 when the Jules Verne collection
   * was ready). `coverId` is then `local:<file>`. A stopgap: once the image is
   * on Open Library, the pick gets its `ol:` id back and this goes.
   */
  image?: string;
  /** On a wall of sets (`setSize`): the edition this volume belongs to, shown once above its row. */
  set?: string;
}

/** A tile on a collection wall: a curated work, and its cover credit where the collection shows one. */
export interface WallWork extends CuratedWork {
  coverArtists?: string[];
  /** The credited artwork (`coverCredits: artwork`). */
  coverArt?: string;
  /** The work whose wall holds this cover, when it is not `id` (see CollectionPick). */
  coverWork?: string;
  /** The site's own image, when the pick has one (see CollectionPick); `coverId` is then 0. */
  image?: string;
  /** The edition's name on a wall of sets. */
  set?: string;
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
   *
   * `artwork` (Julian, 2026-09-27: „drafte virago mit belegten gemälden"):
   * the painting on the cover and its painter, as the book itself credits it
   * („The cover shows a detail from …"), taken from a source that quotes the
   * printing shown; a tile without a credit means none was found, not that
   * the picture is anonymous.
   */
  coverCredits?: 'isfdb' | 'artwork';
  /**
   * A wall of sets: every edition in `setSize` consecutive tiles, one set per
   * row (Julian, 2026-09-26: „harry potter serien. hier ausnahmsweise 7 bücher
   * nebeneinander. immer die 7 bücher einer serie"). Only 3 and 7 exist: 3
   * puts two sets side by side on a desktop (Lord of the Rings), 7 one.
   */
  setSize?: 3 | 7;
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
  coverCredits?: 'isfdb' | 'artwork';
  coverSource?: 'catalogue';
  setSize?: 3 | 7;
  works: WallWork[];
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isCollectionSlug(value: string): boolean {
  return SLUG.test(value);
}

/** The only form a site-served cover may take: a file under `public/collection-covers/`. */
const LOCAL_IMAGE = /^\/collection-covers\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9-]+\.jpg$/;

function coverNumber(coverId: string): number | null {
  if (!coverId.startsWith('ol:')) return null;
  const n = Number(coverId.slice(3));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Turns the file into collections a page can render.
 *
 * A pick without a usable cover is left out rather than shown as a blank
 * tile, and a cover listed twice keeps its first place; the same work with
 * another cover is a second tile. A record with a bad
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
      const image = coverId === null && p.image && LOCAL_IMAGE.test(p.image) ? p.image : undefined;
      // Once per cover, not once per work: a series can print one work in two
      // designs (Tolkien's green paperbacks and the 1980 edition, Julian 2026-09-26).
      const key = `${p.id}|${p.coverId}`;
      if ((coverId === null && !image) || seen.has(key) || isHiddenCover(p.coverId)) continue;
      seen.add(key);
      const credit = r.coverCredits === 'isfdb' && p.coverArtists?.length ? { coverArtists: p.coverArtists }
        : r.coverCredits === 'artwork' && p.coverArt ? { coverArt: p.coverArt } : {};
      works.push({ id: p.id, title: p.title, author: p.author, coverId: coverId ?? 0, ...credit, ...(p.coverWork && p.coverWork !== p.id ? { coverWork: p.coverWork } : {}), ...(image ? { image } : {}), ...(r.setSize && p.set ? { set: p.set } : {}) });
    }
    const scope = r.kind === 'series' ? (r.publishers ?? []) : (r.authors ?? []).map(a => a.name);
    out.push({ slug: r.slug, title: r.title, kind: r.kind, intro: r.intro, published: r.published, scope, works, ...(r.coverCredits ? { coverCredits: r.coverCredits } : {}), ...(r.coverSource ? { coverSource: r.coverSource } : {}), ...(r.setSize === 3 || r.setSize === 7 ? { setSize: r.setSize } : {}) });
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
export function coverLine(kind: CollectionKind, coverSource?: 'catalogue', ownImages = 0, scope?: string[], t: Translate = english): string {
  // A series without publisher names is a wall across publishers (the prize walls, 2026-09-30): no "printing in the series".
  if (kind === 'series' && scope && scope.length === 0) return t('one cover each, chosen by hand');
  // A site-served image is not Open Library's, so the line must not say it is (see CollectionPick.image).
  if (ownImages > 0 && kind === 'series') {
    return ownImages === 1
      ? t('each with the cover of its printing in the series — one of them photographed from a collector’s copy, as Open Library has no image of it yet')
      : t('each with the cover of its printing in the series — {n} of them photographed from a collector’s copy, as Open Library has no image of them yet', { n: ownImages });
  }
  if (coverSource === 'catalogue') return t('each with a cover from Open Library, not all of them chosen by hand yet');
  return kind === 'series'
    ? t('each with the cover Open Library holds for its printing in the series')
    : t('one cover each, chosen by hand');
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

/**
 * What a pick says about the printing behind its image. A /curate step can
 * only name a book and a cover (`applyOp` keeps friends from typing credits),
 * so a cover added to a draft arrives without them; the file, written by
 * Julian's tool from ISFDB and the printings themselves, has them.
 */
const PRINTING_FACTS = ['coverIsbn', 'coverArtists', 'coverArt', 'coverArtSource', 'isfdbRecord', 'creditWithheld'] as const;

/**
 * A published draft's content with the file's printing facts filled in where
 * the draft has none. Matched on work and cover together: a credit belongs to
 * one printing's image (6.52), so a draft that chose another cover for a work
 * gets nothing from the file's old one.
 */
function withFileFacts(draft: CollectionRecord, file: CollectionRecord): CollectionRecord {
  const byCover = new Map(file.works.map(w => [`${w.id}|${w.coverId}`, w]));
  const works = draft.works.map(w => {
    const known = byCover.get(`${w.id}|${w.coverId}`);
    if (!known) return w;
    const add: Partial<CollectionPick> = {};
    for (const key of PRINTING_FACTS) {
      if (w[key] === undefined && known[key] !== undefined) Object.assign(add, { [key]: known[key] });
    }
    return { ...w, ...add };
  });
  return {
    ...draft,
    works,
    ...(draft.coverCredits === undefined && file.coverCredits !== undefined ? { coverCredits: file.coverCredits } : {}),
  };
}

export function applyContent(records: CollectionRecord[], content: ContentOverrides): CollectionRecord[] {
  // A /curate draft knows no wall layout, so the file's set size survives its content;
  // nor printing facts, so the file's credits fill the covers it has too (withFileFacts).
  const out = records.map(r => (content[r.slug] ? { ...withFileFacts(content[r.slug], r), ...(r.setSize ? { setSize: r.setSize } : {}) } : r));
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

