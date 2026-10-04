/**
 * Which work is this Calibre book? (lab/calibre-import, ROADMAP 5.17)
 *
 * Two ways, in this order: the book's ISBN (the edition names its work and
 * carries its own covers), then title and first author through the same
 * matching the shelf photo uses (`matchPhotoBook`) — a Calibre book is a
 * spine read without mistakes.
 *
 * A **match** goes into the collection; a **suggestion** is shown to Julian
 * and goes nowhere without his tick. Only two things make a match: an ISBN
 * whose work also agrees with the book in author or title, or author and
 * title together. For the shelf photo "same author, another title" is a
 * usable hit; for an import that writes covers back into a library it is
 * not, so the reason is read here and not taken from `unsure`.
 *
 * The catalogue is passed in, so the tests run without a network.
 */
import { sameAuthor, titleScore } from '../../lib/bookmatch';
import type { WorkSummary } from '../../lib/model';
import { normalizeTitle } from '../../lib/normalize';
import { validTile, type Tile } from '../../lib/walls/model';
import { matchPhotoBook, tileFromWork } from '../../lib/walls/photo';
import type { CalibreBook } from '../calibre/library';
import { cleanBook, type BookQuery } from './clean';
import type { IsbnEdition } from './lookup';

/**
 * `isbn`: the ISBN's work, and author or title agree. `isbn-only`: the ISBN
 * names a work that shares neither with the book — Calibre's metadata
 * download can attach a wrong ISBN. `author+part`: the author agrees and the
 * work's title is longer than the book's and merely contains it — measured
 * on Julian's library (2026-10-03), four of seven such works were another
 * book: the box of the trilogy for "MaddAddam", a picture book for "Pippi
 * Langstrumpf". The other way round (the book's title is the longer one: a
 * volume number, an unmarked subtitle) was right five times of five and
 * stays a match. The other three are `pickWork`'s.
 */
export type AssignReason = 'isbn' | 'isbn-only' | 'author+title' | 'author+part' | 'author' | 'title-only';

export type AssignStatus =
  /** Goes into the collection. */
  | 'match'
  /** Shown, not ticked. */
  | 'suggestion'
  /** The catalogue answered and has nothing that resembles the book. */
  | 'none'
  /** Nothing to ask with: no author or no title. */
  | 'skipped'
  /** The catalogue did not answer; asked again on the next run. */
  | 'failed';

export interface Assignment {
  bookId: number;
  status: AssignStatus;
  reason?: AssignReason;
  /** What was asked, absent when skipped. */
  query?: BookQuery;
  tile?: Tile;
}

export interface AssignSources {
  isbn(isbn13: string): Promise<IsbnEdition | null>;
  find(query: string): Promise<WorkSummary[]>;
}

export const isMatch = (reason: AssignReason): boolean => reason === 'isbn' || reason === 'author+title';

/** The work's title contains the book's and says more. */
function onlyPart(bookTitle: string, workTitle: string): boolean {
  return titleScore(bookTitle, workTitle) === 1 && normalizeTitle(workTitle).length > normalizeTitle(bookTitle).length;
}

/** The tile for an ISBN's edition: its own cover with the ISBN as a printing, else the work's usual cover without one (E8). */
function isbnTile(edition: IsbnEdition, work: WorkSummary, isbn13: string): Tile | undefined {
  if (edition.covers.length === 0) return tileFromWork(work);
  try {
    return validTile({ workId: work.id, coverId: String(edition.covers[0]), title: work.title, author: work.authors[0], printings: [{ isbn13 }] });
  } catch {
    return undefined;
  }
}

async function byIsbn(query: BookQuery, sources: AssignSources): Promise<Pick<Assignment, 'reason' | 'tile'> | null> {
  for (const isbn of query.isbns) {
    const edition = await sources.isbn(isbn);
    if (!edition) continue;
    // Title, author and the usual cover come from the search index; a work missing there is found by title below.
    const work = (await sources.find(`key:/works/${edition.workId}`)).find((w) => w.id === edition.workId);
    if (!work) continue;
    const tile = isbnTile(edition, work, isbn);
    if (!tile) continue;
    const agrees = sameAuthor(query.author, work.authors[0] ?? '') || titleScore(query.title, work.title) > 0;
    return { reason: agrees ? 'isbn' : 'isbn-only', tile };
  }
  return null;
}

