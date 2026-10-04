/**
 * From the books a photo shows to tiles for a new wall (ROADMAP 5.13a, built
 * on the shelf lab, 5.11). Server only: it searches Open Library through
 * `lib/search.ts`, one book after another, and never Google.
 *
 * The tile gets the cover Julian picked for the work where there is one
 * (`data/curated.json`, 6.18), otherwise the first of the search card — which
 * for *Gatsby* was a school edition and for *Pedro Páramo* a title-page scan
 * (measured 2026-09-28). The
 * lab also compares a photographed jacket with the work's covers to find the
 * edition in the photo; that threshold is not measured yet (lab/shelf README),
 * so the site does not claim it: the reader changes a cover on the book's own
 * wall, where every cover is.
 */
import { coverIdFromUrl, pickWork, type WorkReason } from '@/lib/bookmatch';
import type { RecognizedBook } from '@/lib/recognize';
import { search } from '@/lib/search';
import { CURATED_LIST, CURATED_WORKS } from '@/lib/curated';
import type { WorkSummary } from '@/lib/model';
import { validTile, type Tile } from './model';

/** Julian's gallery wall, read shelf by shelf, comes to 97 (2026-10-03); a wall holds 500, and the searches run three at a time. */
export const MAX_PHOTO_BOOKS = 100;

/** Open Library searches in flight at once for one photo: three cut a 40-book photo from 35 s to about 12 without leaning on the catalogue. */
export const PHOTO_SEARCHES_AT_ONCE = 3;

export interface PhotoMatch {
  /** What the photo showed, as read, with the point the model put on the book (fractions of width and height, for the numbered pin). */
  read: { title: string; author: string; kind?: 'spine' | 'cover'; at?: [number, number] };
  /** The tile to offer, absent when nothing was found or the search failed. */
  tile?: Tile;
  reason?: WorkReason;
  /**
   * Only the title agreed (5.11a): on the gallery wall of 2026-09-30 every
   * such hit was a guess and at least five were wrong ("The Virgin" →
   * *The Virgin Suicides*), so the tile is offered as "maybe" and not ticked.
   */
  unsure?: true;
  /** The search did not answer: not the same as "not found" (SPEC N12). */
  failed?: boolean;
}

/** What the photo showed, as it goes to the browser. */
export type PhotoRead = PhotoMatch['read'];

export function photoRead(book: RecognizedBook): PhotoRead {
  return { title: book.title, author: book.author, kind: book.kind, ...(book.x !== undefined && book.y !== undefined ? { at: [book.x, book.y] as [number, number] } : {}) };
}

type Search = (query: string) => Promise<WorkSummary[]>;

const defaultSearch: Search = async (query) => (await search(query)).works;

/** One tile from a search hit: the work and its chosen or usual cover, no printings (the photo did not say which). */
export function tileFromWork(work: WorkSummary): Tile | undefined {
  const picked = CURATED_LIST.find((c) => c.id === work.id) ?? CURATED_WORKS.find((c) => c.id === work.id);
  const cover = picked?.coverId ?? coverIdFromUrl(work.coverUrls[0]);
  if (!cover) return undefined;
  try {
    return validTile({ workId: work.id, coverId: String(cover), title: work.title, author: work.authors[0], printings: [] });
  } catch {
    return undefined;
  }
}

/** One book against the catalogue: the work, its tile, and how sure the match is. */
export async function matchPhotoBook(book: RecognizedBook, find: Search = defaultSearch): Promise<PhotoMatch> {
  const read = photoRead(book);
  try {
    let works = await find(`${book.title} ${book.author}`.trim());
    let picked = pickWork(works, book);
    // A misread author can empty the first search; the title alone is the second try.
    if ((!picked || picked.reason === 'first-result') && book.author) {
      const byTitle = await find(book.title);
      const second = pickWork(byTitle, book);
      if (second && (!picked || second.reason !== 'first-result')) {
        works = byTitle;
        picked = second;
      }
    }
    // Neither author nor title agrees: the search's first hit is a guess, not this book.
    // Measured on the first real photo (2026-09-28): all five such hits were wrong
    // ("Titanic" for Nansen's "In Nacht und Eis"), so they are "not found" instead.
    const work = picked && picked.reason !== 'first-result' ? works[picked.index] : undefined;
    const tile = work ? tileFromWork(work) : undefined;
    return { read, ...(tile ? { tile, reason: picked?.reason, ...(picked?.reason === 'title-only' ? { unsure: true as const } : {}) } : {}) };
  } catch {
    return { read, failed: true };
  }
}

/**
 * Every book of a photo against the catalogue, `PHOTO_SEARCHES_AT_ONCE` at a
 * time, each result handed on the moment it is there (5.11a: the marker on
 * the photo turns from grey to found while the rest are still being looked
 * up). Resolves to all results in the photo's order.
 */
export async function matchPhotoBooksEach(
  books: readonly RecognizedBook[],
  onMatch: (index: number, match: PhotoMatch) => void,
  find: Search = defaultSearch,
  atOnce: number = PHOTO_SEARCHES_AT_ONCE,
): Promise<PhotoMatch[]> {
  const list = books.slice(0, MAX_PHOTO_BOOKS);
  const out: PhotoMatch[] = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      const match = await matchPhotoBook(list[i], find);
      out[i] = match;
      onMatch(i, match);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(atOnce, list.length)) }, worker));
  return out;
}

export async function matchPhotoBooks(books: readonly RecognizedBook[], find: Search = defaultSearch): Promise<PhotoMatch[]> {
  return matchPhotoBooksEach(books, () => {}, find);
}
