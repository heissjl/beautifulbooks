/**
 * The image behind a cover id, and the cover id inside a URL path.
 *
 * Split out of `lib/coverindex.ts` so that a route which needs one cover's
 * URL does not pull the whole built index into memory with it. Pure, no I/O,
 * safe on the client.
 */
import { olCoverUrl } from './sources/openlibrary-parse';

/** Rebuilt rather than stored: both forms are mechanical (SPEC §2.5). */
export function coverUrlFor(coverId: string, size: 'S' | 'M' | 'L' = 'M'): string | null {
  if (coverId.startsWith('ol:')) {
    const id = Number(coverId.slice(3));
    return Number.isFinite(id) && id > 0 ? olCoverUrl(id, size) : null;
  }
  if (coverId.startsWith('gb:')) {
    const width = size === 'S' ? 128 : size === 'M' ? 400 : 800;
    // zoom=1 is the cover; zoom=2 and up is a page out of the scan (F3.1).
    return `https://books.google.com/books/content?id=${encodeURIComponent(coverId.slice(3))}` +
      `&printsec=frontcover&img=1&zoom=1&source=gbs_api&fife=w${width}`;
  }
  return null;
}

/**
 * A cover id as one path segment, for the share address
 * `/book/<work>/cover/<segment>` (ROADMAP 6.20).
 *
 * Ids look like `ol:15251791`, and a colon in a path is legal but ugly and
 * gets percent-encoded by half the tools that touch it — a share link is
 * pasted by hand often enough that it should survive being read out. So the
 * colon becomes a dash, which no id contains.
 */
export function coverPathSegment(coverId: string): string {
  return coverId.replace(':', '-');
}

/** The inverse, tolerant of what a stranger may put in the address bar. */
export function coverIdFromSegment(segment: string | undefined): string | null {
  if (!segment) return null;
  const at = segment.indexOf('-');
  if (at < 1) return null;
  const source = segment.slice(0, at);
  const rest = segment.slice(at + 1);
  if (source !== 'ol' && source !== 'gb') return null;
  if (!rest || !/^[\w.-]{1,64}$/.test(rest)) return null;
  return `${source}:${rest}`;
}
