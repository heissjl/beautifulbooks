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
 * The language the user searched in leads, then English, then German, then
 * everything else by how many covers it has, with the unknown-language group
 * last.
 *
 * `groupCoversByLanguage` orders purely by size, which changes with every
 * page that arrives, so the tabs would reshuffle under the reader's cursor.
 * Pinning the first places means the row the reader actually points at stands
 * still; the tail may still reorder as counts grow, which is what the reader
 * expects of a long tail.
 *
 * A searched lead language leads too. The first version skipped that case to
 * avoid handing out the same position twice, which quietly threw away the two
 * commonest wishes: searching in German landed on the English tab with an
 * English cover selected (measured 2026-09-07).
 */
export function orderGroups(
  groups: readonly LanguageGroup[],
  preferred?: string,
): LanguageGroup[] {
  const wanted = preferred && preferred !== 'all' ? preferred : undefined;
  const lead = [...(wanted ? [wanted] : []), ...LEAD_LANGUAGES.filter(l => l !== wanted)];

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
 * The leading languages are pinned, so the row settles as soon as they are
 * known to be there or known to be absent. While the first page is still the
 * only one loaded, a group that has not turned up yet may still arrive and
 * push everything one place to the right; waiting for it costs a moment and
 * buys a row that does not move (Julian 2026-09-07).
 *
 * `preferred` is the language the reader searched in. Open Library returns
 * editions by record age, so a German group often appears only on page 2 or
 * 3; ending the scene before it arrives shows an English wall to someone who
 * asked for German, and then moves the tabs under their cursor. The caller
 * bounds the wait (`done`), so a language the work does not have costs at
 * most those pages.
 */
export function leadLanguagesSettled(
  groups: ReadonlyArray<{ language?: string }>,
  done: boolean,
  preferred?: string,
): boolean {
  if (done) return true;
  const wanted = preferred && preferred !== 'all' ? preferred : LEAD_LANGUAGES[0];
  return groups.some(g => g.language === wanted);
}
