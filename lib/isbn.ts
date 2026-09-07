/**
 * What the trade currently shows for one ISBN (SPEC §9.3 step 13a).
 *
 * Publishers reprint a backlist title with a new cover under the unchanged
 * ISBN, so the scan Open Library holds and the image a shop displays are
 * often two different pictures. Google Books carries the publisher's current
 * image, which makes it the one source that can answer "what will actually
 * arrive if I buy this ISBN".
 *
 * This used to run for the ten newest ISBNs while a work's first page
 * loaded: six to ten requests per page view for editions nobody had clicked,
 * out of dozens of ISBNs on that page alone. It is now asked one ISBN at a
 * time, when a cover is selected, which drops a detail page from 7-11 Google
 * requests to 2 (§8.7). Server-side only.
 */
import type { Cover } from './model';
import type { ImageSignature } from './imagesig';
import { hashCovers } from './coverhash';
import { debug } from './debug';
import { cleanIsbn } from './normalize';
import { lookupIsbnOrThrow } from './sources/googlebooks';

/** Covers the trade shows for an ISBN, without the editions they belong to. */
export type IsbnCover = Omit<Cover, 'editionIds'>;

export interface IsbnCovers {
  isbn13: string;
  /** Empty when Google has no image, which is common for older printings. */
  covers: IsbnCover[];
  signatures?: Record<string, ImageSignature>;
  /**
   * True when the source could not be reached, so an empty list means
   * "not known" rather than "no cover". Callers must not remember this
   * answer: asking again later may well succeed.
   */
  unavailable?: boolean;
}

export interface IsbnCoversOptions {
  /** Hash the images so the client can fold them against the wall. */
  signatures?: boolean;
  hashDeadlineMs?: number;
}

const ISBN13 = /^\d{13}$/;

export function isIsbn13(value: string | undefined): value is string {
  return !!value && ISBN13.test(value);
}

/**
 * Returns null for a malformed ISBN. Never throws: a missing image is a
 * normal answer, and Google failing must not take the detail page with it
 * (F3.3).
 */
export async function getIsbnCovers(raw: string, options: IsbnCoversOptions = {}): Promise<IsbnCovers | null> {
  const isbn13 = cleanIsbn(raw);
  if (!isIsbn13(isbn13)) return null;

  // Google answers a transient 503 often enough that one retry is worth it;
  // without it a reader is told the cover is unknown when it is merely late.
  let candidates: Awaited<ReturnType<typeof lookupIsbnOrThrow>>;
  try {
    candidates = await lookupIsbnOrThrow(isbn13);
  } catch {
    try {
      candidates = await lookupIsbnOrThrow(isbn13);
    } catch (err) {
      debug('isbn', `${isbn13} unavailable: ${(err as Error).message}`);
      return { isbn13, covers: [], unavailable: true };
    }
  }
  if (candidates === null) return { isbn13, covers: [], unavailable: true };

  const covers: IsbnCover[] = [];
  for (const candidate of candidates) {
    for (const cover of candidate.covers) {
      if (covers.some(c => c.id === cover.id)) continue;
      covers.push({ ...cover, source: 'googlebooks' });
    }
  }

  const result: IsbnCovers = { isbn13, covers };
  if (options.signatures && covers.length > 0) {
    const signatures = await hashCovers(
      covers.map(c => ({ ...c, editionIds: [] })),
      { deadlineMs: options.hashDeadlineMs ?? 3000 },
    );
    result.signatures = Object.fromEntries(signatures);
  }
  return result;
}
