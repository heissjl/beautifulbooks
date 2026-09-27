import { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { isAuthorKey, otherWorksByAuthor, withCuratedCovers, type AuthorWork } from '@/lib/authorworks';
import { CURATED_LIST } from '@/lib/curated';
import { searchAuthorWorks } from '@/lib/sources/openlibrary';

/**
 * GET /api/authors/<OL…A>/works
 *
 * Candidates for the "More by …" row under a wall (ROADMAP 6.53, SPEC F2.15):
 * one Open Library search per author, cached for a day, **never Google**.
 * Its own route rather than a field of `/api/works/[id]`, because that one is
 * cached per work and market and its page 0 spends the `google` bucket; this
 * answer is the same for every book of the author.
 *
 * 200 is an answer, even an empty one; 503 is silence and is never cached,
 * or a slow minute at Open Library would hide the row for a day (SPEC N12).
 * Where Julian picked a cover for a work (data/curated.json) that cover
 * replaces Open Library's default — here, on the server, so the file never
 * reaches the browser.
 */
export interface AuthorWorksResponse {
  authorKey: string;
  works: AuthorWork[];
}

const CURATED_COVERS: ReadonlyMap<string, number> = new Map(CURATED_LIST.map(w => [w.id, w.coverId]));

export async function GET(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  const limited = rateLimited(request, 'author');
  if (limited) return limited;

  const { key } = await context.params;
  const authorKey = decodeURIComponent(key);
  if (!isAuthorKey(authorKey)) {
    return NextResponse.json({ error: 'Malformed author key' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  let docs;
  try {
    docs = await searchAuthorWorks(authorKey);
  } catch {
    return NextResponse.json({ error: 'Open Library did not answer' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const body: AuthorWorksResponse = {
    authorKey,
    works: withCuratedCovers(otherWorksByAuthor(docs, authorKey), CURATED_COVERS),
  };
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
