import { NextRequest, NextResponse } from 'next/server';
import { buyLinksFor, parseWordsQuery, wordsLinkFor } from '@/lib/buylinks';
import { recordClick } from '@/lib/clicks';
import { isIsbn13 } from '@/lib/isbn';
import { cleanIsbn } from '@/lib/normalize';
import { localLinkFor } from '@/lib/localshops';
import type { Market } from '@/lib/market';
import { marketFromRequest } from '@/app/api/works/[id]/route';
import { later } from '@/app/api/count';
import { countClick } from '@/lib/insights/store';
import { ADMIN_COOKIE, adminTokenValid } from '@/lib/suggest/auth';
import { measure } from '@/app/api/measure';

/**
 * GET /go/<provider>/<isbn13>?market=<us|uk|de> — records the click and
 * forwards to the shop (SPEC §10 C9).
 *
 * The target is rebuilt server-side from the retailer table, never taken
 * from the request, so this cannot be turned into an open redirect: the only
 * addresses it can ever produce are the ones in `lib/buylinks.ts`. An unknown
 * provider or a malformed ISBN goes home rather than anywhere surprising.
 *
 * Buy links built from an ISBN come through here, and since ROADMAP 3.1 the
 * shops searched by words too (`/go/<provider>/title`, below). Reverse image
 * searches and catalogues stay plain links: they are not shops.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ provider: string; isbn: string }> }) {
  measure('go', request);
  const { provider, isbn } = await context.params;
  const home = new URL('/', request.nextUrl.origin);
  if (provider === 'local') return localShop(request, isbn, home);
  if (isbn === 'title') return wordsSearch(request, provider, home);
  const isbn13 = cleanIsbn(isbn);
  if (!isIsbn13(isbn13)) return NextResponse.redirect(home, 302);

  const market = marketFromRequest(request);
  const link = buyLinksFor({ isbn13 }, market).find(l => l.provider === provider);
  if (!link) return NextResponse.redirect(home, 302);

  recordClick({ provider: link.provider, market, isbn13, kind: link.kind ?? 'search' });
  countUnlessJulian(request, link.provider, market, link.kind ?? 'search');
  return NextResponse.redirect(link.url, {
    status: 302,
    // A redirect that is cached is a click that is never counted.
    headers: { 'Cache-Control': 'no-store' },
  });
}

/**
 * GET /go/<provider>/title?t=&a=&p=&y=&market= — a shop searched by words
 * (ROADMAP 3.1, plan §4): a printing without an ISBN, or "read it in another
 * edition". Only the words come from the request; the address is rebuilt
 * from `lib/buylinks.ts` exactly as the page built it, so a URL typed into
 * `t` becomes a search term at that shop and nothing else. The words are not
 * logged — a title is not needed to count a click.
 */
function wordsSearch(request: NextRequest, provider: string, home: URL): NextResponse {
  const query = parseWordsQuery(request.nextUrl.searchParams);
  const market = marketFromRequest(request);
  const link = query ? wordsLinkFor(provider, query, market) : undefined;
  if (!link) return NextResponse.redirect(home, 302);
  recordClick({ provider: link.provider, market, kind: 'search' });
  countUnlessJulian(request, link.provider, market, 'search');
  return NextResponse.redirect(link.url, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * The daily total for the analytics (ROADMAP 3.1a): shop, market and link
 * kind, after the redirect has left, and not for Julian's own clicks — his
 * admin cookie travels with a top-level navigation like any other.
 */
function countUnlessJulian(request: NextRequest, provider: string, market: Market, kind: 'product' | 'search'): void {
  if (adminTokenValid(request.cookies.get(ADMIN_COOKIE)?.value)) return;
  later(() => countClick({ provider, market, kind }));
}

/**
 * GET /go/local/<isbn13 or title>?c=&id=&t=&a=&market= — "Buy from a local
 * bookshop" (ROADMAP 5.12), counted since 3.1 as `local-<service>`. The link
 * is rebuilt with `localShopLinks` from the table; the request only says
 * which country, which service and which edition.
 */
function localShop(request: NextRequest, target: string, home: URL): NextResponse {
  const link = localLinkFor(target, request.nextUrl.searchParams);
  if (!link) return NextResponse.redirect(home, 302);
  const market = marketFromRequest(request);
  const provider = `local-${link.id.replace(/-finder$/, '')}`;
  recordClick({ provider, market, kind: 'search' });
  countUnlessJulian(request, provider, market, 'search');
  return NextResponse.redirect(link.url, { status: 302, headers: { 'Cache-Control': 'no-store' } });
}

