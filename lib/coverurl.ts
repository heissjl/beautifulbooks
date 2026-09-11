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
    // 300 and 800 are the widths `gbCoverUrl` asks Google for, so the two
    // paths produce the same file and the image route can rebuild either.
    const width = size === 'S' ? 128 : size === 'M' ? 300 : 800;
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

/**
 * The path our own image route serves a cover from (ROADMAP 1.3, SPEC N8).
 *
 * Why there is a route at all, measured on 2026-09-09 from Germany: a cold
 * detail page of *The Great Gatsby* wants **151 different images** (146 from
 * `covers.openlibrary.org`, 5 from Google), each 12–29 KB — and Open Library
 * took **5.9 to 16.0 seconds** for a single one of them. It redirects to
 * archive.org, which is slow under load and sometimes silent, and it
 * documents rate limits for covers. Going through our own route puts Vercel's
 * CDN in front of that: the first reader pays for a cover once, everyone
 * after that gets it from the edge. It also stops the reader's IP from
 * reaching archive.org and Google on every tile.
 *
 * **The path carries an id, never a URL.** The route rebuilds the upstream
 * address with `coverUrlFor`, exactly as `/go/[provider]/[isbn]` rebuilds a
 * shop link from the retailer table. An image proxy that takes a URL from the
 * request is an open proxy, and this one cannot be pointed anywhere.
 */
export function coverProxyPath(coverId: string, size: 'S' | 'M' | 'L'): string {
  return `/img/${size}/${coverPathSegment(coverId)}`;
}

/**
 * Reads a cover id and size back out of an upstream image URL.
 *
 * Both forms are mechanical, so this is the inverse of `coverUrlFor` rather
 * than a guess. Anything else — a URL we did not build — returns null and is
 * then left alone, which is the safe direction: an unproxied image still
 * loads.
 */
export function coverRefFromUrl(url: string): { coverId: string; size: 'S' | 'M' | 'L' } | null {
  const ol = url.match(/^https:\/\/covers\.openlibrary\.org\/b\/id\/(\d{1,12})-(S|M|L)\.jpg$/);
  if (ol) return { coverId: `ol:${ol[1]}`, size: ol[2] as 'S' | 'M' | 'L' };
  if (url.startsWith('https://books.google.com/books/content?')) {
    const id = url.match(/[?&]id=([A-Za-z0-9_-]{1,64})(?:&|$)/);
    const width = Number(url.match(/[?&]fife=w(\d{2,4})(?:&|$)/)?.[1]);
    if (!id || !Number.isFinite(width)) return null;
    /*
      Exactly the three widths this codebase asks Google for (`coverUrlFor`,
      `gbCoverUrl`) — no ranges. A loose `>= 800` would rewrite a `w999` URL
      to the route's `L`, which serves w800: a different picture under the
      same address, and nobody would notice until it mattered.
    */
    const size = width === 128 ? 'S' : width === 300 ? 'M' : width === 800 ? 'L' : null;
    return size ? { coverId: `gb:${id[1]}`, size } : null;
  }
  return null;
}

/**
 * The address a browser should actually ask for. Upstream URLs we recognise
 * become our own route; everything else is returned untouched, so a new
 * source or a hand-built URL keeps working without a change here.
 */
export function proxiedCoverSrc(url: string): string {
  const ref = coverRefFromUrl(url);
  return ref ? coverProxyPath(ref.coverId, ref.size) : url;
}

/**
 * The address for the one retry of a cover that failed (ROADMAP 6.31).
 *
 * Our own route ignores the query, so a marker makes it an address the
 * browser has never seen fail, and the CDN keys it apart from the first. A
 * foreign URL is left as it is: a parameter could break a signed or
 * size-encoded address, and the retry there is a fresh element instead.
 */
export function retryCoverSrc(href: string): string {
  if (!href.startsWith('/img/')) return href;
  return `${href}${href.includes('?') ? '&' : '?'}retry=1`;
}