export async function assignBook(book: CalibreBook, sources: AssignSources): Promise<Assignment> {
  const query = cleanBook(book);
  if (!query) return { bookId: book.id, status: 'skipped' };
  try {
    const hit = await byIsbn(query, sources);
    if (hit?.reason && hit.tile) return { bookId: book.id, status: isMatch(hit.reason) ? 'match' : 'suggestion', reason: hit.reason, query, tile: hit.tile };
  } catch {
    return { bookId: book.id, status: 'failed', query };
  }
  const found = await matchPhotoBook({ title: query.title, author: query.author, kind: 'spine' }, sources.find);
  if (found.failed) return { bookId: book.id, status: 'failed', query };
  if (!found.tile || !found.reason || found.reason === 'first-result') return { bookId: book.id, status: 'none', query };
  const reason: AssignReason = found.reason === 'author+title' && onlyPart(query.title, found.tile.title) ? 'author+part' : found.reason;
  return { bookId: book.id, status: isMatch(reason) ? 'match' : 'suggestion', reason, query, tile: found.tile };
}

/** Every book, a few at a time, each result handed on as it arrives. Resolves in the library's order. */
export async function assignAll(
  books: readonly CalibreBook[],
  sources: AssignSources,
  onDone: (assignment: Assignment, done: number) => void = () => {},
  atOnce = 3,
): Promise<Assignment[]> {
  const out: Assignment[] = new Array(books.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < books.length) {
      const i = next++;
      out[i] = await assignBook(books[i], sources);
      onDone(out[i], ++done);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(atOnce, books.length)) }, worker));
  return out;
}

export interface Tally {
  books: number;
  match: number;
  suggestion: number;
  none: number;
  skipped: number;
  failed: number;
  byReason: Record<AssignReason, number>;
  /** Books that can be asked about at all: everything but the skipped. */
  askable: number;
}

export function tally(assignments: readonly Assignment[]): Tally {
  const t: Tally = { books: assignments.length, match: 0, suggestion: 0, none: 0, skipped: 0, failed: 0, askable: 0, byReason: { isbn: 0, 'isbn-only': 0, 'author+title': 0, 'author+part': 0, author: 0, 'title-only': 0 } };
  for (const a of assignments) {
    t[a.status]++;
    if (a.reason) t.byReason[a.reason]++;
  }
  t.askable = t.books - t.skipped;
  return t;
}

/**
 * The collection's tiles: one per work, in the library's order. Two copies of
 * a book in Calibre are one tile; `bookWorks` keeps both books for the way back.
 */
export function tilesOf(chosen: ReadonlyArray<Pick<Assignment, 'bookId' | 'tile'>>): { tiles: Tile[]; bookWorks: Array<{ bookId: number; workId: string }> } {
  const tiles: Tile[] = [];
  const seen = new Set<string>();
  const bookWorks: Array<{ bookId: number; workId: string }> = [];
  for (const a of chosen) {
    if (!a.tile) continue;
    bookWorks.push({ bookId: a.bookId, workId: a.tile.workId });
    if (seen.has(a.tile.workId)) continue;
    seen.add(a.tile.workId);
    tiles.push(a.tile);
  }
  return { tiles, bookWorks };
}

const pct = (n: number, of: number): string => (of === 0 ? '–' : `${Math.round((n / of) * 100)} %`);

/** The numbers PLAN-5.17 §2 asks for, as text. */
export function report(assignments: readonly Assignment[]): string {
  const t = tally(assignments);
  const { tiles } = tilesOf(assignments.filter((a) => a.status === 'match'));
  return [
    `${t.books} books, ${t.skipped} skipped (no author or no title), ${t.askable} asked about`,
    `  match        ${t.match}  (${pct(t.match, t.askable)} of those asked about)`,
    `    by ISBN            ${t.byReason.isbn}`,
    `    by author + title  ${t.byReason['author+title']}`,
    `  suggestion   ${t.suggestion}  (${pct(t.suggestion, t.askable)})`,
    `    same author, a longer title ${t.byReason['author+part']}`,
    `    same author, another title  ${t.byReason.author}`,
    `    title only                  ${t.byReason['title-only']}`,
    `    ISBN, nothing else agrees   ${t.byReason['isbn-only']}`,
    `  not found    ${t.none}  (${pct(t.none, t.askable)})`,
    `  no answer    ${t.failed}  (asked again on the next run)`,
    `  tiles from the matches: ${tiles.length} (two copies of a book are one tile)`,
  ].join('\n');
}

/** A fixed shuffle, so a sample can be drawn again and checked by a second pair of eyes. */
export function sample<T>(items: readonly T[], n: number, seed = 517): T[] {
  const pool = [...items];
  let state = seed >>> 0;
  const random = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
