/**
 * Work identity, edition dedupe, relevance ranking and language grouping.
 * Pure functions, no I/O (SPEC.md §2, §3 F1.2–F1.4, F2.3–F2.4, F4).
 */
import type { Cover, Edition, LanguageGroup, SourceEdition, Work, WorkSummary } from './model';
import type { EditionCandidate } from './sources/googlebooks-parse';
import { authorMatchKey, looksLikeSecondaryLiterature, MARKED_DERIVATIVE, normalizeTitle, titleAuthorKey } from './normalize';
import { hamming, looksLikeScannedPage, type ImageSignature } from './imagesig';

export const MOSAIC_COVERS = 4;

function identityKey(w: { title: string; authors: string[] }): string {
  return titleAuthorKey(w.title, w.authors[0]);
}

function uniq<T>(xs: readonly T[]): T[] {
  return Array.from(new Set(xs));
}

/**
 * Identity rule 2 (SPEC §2.1): works with the same normalized title and
 * primary author are one work, even if Open Library has several ids for it.
 * The id of the member with the most editions survives; edition counts add
 * up, covers and languages are unioned.
 */
export function mergeWorks(works: readonly WorkSummary[]): WorkSummary[] {
  const byKey = new Map<string, WorkSummary>();
  for (const w of works) {
    const key = identityKey(w);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...w, coverUrls: [...w.coverUrls], languages: [...w.languages] });
      continue;
    }
    const takeIdFrom = (w.editionCount ?? 0) > (existing.editionCount ?? 0) ? w : existing;
    byKey.set(key, {
      id: takeIdFrom.id,
      title: takeIdFrom.title,
      authors: takeIdFrom.authors,
      firstPublishYear: minDefined(existing.firstPublishYear, w.firstPublishYear),
      editionCount: (existing.editionCount ?? 0) + (w.editionCount ?? 0) || undefined,
      coverUrls: uniq([...existing.coverUrls, ...w.coverUrls]),
      languages: uniq([...existing.languages, ...w.languages]),
      // The merged work is as popular and as highly ranked as its best member.
      popularity: {
        readinglog: maxDefined(existing.popularity?.readinglog, w.popularity?.readinglog),
        wantToRead: maxDefined(existing.popularity?.wantToRead, w.popularity?.wantToRead),
        ratings: maxDefined(existing.popularity?.ratings, w.popularity?.ratings),
      },
      sourceRank: minDefined(existing.sourceRank, w.sourceRank),
    });
  }
  return Array.from(byKey.values());
}

function minDefined(a?: number, b?: number): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

function maxDefined(a?: number, b?: number): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}


/** Assigns candidates to a known work (detail page). Non-matching ones are dropped. */
export function candidatesToSourceEditions(
  work: { id: string; title: string; authors: string[] },
  candidates: readonly EditionCandidate[],
): SourceEdition[] {
  const key = identityKey(work);
  return candidates.filter(c => identityKey(c) === key).map(c => toSourceEdition(work.id, c));
}

function toSourceEdition(workId: string, c: EditionCandidate): SourceEdition {
  const { authors, coverUrl, ...rest } = c;
  void authors;
  void coverUrl;
  return { ...rest, workId };
}

/** Merge key per SPEC §2.2: ISBN-13 when present, otherwise the source edition id. */
export function editionKey(e: Pick<Edition, 'id' | 'isbn13'>): string {
  return e.isbn13 ? `isbn:${e.isbn13}` : `id:${e.id}`;
}

function mergeEditionMeta(base: Edition, extra: Edition): Edition {
  return {
    ...base,
    language: base.language ?? extra.language,
    publisher: base.publisher ?? extra.publisher,
    publishedDate: base.publishedDate ?? extra.publishedDate,
    year: base.year ?? extra.year,
    isbn10: base.isbn10 ?? extra.isbn10,
    pageCount: base.pageCount ?? extra.pageCount,
    format: base.format ?? extra.format,
    previewUrl: base.previewUrl ?? extra.previewUrl,
    description: (extra.description?.length ?? 0) > (base.description?.length ?? 0) ? extra.description : base.description,
  };
}

