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
import { type ChosenEdition, chosenEdition } from './edition';

export interface DescribedBook {
  workId: string;
  coverId: string;
  title: string | null;
  author: string | null;
  /** `/book/<work>/cover/<cover>`: the book's page with this cover selected, its shops and its verdict. */
  href: string;
  /** Year and publisher of the printing this cover belongs to, when asked for and on record. */
  edition?: ChosenEdition;
}

export interface DescribedBoard {
  /** Nine entries, row by row; null is an empty place. */
  books: (DescribedBook | null)[];
  by: string;
  sub: string;
}

/** `editions`: also look up the printing of each chosen cover — the shared page only; a poster does not need it. */
export async function describeBoard(board: Board, { editions = false }: { editions?: boolean } = {}): Promise<DescribedBoard> {
  const books = await Promise.all(board.slots.map(async slot => {
    if (!slot) return null;
    const [known, edition] = await Promise.all([
      listedWork(slot.workId) ?? getWork(slot.workId).then(w => (w ? { title: w.title, author: w.authors[0] } : null)).catch(() => null),
      editions ? chosenEdition(slot.coverId) : null,
    ]);
    return {
      ...slot,
      ...(edition ? { edition } : {}),
      title: known?.title ?? null,
      author: known?.author ?? null,
      href: `/book/${slot.workId}/cover/${coverSegment(slot.coverId)}`,
    };
  }));
  return { books, by: board.by, sub: board.sub };
}
