import { NextRequest, NextResponse } from 'next/server';
import { getIsbnCovers, type IsbnCovers } from '@/lib/isbn';
import { rateLimited } from '@/app/api/rate';

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
  const limited = rateLimited(request, 'isbn', 'google');
  if (limited) return limited;

  const { isbn } = await context.params;
  const signatures = request.nextUrl.searchParams.get('signatures') === '1';

  const covers = await getIsbnCovers(isbn, { signatures });
  if (!covers) {
    return NextResponse.json({ error: 'Malformed ISBN' }, { status: 400 });
  }
  return NextResponse.json(covers, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
