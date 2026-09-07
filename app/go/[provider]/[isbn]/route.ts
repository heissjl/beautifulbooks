import { NextRequest, NextResponse } from 'next/server';
import { buyLinksFor } from '@/lib/buylinks';
import { recordClick } from '@/lib/clicks';
import { isIsbn13 } from '@/lib/isbn';
import { cleanIsbn } from '@/lib/normalize';
import { marketFromRequest } from '@/app/api/works/[id]/route';

/**
 * GET /go/<provider>/<isbn13>?market=<us|uk|de> — records the click and
 * forwards to the shop (SPEC §10 C9).
 *
 * The target is rebuilt server-side from the retailer table, never taken
 * from the request, so this cannot be turned into an open redirect: the only
 * addresses it can ever produce are the ones in `lib/buylinks.ts`. An unknown
 * provider or a malformed ISBN goes home rather than anywhere surprising.
 *
 * Only buy links come through here. The "find this exact cover" links depend
 * on title, publisher and year, which would all have to travel in the URL,
 * and a reverse image search is not a number anyone acts on.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string; isbn: string }> }) {
  const { provider, isbn } = await context.params;
  const home = new URL('/', request.nextUrl.origin);
  const isbn13 = cleanIsbn(isbn);
  if (!isIsbn13(isbn13)) return NextResponse.redirect(home, 302);

  const market = marketFromRequest(request);
  const link = buyLinksFor({ isbn13 }, market).find(l => l.provider === provider);
  if (!link) return NextResponse.redirect(home, 302);

  recordClick({ provider: link.provider, market, isbn13, kind: link.kind ?? 'search' });
  return NextResponse.redirect(link.url, {
    status: 302,
    // A redirect that is cached is a click that is never counted.
    headers: { 'Cache-Control': 'no-store' },
  });
}
