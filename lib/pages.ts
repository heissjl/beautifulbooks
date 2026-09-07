/**
 * Merging the pages of a work's editions (SPEC §9.3 step 11).
 *
 * Open Library serves editions 100 at a time, newest record first, so a
 * single page shows only the most recently catalogued printings. The detail
 * page keeps loading pages in the background; these pure functions combine
 * what has arrived so far and keep the language tabs from reshuffling while
 * it does. No I/O, safe on the client.
 */
import type { Cover, Edition, LanguageGroup } from './model';
import type { ImageSignature } from './imagesig';

/**
 * One page as delivered by GET /api/works/[id]?offset=…
 *
 * Generic in the edition type so the client can merge pages of `EditionView`
 * (editions with their buy links) without losing them to `Edition`.
 */
export interface WorkPageData<E extends Edition = Edition> {
  editions: E[];
  covers: Cover[];
  /** Perceptual signature per cover id, for the covers of this page. */
  signatures?: Record<string, ImageSignature>;
  page: PageInfo;
}

export interface PageInfo {
  offset: number;
  limit: number;
  /** Total number of edition records the source has for this work. */
  total: number;
  /** Offset of the next page, absent when there is nothing more to load. */
  nextOffset?: number;
}

/** Why loading stopped before every edition was seen. */
export type Truncation = 'cap' | 'error' | null;

export interface MergedWork<E extends Edition = Edition> {
  editions: E[];
  covers: Cover[];
  signatures: Map<string, ImageSignature>;
  /** Edition records scanned so far, i.e. the sum of the pages requested. */
  checked: number;
  total: number;
  done: boolean;
  truncated: Truncation;
}

export interface MergeStatus {
  done: boolean;
  truncated: Truncation;
}

/**
 * Combines the pages loaded so far. Editions are unique by id, covers by id
 * with their `editionIds` unioned, because Google Books contributes the same
 * cover for editions found on several pages.
 *
 * Editions carrying the same ISBN on *different* pages are not merged here:
 * `assembleEditions` does that within a page, and doing it across pages would
 * make an edition's identity depend on how far loading has got. Duplicate
 * covers of such editions are folded by image instead (SPEC §9.3 step 12).
 */
export function mergeWorkPages<E extends Edition>(pages: readonly WorkPageData<E>[], status: MergeStatus): MergedWork<E> {
  const editions = new Map<string, E>();
  const covers = new Map<string, Cover>();
  const signatures = new Map<string, ImageSignature>();
  let checked = 0;
  let total = 0;

  for (const page of pages) {
    for (const edition of page.editions) {
      if (!editions.has(edition.id)) editions.set(edition.id, edition);
    }
    for (const cover of page.covers) {
      const existing = covers.get(cover.id);
      if (!existing) {
        covers.set(cover.id, { ...cover, editionIds: [...cover.editionIds] });
        continue;
      }
      for (const id of cover.editionIds) {
        if (!existing.editionIds.includes(id)) existing.editionIds.push(id);
      }
    }
    for (const [id, sig] of Object.entries(page.signatures ?? {})) signatures.set(id, sig);
    checked += Math.min(page.page.limit, Math.max(0, page.page.total - page.page.offset));
    total = Math.max(total, page.page.total);
  }

  return {
    editions: Array.from(editions.values()),
    covers: Array.from(covers.values()),
    signatures,
    checked: Math.min(checked, total),
    total,
    done: status.done,
    truncated: status.truncated,
  };
}

/**
 * Orders the language tabs by when each language first showed up.
 *
 * `groupCoversByLanguage` orders by group size, which changes with every page
 * that arrives, so the tabs would reshuffle under the user's cursor while a
 * work loads. First appearance is stable instead: pages are appended, never
 * reordered, so a language seen on page 0 stays ahead of one that turns up on
 * page 7, and new languages join at the end. The language the user searched
 * in still comes first (SPEC F2.3), and covers whose editions carry no
 * language stay last.
 */
export function orderGroups(
  groups: readonly LanguageGroup[],
  coverOrder: readonly string[],
  preferred?: string,
): LanguageGroup[] {
  const position = new Map(coverOrder.map((id, i) => [id, i]));
  const firstSeen = (g: LanguageGroup) =>
    Math.min(...g.coverIds.map(id => position.get(id) ?? Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  const wanted = preferred && preferred !== 'all' ? preferred : undefined;

  return groups
    .map((group, i) => ({ group, rank: firstSeen(group), i }))
    .sort((a, b) => {
      if (a.group.language === undefined) return 1;
      if (b.group.language === undefined) return -1;
      if (wanted) {
        if (a.group.language === wanted) return -1;
        if (b.group.language === wanted) return 1;
      }
      return a.rank - b.rank || a.i - b.i;
    })
    .map(x => x.group);
}
