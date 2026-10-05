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
  /**
   * An ISBN of a printing that carried this cover — the newest one's where it
   * has one. It names a printing, not the picture (E8): a shop link built from
   * it is a place to look, and the book page says whether the shop shows this cover.
   */
  isbn13?: string;
}

export function coversOfEditions(editions: readonly SourceEdition[]): EditionCover[] {
  const byCover = new Map<string, { year?: number; publisher?: string; isbn13?: string }>();
  for (const e of editions) {
    if (e.format === 'ebook') continue;
    for (const c of e.covers) {
      // A cover taken off the site on request (2.18k) is not offered for a board either.
      if (!/^ol:\d+$/.test(c.id) || isHiddenCover(c.id)) continue;
      const known = byCover.get(c.id);
      // The newest printing names the cover; one without a year never replaces one with.
      if (!known || (e.year ?? 0) > (known.year ?? 0)) {
        const publisher = e.publisher ?? known?.publisher;
        const isbn13 = e.isbn13 ?? known?.isbn13;
        byCover.set(c.id, { ...(e.year ? { year: e.year } : {}), ...(publisher ? { publisher } : {}), ...(isbn13 ? { isbn13 } : {}) });
      } else if (!known.isbn13 && e.isbn13) {
        known.isbn13 = e.isbn13;
      }
    }
  }
  return [...byCover.entries()]
    .map(([coverId, p]) => ({ coverId, ...p }))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

/** Three pages reach the older printings of most works; The Great Gatsby has 1,180 editions on record. */
export const EDITION_PAGES = 3;
const PAGE = 100;

export interface WorkCovers {
  title: string;
  author?: string;
  covers: EditionCover[];
  /** Editions looked at, of `total` on record — so the window can say what it has not seen. */
  checked: number;
  total: number;
}

/** Null when Open Library has no such work; throws when it does not answer (N12). */
export async function workCovers(workId: string): Promise<WorkCovers | null> {
  const work = await getWork(workId);
  if (!work) return null;
  const entries: OlEditionEntry[] = [];
  let total = 0;
  for (let offset = 0; offset < EDITION_PAGES * PAGE; offset += PAGE) {
    const page = await getEditionsPage(workId, offset);
    entries.push(...page.entries);
    total = page.size;
    if (offset + PAGE >= page.size) break;
  }
  return {
    title: work.title,
    ...(work.authors[0] ? { author: work.authors[0] } : {}),
    covers: coversOfEditions(parseEditions(entries, work)),
    checked: entries.length,
    total,
  };
}
