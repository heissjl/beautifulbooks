import { NextRequest, NextResponse } from 'next/server';
import { buyLinksFor } from '@/lib/buylinks';
import { coverImages } from '@/lib/seo';
import { cookieValue, detectMarket, MARKET_KEY, type Market } from '@/lib/market';
import type { Cover, EditionView, Work } from '@/lib/model';
import type { ImageSignature } from '@/lib/imagesig';
import type { PageInfo } from '@/lib/pages';
import { OL_EDITIONS_PAGE } from '@/lib/sources/openlibrary';
import { getWorkPage, isWorkId, MAX_EDITIONS_SCANNED } from '@/lib/work';
import { MOSAIC_COVERS } from '@/lib/works';
import { rateLimited } from '@/app/api/rate';

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

/**
 * A search card's mosaic: a few covers of different editions (SPEC §9.3
 * step 14). Shares the cached page 0 with the detail page, so asking for it
 * also warms the page the reader is about to open.
 */
export interface WorkSummaryResponse {
  id: string;
  coverUrls: string[];
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
  const summary = request.nextUrl.searchParams.get('summary') === '1';

  // Only a full page 0 asks Google; a mosaic and every later page do not, so
  // they must not be charged against the shared quota bucket.
  const spendsGoogle = !summary && offset === 0;
  const limited = spendsGoogle ? rateLimited(request, 'works', 'google') : rateLimited(request, 'works');
  if (limited) return limited;

  try {
    const page = await getWorkPage(id, {
      offset: summary ? 0 : offset,
      signatures: summary ? false : signatures,
      // A mosaic never spends a Google request (SPEC §8.7, measured 2026-09-07).
      googleBooks: !summary,
    });
    if (!page) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    if (summary) {
      /*
        One cover per printing, so a mosaic shows four books rather than four
        scans of one. The images are not compared — hashing a whole result
        page of cards would cost more than the mosaic is worth — so the test
        is the metadata: publisher and year, falling back to the edition
        record. Deduplicating by edition alone was not enough: two records of
        the same Spanish printing put the same picture on a card twice
        (2026-09-07). The same rule picks the covers for a shared link.
      */
      const coverUrls = coverImages(page.covers, MOSAIC_COVERS, page.editions);
      const body: WorkSummaryResponse = { id, coverUrls };
      return NextResponse.json(body, {
        headers: { 'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800' },
      });
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
