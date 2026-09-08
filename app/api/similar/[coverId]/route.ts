import { NextRequest, NextResponse } from 'next/server';
import { indexBuiltAt, similarTo } from '@/lib/coverindex';
import { rateLimited } from '@/app/api/rate';

/**
 * GET /api/similar/<coverId>?limit=6
 *
 * Covers elsewhere in the index that look like this one (ROADMAP 6.10).
 * Answers from `data/cover-index.json`, so it contacts nobody and spends no
 * quota; the whole cost is a scan over typed arrays.
 *
 * A cover the index does not know gets an empty list and a 200, not a 404:
 * the index holds fifty works, not the catalogue, and "I have not indexed
 * this" is not "this does not exist" (SPEC §4 N12).
 */
export interface SimilarResponse {
  coverId: string;
  builtAt: string;
  covers: ReturnType<typeof similarTo>;
}

const MAX_LIMIT = 12;

export async function GET(request: NextRequest, context: { params: Promise<{ coverId: string }> }) {
  const limited = rateLimited(request, 'similar');
  if (limited) return limited;

  const { coverId } = await context.params;
  const id = decodeURIComponent(coverId);
  if (!/^(ol|gb):[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'Malformed cover id' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const raw = Number(request.nextUrl.searchParams.get('limit') ?? 6);
  const limit = Number.isFinite(raw) ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(raw))) : 6;

  const body: SimilarResponse = { coverId: id, builtAt: indexBuiltAt(), covers: similarTo(id, limit) };
  return NextResponse.json(body, {
    // The index only changes when someone commits a new one, so this may be
    // cached hard; a deploy replaces it.
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=604800, stale-while-revalidate=604800' },
  });
}
