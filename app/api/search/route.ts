import { NextRequest, NextResponse } from 'next/server';
import { normalizeQuery, search } from '@/lib/search';
import { rateLimited } from '@/app/api/rate';

/**
 * GET /api/search?q=<query>&lang=<iso|all>
 * The only search entry point for the UI (SPEC §4 N1). Response: SearchResult.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimited(request, 'search', 'google');
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const query = normalizeQuery(params.get('q'));
  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }
  try {
    const result = await search(query, { language: params.get('lang') ?? undefined });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
