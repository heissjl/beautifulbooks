import { NextRequest, NextResponse } from 'next/server';
import { coverIdFromSegment, coverUrlFor } from '@/lib/coverurl';
import { rateLimited } from '@/app/api/rate';
import { recordCoverFailure, type CoverFailure } from '@/lib/coverlog';

/**
 * GET /img/<S|M|L>/<ol-12345 | gb-abc123> — one cover image, through us.
 *
 * **Why** (ROADMAP 1.3, SPEC N8). Measured from Germany on 2026-09-09: a cold
 * detail page of *The Great Gatsby* wants 151 different images, 146 of them
 * from `covers.openlibrary.org`, each 12–29 KB — and a single one took
 * **5.9 to 16.0 seconds**. Open Library redirects covers to archive.org,
 * which is slow under load and sometimes silent, and it documents rate limits
 * for covers. With this route Vercel's CDN sits in front of all of it: the
 * first reader waits for a cover once, everyone after that gets it from the
 * edge. The reader's IP stops reaching archive.org and Google as well, once
 * per tile, which is a hundred and fifty times a page.
 *
 * **The path carries a cover id, never a URL.** The upstream address is
 * rebuilt with `coverUrlFor`, exactly the way `/go/[provider]/[isbn]` rebuilds
 * a shop link from the retailer table. An image proxy that forwards a URL out
 * of the request is an open proxy; this one cannot be aimed anywhere else.
 *
 * **Not `next/image` optimisation.** The other option in 1.3 was dropping
 * `unoptimized` and letting Vercel transform the images. The measurement
 * above rules it out: 151 source images for one detail page would spend a
 * month of the Hobby plan's transformation allowance in a handful of page
 * views, and the covers are already requested at the size they are shown.
 * This route moves bytes and caches them; it transforms nothing.
 *
 * Failures are deliberately **not** cached: a silent archive.org is an
 * episode, not a fact about the cover (the same reasoning as F1.7), and
 * `CoverImage` already degrades to a quiet placeholder.
 *
 * **A failure says why, since 2026-09-10** (ROADMAP 6.25). Julian saw tiles
 * stay empty and asked whether Open Library was throttling us — a question
 * this route made unanswerable, because it turned every upstream answer into
 * a bare 502. Now each failure writes one `bb.img` line (`lib/coverlog.ts`)
 * with the upstream status or the reason there was none, and the 502 carries
 * it in `X-Cover-Upstream` so a browser's network panel shows it too. A 429
 * or 403 from upstream is the throttling signature; a 404 is a missing scan;
 * a timeout is archive.org being archive.org.
 */
const SIZES = new Set(['S', 'M', 'L']);

/** Open Library needs a long rope; it is regularly slower than ten seconds. */
const UPSTREAM_TIMEOUT_MS = 15_000;

/** Same 30 days the cover bytes are held for hashing (`lib/coverhash.ts`). */
const CDN_SECONDS = 60 * 60 * 24 * 30;

export const maxDuration = 25;

function refuse(status: number, message: string): NextResponse {
  return new NextResponse(message, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest, context: { params: Promise<{ size: string; cover: string }> }) {
  const limited = rateLimited(request, 'img');
  if (limited) return limited;

  const { size, cover } = await context.params;
  const coverId = coverIdFromSegment(decodeURIComponent(cover));
  if (!coverId || !SIZES.has(size)) return refuse(400, 'Malformed cover reference');

  const upstream = coverUrlFor(coverId, size as 'S' | 'M' | 'L');
  if (!upstream) return refuse(400, 'Malformed cover reference');

  const source: CoverFailure['source'] = coverId.startsWith('gb:') ? 'googlebooks' : 'openlibrary';
  const started = Date.now();
  const failed = (status: number | null, reason: CoverFailure['reason']): NextResponse => {
    recordCoverFailure({ coverId, size: size as CoverFailure['size'], source, status, reason, ms: Date.now() - started });
    const res = refuse(502, 'Cover image not available');
    res.headers.set('X-Cover-Upstream', status === null ? reason : String(status));
    return res;
  };

  try {
    const res = await fetch(upstream, {
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      // The bytes belong in the CDN in front of this route, not in Next's
      // data cache, which is neither meant for images nor shared with it.
      cache: 'no-store',
      redirect: 'follow',
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !res.body) return failed(res.status, 'status');
    if (!type.startsWith('image/')) return failed(res.status, 'not-image');
    return new NextResponse(res.body, {
      headers: {
        'Content-Type': type,
        'Cache-Control': `public, max-age=3600, s-maxage=${CDN_SECONDS}, stale-while-revalidate=86400`,
        // Says nothing about the reader; useful when a wall is slow and the
        // question is which catalogue is answering.
        'X-Cover-Source': source,
      },
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    return failed(null, name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'error');
  }
}
