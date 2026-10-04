/**
 * Which Calibre book is this cover for? (lab/calibre, ROADMAP 5.16)
 *
 * Pure. A match is **sure** only by a shared ISBN or by the same title and
 * the same author; everything else is a suggestion the tool shows and never
 * writes without a click on that very row. A translated title ("Per Anhalter
 * durch die Galaxis" for "The Hitchhiker's Guide to the Galaxy") matches
 * nothing — the same author's books are then offered, and Julian picks.
 */
import { sameAuthor, titleScore } from './site';
import type { CalibreBook } from './library';
import type { CoverPick } from './source';

/**
 * `mapped`, `isbn` and `title+author` are sure; `maybe` and `author` are
 * suggestions. `mapped` (5.17): the import made this tile from this book and
 * wrote that down (`map.ts`) — the one way a translated title finds its book.
 */
export type MatchKind = 'mapped' | 'isbn' | 'title+author' | 'maybe' | 'author';

export interface Candidate {
  bookId: number;
  kind: MatchKind;
}

export interface PickMatch {
  /** Best first; empty when nothing in the library resembles the pick. */
  candidates: Candidate[];
  /** Set only when exactly one book matches surely. */
  sure?: number;
}

const RANK: Record<MatchKind, number> = { mapped: -1, isbn: 0, 'title+author': 1, maybe: 2, author: 3 };
export const isSure = (kind: MatchKind): boolean => kind === 'mapped' || kind === 'isbn' || kind === 'title+author';

/** Work → book numbers, from the import's map; empty without one. */
export type Mapped = ReadonlyMap<string, readonly number[]>;
const NO_MAP: Mapped = new Map();

/** At most this many "same author" suggestions per pick. */
export const MAX_AUTHOR_SUGGESTIONS = 8;

function kindOf(pick: CoverPick, book: CalibreBook, mapped: Mapped): MatchKind | null {
  if (mapped.get(pick.workId)?.includes(book.id)) return 'mapped';
  if (pick.isbns.some((i) => book.isbns.includes(i))) return 'isbn';
  const author = !!pick.author && book.authors.some((a) => sameAuthor(pick.author as string, a));
  const title = titleScore(pick.title, book.title);
  if (title === 2 && author) return 'title+author';
  // Same title under another name, or a title inside the other with the same
  // author (a subtitle, a series prefix): likely, not certain.
  if (title === 2 || (title === 1 && author)) return 'maybe';
  if (author) return 'author';
  return null;
}

export function matchPick(pick: CoverPick, books: readonly CalibreBook[], mapped: Mapped = NO_MAP): PickMatch {
  const all: Candidate[] = [];
  for (const book of books) {
    const kind = kindOf(pick, book, mapped);
    if (kind) all.push({ bookId: book.id, kind });
  }
  all.sort((a, b) => RANK[a.kind] - RANK[b.kind] || a.bookId - b.bookId);
  const strong = all.filter((c) => c.kind !== 'author');
  const candidates = [...strong, ...all.filter((c) => c.kind === 'author').slice(0, MAX_AUTHOR_SUGGESTIONS)];
  // The import's word outranks a resemblance: one mapped book is the book, whatever else shares its title.
  const fromMap = candidates.filter((c) => c.kind === 'mapped');
  const sure = fromMap.length > 0 ? fromMap : candidates.filter((c) => isSure(c.kind));
  // Two copies of the same book in the library: which one is meant is Julian's call.
  return sure.length === 1 ? { candidates, sure: sure[0].bookId } : { candidates };
}

export const matchPicks = (picks: readonly CoverPick[], books: readonly CalibreBook[], mapped: Mapped = NO_MAP): PickMatch[] => picks.map((p) => matchPick(p, books, mapped));
