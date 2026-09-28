/**
 * The covers of one work as a picker shows them: one entry per image, with the
 * printings that carried it (pure; lab/walls).
 */
import type { SourceEdition } from '../../lib/model';
import { MAX_PRINTINGS, type Printing } from '../../lib/walls/model';

export interface PickableCover {
  coverId: string;
  printings: Printing[];
  /** Newest year among the printings, for sorting and the caption. */
  year?: number;
}

/**
 * Groups editions by cover id. E-book printings are left out (E21: the site
 * is about printed books, and a frame holds paper); an image carried only by
 * an e-book is left out with them.
 */
export function coversFromEditions(editions: readonly SourceEdition[]): PickableCover[] {
  const byCover = new Map<string, Printing[]>();
  for (const e of editions) {
    if (e.format === 'ebook') continue;
    const printing: Printing = {
      ...(e.isbn13 ? { isbn13: e.isbn13 } : {}),
      ...(e.isbn10 ? { isbn10: e.isbn10 } : {}),
      ...(e.publisher ? { publisher: e.publisher } : {}),
      ...(e.year ? { year: e.year } : {}),
    };
    for (const c of e.covers) {
      const id = c.id.replace(/^ol:/, '');
      if (!/^\d+$/.test(id)) continue;
      const list = byCover.get(id) ?? [];
      list.push(printing);
      byCover.set(id, list);
    }
  }
  return [...byCover.entries()]
    .map(([coverId, printings]) => {
      const sorted = printings.sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).slice(0, MAX_PRINTINGS);
      return { coverId, printings: sorted, ...(sorted[0]?.year ? { year: sorted[0].year } : {}) };
    })
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}
