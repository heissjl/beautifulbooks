import { NextRequest, NextResponse } from 'next/server';
import { checkAvailability, type ShopCheck } from '@/lib/availability';
import { isIsbn13 } from '@/lib/isbn';
import { cleanIsbn } from '@/lib/normalize';
import { marketFromRequest } from '@/app/api/works/[id]/route';

export interface AvailabilityResponse {
  isbn13: string;
  shops: ShopCheck[];
}

/**
 * GET /api/availability?isbn=<isbn13>&market=<us|uk|de>
 *
 * Asks each retailer of the market whether its link for this ISBN leads to
 * anything, by comparing its answer with its answer for an impossible ISBN
 * (SPEC §9.3 step 16). Only runs when the reader asks for it: it costs one
 * request per shop, to shops that mostly dislike being asked.
 *
 * 400 for a malformed ISBN. A shop that refuses or fails is part of the
 * answer, not an error.
 */
export async function GET(request: NextRequest) {
  const isbn13 = cleanIsbn(request.nextUrl.searchParams.get('isbn') ?? '');
  if (!isIsbn13(isbn13)) {
    return NextResponse.json({ error: 'Malformed ISBN' }, { status: 400 });
  }
  const market = marketFromRequest(request);
  const shops = await checkAvailability(isbn13, market);
  const body: AvailabilityResponse = { isbn13, shops };
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400',
      Vary: 'Cookie, X-Vercel-IP-Country, Accept-Language',
    },
  });
}
