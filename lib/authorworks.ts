/**
 * "More by <author>" under the wall (ROADMAP 6.53, SPEC F2.15).
 *
 * Pure and client-safe: the route runs `otherWorksByAuthor` over Open
 * Library's author search, the browser runs `excludeCurrent` over the answer,
 * because the route's cache holds one answer per author, not per work.
 *
 * The rules were measured on eight author keys on 2026-09-26
 * (docs/plans/PLAN-6.53-other-works.md §4) and decided by Julian (§9).
 */
import type { WorkSummary } from './model';
import { looksLikeNonBook, looksLikeSecondaryLiterature, MARKED_DERIVATIVE, normalizeTitle } from './normalize';
import { mergeWorks } from './works';

/** One tile of the row: one cover, a title, the way to its wall. */
export interface AuthorWork {
  id: string;
  /** As the catalogue has it — Kafka appears as *Der Proceß* (Julian, 2026-09-26). */
  title: string;
  /** Open Library `cover_i`, or the cover Julian picked (data/curated.json). */
  coverId: number;
  /** Edition records, summed over the records identity rule 2 merged. */
  editionCount: number;
}

/** The subset of an Open Library search doc the row reads. */
export interface AuthorSearchDoc {
  key: string;
  title?: string;
  author_name?: string[];
  author_key?: string[];
  edition_count?: number;
  cover_i?: number;
}

/** Tiles on a wide screen and on a phone (Julian, 2026-09-26: „6 am desktop, 3 am handy"). */
export const ROW_DESKTOP = 6;
export const ROW_PHONE = 3;

/**
 * Candidates the route sends. More than six, because the browser still drops
 * the work itself, its siblings and same-titled records; twelve leaves room
 * for that without a second request.
 */
export const ROW_CANDIDATES = 12;

/**
 * The smallest record the row accepts: `max(2, 2 %)` of the author's largest
 * record (Julian, 2026-09-26: „streng"). Open Library files translations as
 * records of their own; a one- or two-edition record is almost always one
 * (Harper Lee: a Turkish *To Kill a Mockingbird* under its own title). The
 * price, accepted: Margaret Mitchell gets no row, only the line.
 */
export const MIN_EDITIONS_FLOOR = 2;
export const MIN_EDITIONS_SHARE = 0.02;

export function minEditions(largest: number): number {
  return Math.max(MIN_EDITIONS_FLOOR, largest * MIN_EDITIONS_SHARE);
}

/** An Open Library author key, the only thing the route accepts. */
export function isAuthorKey(raw: string): boolean {
  return /^OL\d{1,12}A$/.test(raw);
}

/**
 * A record that is one volume of a split edition, not a work: "Gone with the
 * Wind [2/2]", "Gone with the Wind. 2/3", "Vol. 2", "Band 3", "Volume I" (Austen's Juvenilia). Its title would sit next to the work's own.
 */
const VOLUME_PART = /[[(]\s*\d+\s*\/\s*[\d?]+\s*[\])]|[.,]\s*\d+\s*\/\s*[\d?]+\s*$|\b(vol|volume|bd|band|tome|tomo)\.?\s*(\d+|[ivx]{1,4})\b/i;

export function looksLikeVolumePart(title: string): boolean {
  return VOLUME_PART.test(title);
}

/**
 * The row's candidates from the author search, most-printed first.
 *
 * 1. The author's key must be the record's **first** — the rule of
 *    `authorCandidates` (lib/collectionedit.ts): otherwise anthologies,
 *    letters to her and books about her come along.
 * 2. No secondary literature, no marked adaptation, no non-book.
 * 3. No volume of a split edition.
 * 4. No record without a cover — the row is covers.
 * 5. At least `minEditions` of the author's largest record.
 * 6. Identity rule 2 (`mergeWorks`): same title, same author, one tile; the
 *    largest record gives id, title and cover.
 */
export function otherWorksByAuthor(
  docs: readonly AuthorSearchDoc[],
  authorKey: string,
  limit = ROW_CANDIDATES,
): AuthorWork[] {
  const own = docs.filter(d => d.author_key?.[0]?.replace('/authors/', '') === authorKey);
  const largest = own.reduce((n, d) => Math.max(n, d.edition_count ?? 0), 0);
  const floor = minEditions(largest);

  const coverOf = new Map<string, number>();
  const kept: WorkSummary[] = [];
  for (const d of own) {
    const title = d.title?.trim();
    if (!d.key || !title) continue;
    if (looksLikeSecondaryLiterature(title) || MARKED_DERIVATIVE.test(title) || looksLikeNonBook(title)) continue;
    if (looksLikeVolumePart(title)) continue;
    if (!d.cover_i || d.cover_i <= 0) continue;
    if ((d.edition_count ?? 0) < floor) continue;
    const id = d.key.replace('/works/', '');
    coverOf.set(id, d.cover_i);
    kept.push({
      id,
      title,
      authors: [d.author_name?.[0] ?? authorKey],
      authorKeys: [authorKey],
      editionCount: d.edition_count,
      coverUrls: [],
      languages: [],
    });
  }

  return mergeWorks(kept)
    .map(w => ({ id: w.id, title: w.title, coverId: coverOf.get(w.id) ?? 0, editionCount: w.editionCount ?? 0 }))
    .filter(w => w.coverId > 0)
    .sort((a, b) => b.editionCount - a.editionCount)
    .slice(0, limit);
}

/** Replaces a tile's cover by the one Julian picked, where he picked one (plan §9.8). */
export function withCuratedCovers(works: readonly AuthorWork[], curated: ReadonlyMap<string, number>): AuthorWork[] {
  return works.map(w => {
    const picked = curated.get(w.id);
    return picked ? { ...w, coverId: picked } : w;
  });
}

/**
 * What the reader gets on this page: without the work itself, its siblings
 * (6.13) and any record with the same title — then the first `limit`.
 * Runs in the browser, because the answer it filters is cached per author.
 */
export function excludeCurrent(
  works: readonly AuthorWork[],
  current: { id: string; title: string; siblingIds?: readonly string[] },
  limit = ROW_DESKTOP,
): AuthorWork[] {
  const skip = new Set([current.id, ...(current.siblingIds ?? [])]);
  const title = normalizeTitle(current.title);
  return works.filter(w => !skip.has(w.id) && normalizeTitle(w.title) !== title).slice(0, limit);
}

/**
 * The row's heading, which is also its link to a search for her. It names
 * the author and nothing else: no count, no "all" — the row shows the
 * most-printed records of one catalogue, and says nothing about the rest.
 */
export function authorRowHeading(author: string): string {
  return `More by ${author}`;
}

/**
 * Where the heading leads: the site's author search (ROADMAP 6.60), pinned to
 * her key when the work carries one. Until 6.60 it was the free-text search
 * for the name, which found books *about* her as readily as hers (Harper
 * Lee: 3 of 18). Built by hand rather than with `authorSearchPath`
 * (lib/authorsearch.ts), which imports this module.
 */
export function authorSearchHref(author: string, authorKey?: string): string {
  const params = new URLSearchParams({ author });
  if (authorKey && isAuthorKey(authorKey)) params.set('key', authorKey);
  return `/?${params}`;
}
