import { NextRequest, NextResponse } from 'next/server';
import { getIsbnCovers, type IsbnCovers } from '@/lib/isbn';
import { rateLimited } from '@/app/api/rate';
import { countGoogleStopsAfter } from '@/app/api/count';
import { measure } from '@/app/api/measure';
import { CACHE_DEGRADED, isbnCacheControl } from '@/lib/cachepolicy';
import { askedFromOwnPage } from '@/lib/ownpage';

export type IsbnCoversResponse = IsbnCovers;

/**
 * GET /api/isbn/<isbn13>?signatures=<0|1>
 *
 * The cover the trade currently shows for one ISBN (SPEC §9.3 step 13a).
 * Asked when the user selects a cover, not while a work loads, so a detail
 * page costs two Google requests instead of eleven (§8.7).
 *
 * 400 malformed ISBN. An ISBN Google has no image for is a 200 with an
 * empty list, not an error: that is the normal answer for older printings.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ isbn: string }> }) {
  measure('isbn', request);
  const limited = rateLimited(request, 'isbn', 'google');
  if (limited) return limited;
  countGoogleStopsAfter();

  const { isbn } = await context.params;
  const signatures = request.nextUrl.searchParams.get('signatures') === '1';

  // Google only for a request from one of the site's own pages (2.18f, lib/ownpage.ts).
  const ownPage = askedFromOwnPage(request.headers);
  const covers = await getIsbnCovers(isbn, { signatures, askGoogle: ownPage });
  if (!covers) {
    return NextResponse.json({ error: 'Malformed ISBN' }, { status: 400 });
  }
  // Never keep "nobody answered", an hour for the catalogue's stand-in, a day for Google (ROADMAP 2.18e).
  return NextResponse.json(covers, {
    // A stand-in given because the request was not from our page is kept a minute, so a reader's next ask gets Google's answer.
    headers: { 'Cache-Control': ownPage ? isbnCacheControl(covers) : CACHE_DEGRADED },
  });
}