/**
 * SPEC §2.1: translators are not authors. Open Library lists them among a
 * work's authors without a role, but they only appear on editions in a
 * language other than the work's main language. An author (never the first)
 * whose key occurs on no edition explicitly in the main language is dropped.
 * Editions without language data give no evidence either way (the Spanish
 * Mumbo Jumbo lacks a language field at Open Library). Requires author keys
 * on the work and on the editions; otherwise the work is returned unchanged.
 */
export function withoutTranslators(work: Work, editions: readonly SourceEdition[]): Work {
  if (!work.authorKeys || work.authorKeys.length !== work.authors.length || work.authors.length < 2) return work;
  const withKeys = editions.filter(e => e.authorKeys && e.authorKeys.length > 0);
  if (withKeys.length === 0) return work;

  const langCounts = new Map<string, number>();
  for (const e of withKeys) if (e.language) langCounts.set(e.language, (langCounts.get(e.language) ?? 0) + 1);
  let mainLanguage: string | undefined;
  let best = 0;
  for (const [lang, n] of langCounts) if (n > best) { mainLanguage = lang; best = n; }
  if (!mainLanguage) return work;

  const onMainLanguage = new Set<string>();
  const onAnyEdition = new Set<string>();
  for (const e of withKeys) {
    for (const k of e.authorKeys!) {
      onAnyEdition.add(k);
      if (e.language === mainLanguage) onMainLanguage.add(k);
    }
  }
  const keep = work.authors.map((_, i) => {
    if (i === 0) return true;
    const key = work.authorKeys![i];
    // Unknown to the editions: no evidence either way, keep.
    if (!onAnyEdition.has(key)) return true;
    return onMainLanguage.has(key);
  });
  if (keep.every(Boolean)) return work;
  return {
    ...work,
    authors: work.authors.filter((_, i) => keep[i]),
    authorKeys: work.authorKeys.filter((_, i) => keep[i]),
  };
}

export interface EditionsAndCovers {
  editions: Edition[];
  covers: Cover[];
}

/**
 * SPEC §2.2/§2.3 (E8): editions with the same ISBN become one edition with
 * merged metadata; every cover of every source survives and points at the
 * surviving edition. Cover identity is the image id, never the ISBN.
 */
export function assembleEditions(sources: readonly SourceEdition[]): EditionsAndCovers {
  const editionsByKey = new Map<string, Edition>();
  const coversById = new Map<string, Cover>();
  for (const src of sources) {
    const { covers, authorKeys, ...edition } = src;
    void authorKeys;
    const key = editionKey(edition);
    const existing = editionsByKey.get(key);
    const survivor = existing ? mergeEditionMeta(existing, edition) : edition;
    editionsByKey.set(key, survivor);
    for (const c of covers) {
      const cover = coversById.get(c.id);
      if (cover) {
        if (!cover.editionIds.includes(survivor.id)) cover.editionIds.push(survivor.id);
      } else {
        coversById.set(c.id, { id: c.id, url: c.url, urlSmall: c.urlSmall, source: src.source, editionIds: [survivor.id] });
      }
    }
  }
  return { editions: Array.from(editionsByKey.values()), covers: Array.from(coversById.values()) };
}

export const SECONDARY_PENALTY = 60;
/** Adaptations, graphic novels and study guides sit below the work itself. */
export const DERIVATIVE_PENALTY = 60;
/** A title match is a hint, not a verdict (SPEC §9.1 C). */
export const TITLE_EXACT = 20;
export const TITLE_PREFIX = 10;
export const TITLE_CONTAINS = 5;
/** Most a work can gain from having many readers. */
export const POPULARITY_WEIGHT = 40;
/** How much each place in the source's own ranking is worth. */
export const RANK_STEP = 5;
export const RANK_BASE = 100;
/** An edition count this many times larger marks the other work as the original. */
export const DERIVATIVE_EDITION_RATIO = 10;

