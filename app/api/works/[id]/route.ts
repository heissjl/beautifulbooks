import { NextRequest, NextResponse } from 'next/server';
import { buyLinksFor } from '@/lib/buylinks';
import { cookieValue, detectMarket, MARKET_KEY, type Market } from '@/lib/market';
import type { Cover, EditionView, Work } from '@/lib/model';
import type { ImageSignature } from '@/lib/imagesig';
import type { PageInfo } from '@/lib/pages';
import { OL_EDITIONS_PAGE } from '@/lib/sources/openlibrary';
import { getWorkPage, isWorkId, MAX_EDITIONS_SCANNED } from '@/lib/work';
import { MOSAIC_COVERS } from '@/lib/works';

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

  try {
    const page = await getWorkPage(id, { offset: summary ? 0 : offset, signatures: summary ? false : signatures });
    if (!page) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    if (summary) {
      // One cover per edition, so a mosaic shows four books rather than four
      // scans of one. Not folded: hashing a whole result page of cards would
      // cost more than the mosaic is worth.
      const seen = new Set<string>();
      const coverUrls: string[] = [];
      for (const cover of page.covers) {
        const edition = cover.editionIds[0];
        if (edition) {
          if (seen.has(edition)) continue;
          seen.add(edition);
        }
        coverUrls.push(cover.url);
        if (coverUrls.length >= MOSAIC_COVERS) break;
      }
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
