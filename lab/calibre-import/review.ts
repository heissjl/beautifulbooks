/**
 * What Julian decided on the review page, laid over what the catalogue said
 * (lab/calibre-import, ROADMAP 5.17). Pure.
 *
 * A match is ticked, a suggestion is not (the "maybe" rule of 5.11a: a hit by
 * the title alone, or by the author alone, was a guess every time it was
 * looked at). A decision overrides that per book and is kept between runs; a
 * work chosen by hand replaces the catalogue's and is ticked.
 */
import type { Tile } from '../../lib/walls/model';
import type { CalibreBook } from '../calibre/library';
import type { Assignment, AssignReason, AssignStatus } from './assign';
import type { BookQuery } from './clean';

export interface Decision {
  include?: boolean;
  /** A work Julian searched and chose himself. */
  tile?: Tile;
}

export type Decisions = Record<string, Decision>;

export interface Row {
  book: Pick<CalibreBook, 'id' | 'title' | 'authors' | 'hasCover'>;
  /** `unasked`: the book came into the library after the last measurement. */
  status: AssignStatus | 'unasked';
  reason?: AssignReason;
  query?: BookQuery;
  tile?: Tile;
  byHand: boolean;
  include: boolean;
}

export function rowsOf(books: readonly CalibreBook[], assignments: readonly Assignment[], decisions: Decisions): Row[] {
  const byBook = new Map(assignments.map((a) => [a.bookId, a]));
  return books.map((b) => {
    const a = byBook.get(b.id);
    const d = decisions[String(b.id)] ?? {};
    const tile = d.tile ?? a?.tile;
    const wanted = d.include ?? (d.tile ? true : a?.status === 'match');
    return {
      book: { id: b.id, title: b.title, authors: b.authors, hasCover: b.hasCover },
      status: a?.status ?? 'unasked',
      ...(a?.reason ? { reason: a.reason } : {}),
      ...(a?.query ? { query: a.query } : {}),
      ...(tile ? { tile } : {}),
      byHand: !!d.tile,
      // Nothing without a work can go into a collection, whatever was ticked before.
      include: !!tile && wanted,
    };
  });
}

/** The ticked rows as the assignments `tilesOf` takes. */
export const included = (rows: readonly Row[]): Array<{ bookId: number; tile: Tile }> =>
  rows.filter((r): r is Row & { tile: Tile } => r.include && !!r.tile).map((r) => ({ bookId: r.book.id, tile: r.tile }));
