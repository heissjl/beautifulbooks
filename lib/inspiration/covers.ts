/**
 * The covers of one work as the editions window shows them (ROADMAP 5.18b).
 *
 * `coversOfEditions` is pure: one entry per image, with the year and the
 * publisher of the newest printing that carried it, newest first. E-book
 * records are left out (E21: the site is about printed books). The same
 * grouping as `lab/walls/covers.ts`, without the printings a collection
 * keeps — a board keeps only the image.
 *
 * `workCovers` asks Open Library and **never Google**: a page meant to be
 * passed around must not spend the quota the verdicts live on (E10), which is
 * why it does not go through `getWorkPage`.
 */
import { isHiddenCover } from '../hiddencovers';
import type { SourceEdition } from '../model';
import { getEditionsPage, getWork } from '../sources/openlibrary';
import { parseEditions, type OlEditionEntry } from '../sources/openlibrary-parse';

export interface EditionCover {
  /** `ol:<number>` */
  coverId: string;
  year?: number;
  publisher?: string;
}

/**
 * A publisher's name whose letters were lost before it reached Open Library:
 * „Do?u Bat? Yay?nlar?" for Doğu Batı Yayınları, stored with literal question
 * marks. A `?` between two letters, or the replacement character, marks it.
 * Measured 2026-10-06 on the 581 publisher names in the recorded fixtures: one
 * such name, and no other `?` at all. Such a name is left out; the year stays.
 */
export const garbled = (name: string): boolean => /\p{L}\?\p{L}/u.test(name) || name.includes('\uFFFD');

export function coversOfEditions(editions: readonly SourceEdition[]): EditionCover[] {
  const byCover = new Map<string, { year?: number; publisher?: string }>();
  for (const e of editions) {
    if (e.format === 'ebook') continue;
    for (const c of e.covers) {
      // A cover taken off the site on request (2.18k) is not offered for a board either.
      if (!/^ol:\d+$/.test(c.id) || isHiddenCover(c.id)) continue;
      const known = byCover.get(c.id);
      const publisher = e.publisher && !garbled(e.publisher) ? e.publisher : undefined;
      // The newest printing names the cover; one without a year never replaces one with.
      if (!known || (e.year ?? 0) > (known.year ?? 0)) {
        byCover.set(c.id, { ...(e.year ? { year: e.year } : {}), ...(publisher ? { publisher } : known?.publisher ? { publisher: known.publisher } : {}) });
      }
    }
  }
  return [...byCover.entries()]
    .map(([coverId, p]) => ({ coverId, ...p }))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

/**
 * Three pages reach the older printings of most works; The Great Gatsby has
 * 1,180 editions on record. A reader who wants to see further asks for the
 * next three (Julian, 2026-10-05: „make an option to load more covers").
 */
export const EDITION_PAGES = 3;
export const PAGE = 100;
/** How far back a reader may ask: Open Library's own editions list ends there too. */
export const MAX_FROM = 10_000;

export interface WorkCovers {
  title: string;
  author?: string;
  /** The covers of the editions from `from` on — three pages of them. */
  covers: EditionCover[];
  /** Where this slice began: 0, 300, 600 … */
  from: number;
  /** Editions looked at so far, from the start to the end of this slice, of `total` on record — so the window can say what it has not seen. */
  checked: number;
  total: number;
}

/**
 * Null when Open Library has no such work; throws when it does not answer
 * (N12). `from` is a multiple of `PAGE`: the first call looks at editions
 * 0–299, "more" at 300–599, and so on; the window joins the slices.
 */
export async function workCovers(workId: string, from = 0): Promise<WorkCovers | null> {
  const work = await getWork(workId);
  if (!work) return null;
  const entries: OlEditionEntry[] = [];
  let total = 0;
  let looked = from;
  for (let offset = from; offset < from + EDITION_PAGES * PAGE; offset += PAGE) {
    const page = await getEditionsPage(workId, offset);
    entries.push(...page.entries);
    total = page.size;
    looked = Math.min(offset + PAGE, page.size);
    if (offset + PAGE >= page.size) break;
  }
  return {
    title: work.title,
    ...(work.authors[0] ? { author: work.authors[0] } : {}),
    covers: coversOfEditions(parseEditions(entries, work)),
    from,
    checked: Math.max(looked, Math.min(from, total)),
    total,
  };
}
