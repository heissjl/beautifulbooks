import { NextRequest, NextResponse } from 'next/server';
import { coverIdFromSegment, coverUrlFor } from '@/lib/coverurl';
import { rateLimited } from '@/app/api/rate';
import { recordCoverFailure, type CoverFailure } from '@/lib/coverlog';
import { measure } from '@/app/api/measure';
import { isHiddenCover } from '@/lib/hiddencovers';

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
 *
 * **One size smaller when a size does not come** (Julian, 2026-10-06:
 * „archive fällt gerade ständig aus für die großen cover, wir brauchen einen
 * fallback auf die kleinen versionen"). Open Library keeps each size of a
 * scan in its own zip at archive.org, and on 2026-10-06 the zips failed one
 * by one: `ol:420313` answered 503 for L and 200 for M. So an Open Library L
 * that fails is asked again as M, an M as S; the smaller image is served
 * under the asked address — softer, never empty — and kept only an hour, so
 * the proper size takes its place once archive.org answers again. A Google
 * cover is not asked again: its sizes are widths of one image, and what fails
 * at one fails at the others.
 */
const SIZES = new Set(['S', 'M', 'L']);

/** Open Library needs a long rope; it is regularly slower than ten seconds. */
const UPSTREAM_TIMEOUT_MS = 13_000;
/** The second, smaller ask: 13 + 9 s stays inside `maxDuration`. */
const SMALLER_TIMEOUT_MS = 9_000;
const SMALLER: Record<string, 'M' | 'S' | undefined> = { L: 'M', M: 'S', S: undefined };
/** How long a smaller stand-in is kept at the edge: long enough to spare archive.org, short enough to be replaced. */
const STAND_IN_SECONDS = 60 * 60;

/** Same 30 days the cover bytes are held for hashing (`lib/coverhash.ts`). */
const CDN_SECONDS = 60 * 60 * 24 * 30;

export const maxDuration = 25;

function refuse(status: number, message: string): NextResponse {
  return new NextResponse(message, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest, context: { params: Promise<{ size: string; cover: string }> }) {
  measure('img', request);
  const limited = rateLimited(request, 'img');
  if (limited) return limited;

  const { size, cover } = await context.params;
  const coverId = coverIdFromSegment(decodeURIComponent(cover));
  if (!coverId || !SIZES.has(size)) return refuse(400, 'Malformed cover reference');
  // Taken off the site on request (2.18k): no upstream call, nothing cached,
  // so taking the entry out brings the image back with the next deploy.
  if (isHiddenCover(coverId)) return refuse(404, 'Cover withdrawn');

  const upstream = coverUrlFor(coverId, size as 'S' | 'M' | 'L');
  if (!upstream) return refuse(400, 'Malformed cover reference');

  const source: CoverFailure['source'] = coverId.startsWith('gb:') ? 'googlebooks' : 'openlibrary';
  const started = Date.now();
  const failed = (status: number | null, reason: CoverFailure['reason']): NextResponse => {
    recordCoverFailure({ coverId, size: size as CoverFailure['size'], source, status, reason, ms: Date.now() - started });
    const res = refuse(502, 'Cover image not available');
    /*
      The status only when the status *is* the answer. A missing cover comes
      back from Open Library as a **200 whose body is not an image** (measured
      in production 2026-09-10), and a header reading `200` on a failed
      request says the opposite of what happened.
    */
    res.headers.set('X-Cover-Upstream', reason === 'status' && status !== null ? String(status) : reason);
    return res;
  };

  const first = await ask(upstream, UPSTREAM_TIMEOUT_MS);
  if (first.ok) return served(first.res, `public, max-age=3600, s-maxage=${CDN_SECONDS}, stale-while-revalidate=86400`, source);

  const smaller = source === 'openlibrary' ? SMALLER[size] : undefined;
  const fallback = smaller ? coverUrlFor(coverId, smaller) : null;
  if (fallback) {
    const second = await ask(fallback, SMALLER_TIMEOUT_MS);
    if (second.ok) {
      // The failure of the asked size is still logged: it says archive.org is failing, which is worth knowing.
      recordCoverFailure({ coverId, size: size as CoverFailure['size'], source, status: first.status, reason: first.reason, ms: Date.now() - started });
      const res = served(second.res, `public, max-age=600, s-maxage=${STAND_IN_SECONDS}`, source);
      res.headers.set('X-Cover-Size', smaller ?? '');
      return res;
    }
  }
  return failed(first.status, first.reason);
}

type Asked = { ok: true; res: Response } | { ok: false; status: number | null; reason: CoverFailure['reason'] };

async function ask(url: string, timeoutMs: number): Promise<Asked> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'image/*' },
      signal: AbortSignal.timeout(timeoutMs),
      // The bytes belong in the CDN in front of this route, not in Next's
      // data cache, which is neither meant for images nor shared with it.
      cache: 'no-store',
      redirect: 'follow',
    });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !res.body) return { ok: false, status: res.status, reason: 'status' };
    if (!type.startsWith('image/')) return { ok: false, status: res.status, reason: 'not-image' };
    return { ok: true, res };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    return { ok: false, status: null, reason: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'error' };
  }
}

function served(res: Response, cache: string, source: CoverFailure['source']): NextResponse {
  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/jpeg',
      'Cache-Control': cache,
      // Says nothing about the reader; useful when a wall is slow and the
      // question is which catalogue is answering.
      'X-Cover-Source': source,
    },
  });
}
