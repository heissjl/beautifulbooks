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
 * Languages that lead the tab row, in this order, whatever the counts say.
 *
 * English and German are the markets this site is built for (E9), and they
 * are the tabs a reader looks for first. Fixing them also removes the worst
 * of the reshuffling: they are the two groups that grow fastest while later
 * pages arrive.
 */
export const LEAD_LANGUAGES = ['en', 'de'] as const;

/**
 * Orders the language tabs (SPEC §9.3 step 12, Julian 2026-09-07).
 *
 * English first, then German, then everything else by how many covers it has,
 * with the unknown-language group last. The language the user searched in
 * comes before all of them.
 *
 * `groupCoversByLanguage` orders purely by size, which changes with every
 * page that arrives, so the tabs would reshuffle under the reader's cursor.
 * Pinning the first two positions means the row the reader actually points at
 * stands still; the tail may still reorder as counts grow, which is what the
 * reader expects of a long tail.
 */
export function orderGroups(
  groups: readonly LanguageGroup[],
  preferred?: string,
): LanguageGroup[] {
  const wanted = preferred && preferred !== 'all' && !LEAD_LANGUAGES.includes(preferred as 'en' | 'de')
    ? preferred
    : undefined;
  const lead = [...(wanted ? [wanted] : []), ...LEAD_LANGUAGES];

  const rank = (g: LanguageGroup): number => {
    if (g.language === undefined) return lead.length + 1;
    const i = lead.indexOf(g.language);
    return i === -1 ? lead.length : i;
  };

  return groups
    .map((group, i) => ({ group, i }))
    .sort((a, b) => {
      const byLead = rank(a.group) - rank(b.group);
      if (byLead !== 0) return byLead;
      // Inside the tail, the bigger group first; ties keep the incoming order.
      if (rank(a.group) === lead.length) return b.group.coverIds.length - a.group.coverIds.length || a.i - b.i;
      return a.i - b.i;
    })
    .map(x => x.group);
}

/**
 * Is the wall ready to be shown without the tabs jumping afterwards?
 *
 * The lead languages are pinned, so the row settles as soon as they are known
 * to be there or known to be absent. While the first page is still the only
 * one loaded, an English group that has not turned up yet may still arrive
 * and push everything one place to the right; waiting for it costs a moment
 * and buys a row that does not move (Julian 2026-09-07).
 */
export function leadLanguagesSettled(groups: ReadonlyArray<{ language?: string }>, done: boolean): boolean {
  if (done) return true;
  return groups.some(g => g.language === LEAD_LANGUAGES[0]);
}
