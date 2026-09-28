import { NextRequest, NextResponse } from 'next/server';
import { MIN_QUERY_LENGTH, normalizeQuery, search, searchByAuthor } from '@/lib/search';
import { parseAuthorQuery } from '@/lib/authorsearch';
import { SourceUnavailableError } from '@/lib/sources/http';
import { rateLimited } from '@/app/api/rate';

/**
 * GET /api/search?q=<query>[&exact=1]   (a `lang` parameter is ignored since 6.60)
 * GET /api/search?author=<name>[&key=OL…A]
 * The only search entry point for the UI (SPEC §4 N1). Response: SearchResult,
 * or AuthorSearchResult for the author mode (ROADMAP 6.60, SPEC F1.10).
 *
 * Never spends the `google` bucket: a search asks Open Library only (N9),
 * and since 6.60 at most twice — the second time for a corrected spelling or,
 * in the author mode, for the works of the person a name was taken to mean.
 *
 * A 200 here means Open Library answered, and an empty `works` in it means it
 * had nothing. Everything else is a status, never an empty list: 400 for a
 * query too short to ask, 503 when the catalogue stayed silent (SPEC §3 F1.7).
 * Only the 200 carries a cache header — an outage cached for an hour would go
 * on telling every visitor that the book does not exist.
 */
/*
  Worst case since ROADMAP 1.10: two attempts at Open Library, 20 s in all.
  A platform limit below that would turn a slow but valid answer into an
  error — the failure the 12 s cap in F3.3 was meant to avoid. Read the
  plan's limit in the dashboard before trusting this (ROADMAP 2.1).
*/
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const limited = rateLimited(request, 'search');
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const author = parseAuthorQuery(params.get('author'), params.get('key'));
  if (author) return answer(() => searchByAuthor(author), !author.key && author.name.length < MIN_QUERY_LENGTH);

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
  /*
    `lang` is read no more (ROADMAP 6.60, PLAN-search-2026-09 §6.1, Julian
    2026-09-27): the language pills are gone and the list is the same in
    every language. An old link's `?lang=` is the detail page's business.
  */
  return answer(() => search(query, { exact: params.get('exact') === '1' }), false);
}

async function answer(run: () => Promise<unknown>, tooShort: boolean): Promise<NextResponse> {
  if (tooShort) {
    return NextResponse.json(
      { error: `Search for at least ${MIN_QUERY_LENGTH} characters` },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  try {
    const result = await run();
    return NextResponse.json(result, {
      // A day, matching OL_REVALIDATE.search (SPEC §4 N4, ROADMAP 1.10): the
      // list of works for a title does not change by the hour, and a source
      // this unreliable is better asked once a day than once an hour.
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400' },
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
