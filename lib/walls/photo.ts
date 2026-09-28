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

/** A photo rarely shows more; a wall holds 60 and the search runs one book at a time. */
export const MAX_PHOTO_BOOKS = 40;

export interface PhotoMatch {
  /** What the photo showed, as read, with where in the photo (fractions, for the numbered boxes). */
  read: { title: string; author: string; kind?: 'spine' | 'cover'; box?: [number, number, number, number] };
  /** The tile to offer, absent when nothing was found or the search failed. */
  tile?: Tile;
  reason?: WorkReason;
  /** The search did not answer: not the same as "not found" (SPEC N12). */
  failed?: boolean;
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

export async function matchPhotoBooks(books: readonly RecognizedBook[], find: Search = defaultSearch): Promise<PhotoMatch[]> {
  const out: PhotoMatch[] = [];
  for (const book of books.slice(0, MAX_PHOTO_BOOKS)) {
    const read = { title: book.title, author: book.author, kind: book.kind, ...(book.box ? { box: book.box } : {}) };
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
      const work = picked ? works[picked.index] : undefined;
      const tile = work ? tileFromWork(work) : undefined;
      out.push({ read, ...(tile ? { tile, reason: picked?.reason } : {}) });
    } catch {
      out.push({ read, failed: true });
    }
  }
  return out;
}