/** Context a work is ranked in: its competitors decide what "popular" means here. */
export interface RankContext {
  /** log2 of the highest reading-list count in the result set. */
  maxPopularityLog: number;
  /** Ids of works that are adaptations or companions of another result. */
  derivatives: ReadonlySet<string>;
}

function readers(work: WorkSummary): number {
  return work.popularity?.readinglog ?? work.popularity?.wantToRead ?? 0;
}

export function rankContext(works: readonly WorkSummary[]): RankContext {
  const most = Math.max(0, ...works.map(readers));
  return { maxPopularityLog: Math.log2(most + 1), derivatives: derivativeIds(works) };
}

/**
 * Works that exist because another result exists (SPEC §9.3 step 10).
 *
 * Open Library files an adaptation, a graphic novel or a stage version as
 * its own work, with the adapter first and the original author second. So a
 * work whose *later* author is the primary author of a far larger work in the
 * same result set is a derivative of it: `1984 (adaptation)` by Michael Dean
 * and George Orwell against Orwell's own 537 editions.
 */
export function derivativeIds(works: readonly WorkSummary[]): Set<string> {
  const out = new Set<string>();
  const primaries = new Map<string, number>();
  for (const w of works) {
    const key = authorMatchKey(w.authors[0] ?? '');
    if (key) primaries.set(key, Math.max(primaries.get(key) ?? 0, w.editionCount ?? 0));
  }
  for (const w of works) {
    if (MARKED_DERIVATIVE.test(w.title)) { out.add(w.id); continue; }
    const mine = w.editionCount ?? 0;
    for (const author of w.authors.slice(1)) {
      const biggest = primaries.get(authorMatchKey(author));
      if (biggest !== undefined && biggest >= Math.max(1, mine) * DERIVATIVE_EDITION_RATIO) {
        out.add(w.id);
        break;
      }
    }
  }
  return out;
}

/**
 * Relevance per SPEC §3 F1.4 and §9.3 step 10.
 *
 * Open Library's own ranking is the starting point, because it is right far
 * more often than a title match: for `1984` it puts *Nineteen Eighty-Four*
 * first, while scoring the exact string put an eight-edition record above it.
 * Readers add up to POPULARITY_WEIGHT, measured against the most-read work in
 * the same result. The title match is a small bonus on top, and adaptations
 * and secondary literature are pushed below the work they descend from.
 */
export function relevance(work: WorkSummary, query: string, context?: RankContext): number {
  const ctx = context ?? rankContext([work]);
  const q = normalizeTitle(query);
  const t = normalizeTitle(work.title);

  let score = Math.max(0, RANK_BASE - RANK_STEP * (work.sourceRank ?? 0));
  if (ctx.maxPopularityLog > 0) {
    score += POPULARITY_WEIGHT * (Math.log2(readers(work) + 1) / ctx.maxPopularityLog);
  } else {
    // No reader counts anywhere: fall back to how widely the work was printed.
    score += Math.min(POPULARITY_WEIGHT, 6 * Math.log2((work.editionCount ?? 0) + 1));
  }
  if (q && t === q) score += TITLE_EXACT;
  else if (q && t.startsWith(q)) score += TITLE_PREFIX;
  else if (q && t.includes(q)) score += TITLE_CONTAINS;

  if (looksLikeSecondaryLiterature(work.title)) score -= SECONDARY_PENALTY;
  if (ctx.derivatives.has(work.id)) score -= DERIVATIVE_PENALTY;
  return score;
}

