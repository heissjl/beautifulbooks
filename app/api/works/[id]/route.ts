import { NextRequest, NextResponse } from 'next/server';
import { buyLinksFor } from '@/lib/buylinks';
import { cookieValue, detectMarket, MARKET_KEY, type Market } from '@/lib/market';
import type { Cover, EditionView, Work } from '@/lib/model';
import type { ImageSignature } from '@/lib/imagesig';
import type { PageInfo } from '@/lib/pages';
import { OL_EDITIONS_PAGE } from '@/lib/sources/openlibrary';
import { getWorkPage, isWorkId, MAX_EDITIONS_SCANNED } from '@/lib/work';

/**
 * Response of GET /api/works/[id] (SPEC §2.3: covers are the unit).
 *
 * One page of a work's editions. `work` and `market` come with every page so
 * a reload of a later page is self-contained; covers are *not* folded here,
 * because folding is only correct once the client has all the pages it is
 * going to get (SPEC §9.3 step 11). The signatures needed for that folding
 * ride along when `signatures=1` was asked for.
 */
export interface WorkPageResponse {
  work: Work;
  editions: EditionView[];
  covers: Cover[];
  signatures?: Record<string, ImageSignature>;
  page: PageInfo;
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

/** Offsets are page-aligned and bounded; anything else is treated as page 0. */
export function offsetFromRequest(raw: string | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n / OL_EDITIONS_PAGE) * OL_EDITIONS_PAGE, MAX_EDITIONS_SCANNED - OL_EDITIONS_PAGE);
}

/**
 * GET /api/works/<OL work id>?offset=<0|100|…>&signatures=<0|1>&market=<us|uk|de>
 *
 * Open Library returns a work's editions 100 records at a time, newest record
 * first, so one page is never the whole story: the client keeps asking for
 * `page.nextOffset` until it is gone. `signatures=1` hashes this page's
 * covers so the client can fold duplicates across pages; without it the
 * response comes back as fast as Open Library answers, which is what the
 * loading scene needs.
 *
 * 400 malformed id, 404 unknown work, 503 Open Library unreachable.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isWorkId(id)) {
    return NextResponse.json({ error: 'Malformed work id' }, { status: 400 });
  }
  const market = marketFromRequest(request);
  const offset = offsetFromRequest(request.nextUrl.searchParams.get('offset'));
  const signatures = request.nextUrl.searchParams.get('signatures') === '1';

  try {
    const page = await getWorkPage(id, { offset, signatures });
    if (!page) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }
    const body: WorkPageResponse = {
      work: page.work,
      editions: page.editions.map(e => ({ ...e, buyLinks: buyLinksFor(e, market) })),
      covers: page.covers,
      signatures: page.signatures,
      page: page.page,
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
