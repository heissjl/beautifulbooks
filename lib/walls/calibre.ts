/**
 * A Calibre book to a tile (ROADMAP 5.17a, measured as lab/calibre-import, 5.17).
 * Server only: it asks Open Library through `lib/search.ts` and
 * `getEditionByIsbn`, never Google.
 *
 * The browser has read the reader's `metadata.db` and cleaned each book
 * (`lib/calibre/clean.ts`); what arrives here is a title, a first author and
 * the ISBNs, a few books per request. Two ways, in this order: the ISBN —
 * the edition names its work and carries **its own** covers, so the tile
 * starts with the printing the reader has — then author and title through the
 * photo's matching (`matchPhotoBook`): a Calibre book is a spine read without
 * mistakes.
 *
 * A **match** is ticked, a **suggestion** shown as "maybe" and not ticked.
 * Only two things make a match: an ISBN whose work also agrees with the book
 * in author or title, or author and title together. Measured on Julian's
 * library (445 books, 2026-10-03): 328 matches, 1 wrong in a sample of 40;
 * of 27 "same author, another title" about 23 were the right work — mostly
 * translations ("Der Schnupfen" → *Katar*) — and still stay suggestions,
 * because the title comparison cannot confirm them.
 */
import { sameAuthor, titleScore } from '@/lib/bookmatch';
import type { WorkSummary } from '@/lib/model';
import { normalizeTitle } from '@/lib/normalize';
import { search } from '@/lib/search';
import { getEditionByIsbn, type IsbnEdition } from '@/lib/sources/openlibrary';
import type { BookQuery } from '@/lib/calibre/clean';
import { CALIBRE_BOOKS_PER_REQUEST } from '@/lib/calibre/limits';
import { validTile, WallError, type Tile } from './model';
import { matchPhotoBook, tileFromWork, PHOTO_SEARCHES_AT_ONCE } from './photo';

export { CALIBRE_BOOKS_PER_REQUEST, MAX_CALIBRE_BOOKS } from '@/lib/calibre/limits';

/**
 * `isbn`: the ISBN's work, and author or title agree. `isbn-only`: the ISBN
 * names a work that shares neither with the book — Calibre's metadata
 * download can attach a wrong ISBN. `author+part`: the author agrees and the
 * work's title is longer than the book's and merely contains it — of seven
 * such on Julian's library two were plainly another book (the box of the
 * trilogy for "MaddAddam", a picture book for "Pippi Langstrumpf"), two
 * doubtful, three right. The other way round (the book's title is the longer:
 * a volume number, an unmarked subtitle) was right five times of five and
 * stays a match. The other three are `pickWork`'s.
 */
export type CalibreReason = 'isbn' | 'isbn-only' | 'author+title' | 'author+part' | 'author' | 'title-only';

export interface CalibreMatch {
  /** `failed`: the catalogue did not answer — never "not found" (SPEC N12). */
  status: 'match' | 'suggestion' | 'none' | 'failed';
  reason?: CalibreReason;
  tile?: Tile;
}

export interface CalibreSources {
  isbn(isbn13: string): Promise<IsbnEdition | null>;
  find(query: string): Promise<WorkSummary[]>;
}

export const liveCalibreSources: CalibreSources = {
  isbn: getEditionByIsbn,
  // `exact`: no second request for a spelling correction — a library's title is not a typo.
  find: async (query) => (await search(query, { exact: true })).works,
};

export const isMatch = (reason: CalibreReason): boolean => reason === 'isbn' || reason === 'author+title';

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

async function byIsbn(query: BookQuery, sources: CalibreSources): Promise<{ reason: CalibreReason; tile: Tile } | null> {
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

/** One book against the catalogue. Never throws: a silent catalogue is `failed`. */
export async function matchCalibreBook(query: BookQuery, sources: CalibreSources = liveCalibreSources): Promise<CalibreMatch> {
  try {
    const hit = await byIsbn(query, sources);
    if (hit) return { status: isMatch(hit.reason) ? 'match' : 'suggestion', ...hit };
  } catch {
    return { status: 'failed' };
  }
  const found = await matchPhotoBook({ title: query.title, author: query.author, kind: 'spine' }, sources.find);
  if (found.failed) return { status: 'failed' };
  if (!found.tile || !found.reason || found.reason === 'first-result') return { status: 'none' };
  const reason: CalibreReason = found.reason === 'author+title' && onlyPart(query.title, found.tile.title) ? 'author+part' : found.reason;
  return { status: isMatch(reason) ? 'match' : 'suggestion', reason, tile: found.tile };
}

/** A few books, `PHOTO_SEARCHES_AT_ONCE` at a time, in the order given. */
export async function matchCalibreBooks(
  queries: readonly BookQuery[],
  sources: CalibreSources = liveCalibreSources,
  atOnce: number = PHOTO_SEARCHES_AT_ONCE,
): Promise<CalibreMatch[]> {
  const out: CalibreMatch[] = new Array(queries.length);
  let next = 0;
  const worker = async () => {
    while (next < queries.length) {
      const i = next++;
      out[i] = await matchCalibreBook(queries[i], sources);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(atOnce, queries.length)) }, worker));
  return out;
}

const MAX_TITLE = 300;
const MAX_AUTHOR = 120;
const MAX_ISBNS = 5;

/** The books of a request, only in the shape the page builds them; anything else is refused whole. */
export function validQueries(raw: unknown): BookQuery[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new WallError('No books.');
  if (raw.length > CALIBRE_BOOKS_PER_REQUEST) throw new WallError(`At most ${CALIBRE_BOOKS_PER_REQUEST} books at a time.`);
  return raw.map((b: Partial<BookQuery> | null) => {
    if (!b || typeof b !== 'object') throw new WallError('A book is missing.');
    const title = typeof b.title === 'string' ? b.title.trim() : '';
    const author = typeof b.author === 'string' ? b.author.trim() : '';
    if (!title || title.length > MAX_TITLE) throw new WallError('A book needs a title.');
    if (!author || author.length > MAX_AUTHOR) throw new WallError('A book needs an author.');
    const isbns = Array.isArray(b.isbns) ? b.isbns.filter((i): i is string => typeof i === 'string' && /^97[89]\d{10}$/.test(i)).slice(0, MAX_ISBNS) : [];
    return { title, author, isbns };
  });
}
