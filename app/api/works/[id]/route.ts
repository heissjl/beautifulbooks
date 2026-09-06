import { NextRequest, NextResponse } from 'next/server';
import { buyLinksFor } from '@/lib/buylinks';
import { cookieValue, detectMarket, MARKET_KEY, type Market } from '@/lib/market';
import type { Cover, EditionView, LanguageGroup, Work } from '@/lib/model';
import { normalizeLanguageOption } from '@/lib/search';
import { getWorkDetail, isWorkId } from '@/lib/work';

/** Response shape of GET /api/works/[id] (SPEC §2.3: covers are the unit). */
export interface WorkDetailResponse {
  work: Work;
  editions: EditionView[];
  covers: Cover[];
  groups: LanguageGroup[];
  /** Market the buy links were generated for (E9). */
  market: Market;
}

/** E9: explicit `?market=` or cookie, else the request's country, else Accept-Language. */
export function marketFromRequest(request: NextRequest): Market {
  return detectMarket({
    explicit: request.nextUrl.searchParams.get(MARKET_KEY) ?? cookieValue(request.headers.get('cookie'), MARKET_KEY),
    country: request.headers.get('x-vercel-ip-country'),
    acceptLanguage: request.headers.get('accept-language'),
  });
}

/**
 * GET /api/works/<OL work id>?lang=<iso|all>&market=<us|uk|de>
 * 400 malformed id, 404 unknown work, 503 Open Library unreachable.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isWorkId(id)) {
    return NextResponse.json({ error: 'Malformed work id' }, { status: 400 });
  }
  const lang = normalizeLanguageOption(request.nextUrl.searchParams.get('lang'));
  const market = marketFromRequest(request);
  try {
    const detail = await getWorkDetail(id, { preferredLanguage: lang === 'all' ? undefined : lang });
    if (!detail) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }
    const body: WorkDetailResponse = {
      work: detail.work,
      editions: detail.editions.map(e => ({ ...e, buyLinks: buyLinksFor(e, market) })),
      covers: detail.covers,
      groups: detail.groups,
      market,
    };
    return NextResponse.json(body, {
      // Varies by market, so shared caches must key on the cookie and country too.
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800',
        Vary: 'Cookie, X-Vercel-IP-Country, Accept-Language',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Book data source unavailable, try again shortly' }, { status: 503 });
  }
}
