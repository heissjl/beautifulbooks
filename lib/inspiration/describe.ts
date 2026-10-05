/**
 * A board with the words a page needs: titles, authors and the address of
 * each book's page with the chosen cover selected (ROADMAP 5.18b; server only).
 *
 * The address carries ids, not titles, so a shared page has to look the
 * titles up: from the browse lists where they know the work (no request),
 * otherwise from Open Library (cached a day, like every work). A work whose
 * title does not come is shown without one — the cover is still there, and a
 * silent catalogue is not a missing book (N12).
 */
import { getWork } from '../sources/openlibrary';
import { type Board, coverSegment } from './board';
import { listedWork } from './browse';

export interface DescribedBook {
  workId: string;
  coverId: string;
  title: string | null;
  author: string | null;
  /** `/book/<work>/cover/<cover>`: the book's page with this cover selected, its shops and its verdict. */
  href: string;
}

export interface DescribedBoard {
  /** Nine entries, row by row; null is an empty place. */
  books: (DescribedBook | null)[];
  by: string;
}

export async function describeBoard(board: Board): Promise<DescribedBoard> {
  const books = await Promise.all(board.slots.map(async slot => {
    if (!slot) return null;
    const known = listedWork(slot.workId) ?? (await getWork(slot.workId).then(w => (w ? { title: w.title, author: w.authors[0] } : null)).catch(() => null));
    return {
      ...slot,
      title: known?.title ?? null,
      author: known?.author ?? null,
      href: `/book/${slot.workId}/cover/${coverSegment(slot.coverId)}`,
    };
  }));
  return { books, by: board.by };
}
