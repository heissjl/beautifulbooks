import { NextRequest, NextResponse } from 'next/server';
import { MIN_QUERY_LENGTH, normalizeQuery, search } from '@/lib/search';
import { SourceUnavailableError } from '@/lib/sources/http';
import { rateLimited } from '@/app/api/rate';

/**
 * GET /api/search?q=<query>&lang=<iso|all>
 * The only search entry point for the UI (SPEC §4 N1). Response: SearchResult.
 *
 * A 200 here means Open Library answered, and an empty `works` in it means it
 * had nothing. Everything else is a status, never an empty list: 400 for a
 * query too short to ask, 503 when the catalogue stayed silent (SPEC §3 F1.7).
 * Only the 200 carries a cache header — an outage cached for an hour would go
 * on telling every visitor that the book does not exist.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimited(request, 'search', 'google');
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const query = normalizeQuery(params.get('q'));
  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }
  if (query.length < MIN_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Search for at least ${MIN_QUERY_LENGTH} characters` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const result = await search(query, { language: params.get('lang') ?? undefined });
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    if (err instanceof SourceUnavailableError) {
      return NextResponse.json(
        { error: 'Open Library did not answer' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