export function rankWorks(works: readonly WorkSummary[], query: string): WorkSummary[] {
  const context = rankContext(works);
  return works
    .map((w, i) => ({ w, i, s: relevance(w, query, context) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(x => x.w);
}

/**
 * SPEC §3 F1.2: with a language set, a work is shown if it has at least one
 * edition in that language. Works without language data are kept because
 * missing metadata is not evidence of absence.
 */
export function filterWorksByLanguage(works: readonly WorkSummary[], language: string | undefined): WorkSummary[] {
  if (!language || language === 'all') return [...works];
  return works.filter(w => w.languages.length === 0 || w.languages.includes(language));
}

/** Up to MOSAIC_COVERS distinct cover URLs (SPEC §3 F4). */
export function mosaicCovers(work: WorkSummary): string[] {
  return uniq(work.coverUrls).slice(0, MOSAIC_COVERS);
}

/** Language of a cover: the most common language among the editions carrying it. */
export function coverLanguage(cover: Cover, editionsById: ReadonlyMap<string, Edition>): string | undefined {
  const counts = new Map<string, number>();
  for (const id of cover.editionIds) {
    const lang = editionsById.get(id)?.language;
    if (lang) counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestN = 0;
  for (const [lang, n] of counts) if (n > bestN) { best = lang; bestN = n; }
  return best;
}

function coverYear(cover: Cover, editionsById: ReadonlyMap<string, Edition>): number {
  return Math.max(-1, ...cover.editionIds.map(id => editionsById.get(id)?.year ?? -1));
}

/**
 * SPEC §3 F2.3–F2.4: covers grouped by language, preferred language first,
 * then by size descending; unknown language last. Within a group newest first.
 */
export function groupCoversByLanguage(
  covers: readonly Cover[],
  editions: readonly Edition[],
  preferred?: string,
  signatures?: ReadonlyMap<string, ImageSignature>,
): LanguageGroup[] {
  const editionsById = new Map(editions.map(e => [e.id, e]));
  const groups = new Map<string | undefined, Cover[]>();
  for (const c of covers) {
    const lang = coverLanguage(c, editionsById);
    const list = groups.get(lang) ?? [];
    list.push(c);
    groups.set(lang, list);
  }
  const newestFirst = (a: Cover, b: Cover) => {
    // Title pages and blurb scans go last, however new the printing is.
    const pageA = looksLikeScannedPage(signatures?.get(a.id)) ? 1 : 0;
    const pageB = looksLikeScannedPage(signatures?.get(b.id)) ? 1 : 0;
    return pageA - pageB || coverYear(b, editionsById) - coverYear(a, editionsById);
  };
  return Array.from(groups.entries())
    .map(([language, cs]) => ({ language, covers: cs.sort(newestFirst) }))
    .sort((a, b) => {
      if (a.language === undefined) return 1;
      if (b.language === undefined) return -1;
      if (preferred && preferred !== 'all') {
        if (a.language === preferred) return -1;
        if (b.language === preferred) return 1;
      }
      return b.covers.length - a.covers.length || a.language.localeCompare(b.language);
    })
    .map(g => ({ language: g.language, coverIds: g.covers.map(c => c.id) }));
}

export const SAME_COVER_MAX_DISTANCE = 8;
/** Two covers on one ISBN are one printing; a rebound scan may differ this much. */
export const SAME_ISBN_MAX_DISTANCE = 20;
/** Same publisher and year: scans of one printing, allowed to differ this much. */
export const SAME_PRINTING_MAX_DISTANCE = 16;
/** Years this far apart still count as the same printing. */
export const SAME_PRINTING_YEAR_SLACK = 1;

export interface FoldThresholds {
  sameImage?: number;
  sameIsbn?: number;
  samePrinting?: number;
}

/** What the editions carrying a cover say about the printing it belongs to. */
interface Printing {
  isbns: Set<string>;
  publishers: string[];
  years: number[];
  languages: Set<string>;
}

const PUBLISHER_NOISE =
  /\b(verlag|books?|press|publishers?|publishing|editions?|edizioni|ediciones|éditions|yayinlari|yayınları|kitap|gmbh|ltd|inc|co|company|group|sa|ag)\b/g;

/**
 * The words that identify a publishing house, lowercased.
 *
 * The same house is printed many ways: "Alfred A. Knopf" and "Knopf, New
 * York", "Vintage" and "Vintage Books". Dropped are anything after a comma
 * (the place of publication), the legal form, the nouns every publisher
 * shares, and single letters (initials).
 */
export function publisherTokens(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .toLowerCase()
    .split(',')[0]
    .replace(/[^a-z0-9äöüßàáâçèéêëìíîïñòóôùúû ]/g, ' ')
    .replace(PUBLISHER_NOISE, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Same publishing house? True when one name's words are all contained in the
 * other's, so "Knopf" matches "Alfred A. Knopf" and "Vintage" matches
 * "Vintage International", while "Scribner" and "Lulu.com" stay apart. An
 * unknown or unrecognisable publisher matches nothing.
 */
export function samePublisher(a: string | undefined, b: string | undefined): boolean {
  const x = publisherTokens(a);
  const y = publisherTokens(b);
  if (x.length === 0 || y.length === 0) return false;
  const [small, large] = x.length <= y.length ? [x, y] : [y, x];
  const set = new Set(large);
  return small.every(t => set.has(t));
}

function printingOf(cover: Cover, editionsById: ReadonlyMap<string, Edition>): Printing {
  const out: Printing = { isbns: new Set(), publishers: [], years: [], languages: new Set() };
  for (const id of cover.editionIds) {
    const e = editionsById.get(id);
    if (!e) continue;
    if (e.isbn13) out.isbns.add(e.isbn13);
    if (e.publisher) out.publishers.push(e.publisher);
    if (e.year !== undefined) out.years.push(e.year);
    if (e.language) out.languages.add(e.language);
  }
  return out;
}

function shares<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  for (const v of a) if (b.has(v)) return true;
  return false;
}

/** Different known languages are different books, whatever the images look like. */
function languagesConflict(a: Printing, b: Printing): boolean {
  if (a.languages.size === 0 || b.languages.size === 0) return false;
  return !shares(a.languages, b.languages);
}

function sharePublisher(a: Printing, b: Printing): boolean {
  return a.publishers.some(x => b.publishers.some(y => samePublisher(x, y)));
}

function yearsClose(a: Printing, b: Printing): boolean {
  if (a.years.length === 0 || b.years.length === 0) return false;
  return a.years.some(x => b.years.some(y => Math.abs(x - y) <= SAME_PRINTING_YEAR_SLACK));
}

/**
 * Is this the same cover, given how far the images differ (SPEC §9.3 step 12)?
 *
 * A single threshold cannot do this. Measured on real works: identical scans
 * sit at distance 0-5, but the same design photographed twice reaches 12-16
 * (three Knopf 1987 printings of *Beloved*), and a catalogue scan against the
 * publisher's own image reaches 14-25 under one ISBN. Meanwhile *different*
 * books share layouts at distance 17-22 (Turkish paperbacks of *Gatsby*) and
 * the same public-domain artwork appears at 19 across unrelated publishers.
 * So distance alone only decides up to 8; beyond that the metadata must agree.
 */
export function sameCover(
  distance: number,
  a: Printing,
  b: Printing,
  thresholds: Required<FoldThresholds>,
): boolean {
  if (distance <= thresholds.sameImage) return true;
  if (languagesConflict(a, b)) return false;
  // One ISBN is one printing: a second image of it is the same book.
  if (distance <= thresholds.sameIsbn && shares(a.isbns, b.isbns)) return true;
  // Same house, same year: scans of one printing rather than a redesign.
  if (distance <= thresholds.samePrinting && sharePublisher(a, b) && yearsClose(a, b)) return true;
  return false;
}

/**
 * SPEC §2.3 phase 2 (§8.5, §9.3 step 12): covers showing the same design are
 * folded into one. `signatures` maps cover id to a perceptual hash; covers
 * without a signature (not fetched within the time budget) stay as they are
 * and fold on a later request once cached. `editions` supplies the ISBN,
 * publisher, year and language that decide the relaxed tiers; without it only
 * near-identical images fold.
 *
 * Nothing is dropped: images that look like a scanned page rather than a
 * cover are sorted to the end of their language group instead, because the
 * measures that identify them also match some real covers (see
 * `looksLikeScannedPage`).
 *
 * Representative of a group: an Open Library cover before a Google one
 * (Google images are often the current printing, OL scans the actual
 * edition), then the first seen. Edition ids are unioned; folded ids are
 * kept in `similarIds` so the UI can say "+2 similar".
 */
export function foldDuplicateCovers(
  covers: readonly Cover[],
  signatures: ReadonlyMap<string, ImageSignature>,
  editions: readonly Edition[] = [],
  thresholds: FoldThresholds = {},
): Cover[] {
  const limits: Required<FoldThresholds> = {
    sameImage: thresholds.sameImage ?? SAME_COVER_MAX_DISTANCE,
    sameIsbn: thresholds.sameIsbn ?? SAME_ISBN_MAX_DISTANCE,
    samePrinting: thresholds.samePrinting ?? SAME_PRINTING_MAX_DISTANCE,
  };
  const editionsById = new Map(editions.map(e => [e.id, e]));
  const printings = new Map(covers.map(c => [c.id, printingOf(c, editionsById)]));

  // Greedy grouping: each cover joins the first group whose representative it matches.
  const groups: Array<{ rep: Cover; members: Cover[] }> = [];
  for (const c of covers) {
    const sig = signatures.get(c.id);
    let target: { rep: Cover; members: Cover[] } | undefined;
    if (sig) {
      target = groups.find(g => {
        const rs = signatures.get(g.rep.id);
        if (!rs) return false;
        return sameCover(hamming(rs.hash, sig.hash), printings.get(g.rep.id)!, printings.get(c.id)!, limits);
      });
    }
    if (target) target.members.push(c);
    else groups.push({ rep: c, members: [c] });
  }

  return groups.map(g => {
    if (g.members.length === 1) return g.members[0];
    const rep = g.members.find(m => m.source === 'openlibrary') ?? g.members[0];
    const editionIds = uniq(g.members.flatMap(m => m.editionIds));
    const similarIds = g.members.filter(m => m.id !== rep.id).map(m => m.id);
    return { ...rep, editionIds, similarIds };
  });
}

/**
 * What a shop will actually send under an ISBN (SPEC §9.3 step 13).
 *
 * A purchase link goes to an ISBN, never to a cover: publishers reprint a
 * backlist title with a new jacket under the unchanged number, so the picture
 * on the wall and the book in the parcel can be different (§2.3). Measured on
 * *Beloved*, that is not a corner case: of the ISBNs where Google has an
 * image, half showed a different cover than the catalogue scan.
 *
 * The verdict reuses the wall's own folding rather than a second threshold.
 * If the shop's image folded into the selected cover, the shop is showing
 * this design; if it survived as its own tile, it is showing another one, and
 * that tile is what the buyer would get.
 */
export type IsbnVerdict =
  | { status: 'verified' }
  | { status: 'differs'; cover: Cover }
  /** Asked, and Google has no image for this ISBN. */
  | { status: 'unknown' }
  /** Asked, and the source did not answer: nothing may be concluded. */
  | { status: 'unavailable' }
  | { status: 'pending' };

export function verifyIsbnCover(
  selected: Cover,
  retailCoverIds: readonly string[],
  wall: readonly Cover[],
  asked: boolean,
  /** The lookup was attempted and failed, or the day's quota is gone. */
  unavailable = false,
): IsbnVerdict {
  // Order matters: a failed lookup must never read as "no image on record".
  if (unavailable) return { status: 'unavailable' };
  if (!asked) return { status: 'pending' };
  if (retailCoverIds.length === 0) return { status: 'unknown' };

  const isSelected = (id: string) => id === selected.id || (selected.similarIds ?? []).includes(id);
  if (retailCoverIds.some(isSelected)) return { status: 'verified' };

  // The shop's image survived folding, or folded into some other cover: that
  // is the design on the shelf.
  for (const id of retailCoverIds) {
    const shown = wall.find(c => c.id === id || (c.similarIds ?? []).includes(id));
    if (shown) return { status: 'differs', cover: shown };
  }
  return { status: 'unknown' };
}
