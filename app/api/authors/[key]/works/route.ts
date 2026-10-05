import { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { isAuthorKey, otherWorksByAuthor, withCuratedCovers, type AuthorWork } from '@/lib/authorworks';
import { CURATED_LIST } from '@/lib/curated';
import { keysForLinkedAuthor } from '@/lib/authorsearch';
import { searchAuthorsByName, searchAuthorWorks } from '@/lib/sources/openlibrary';
import { measure } from '@/app/api/measure';

/**
 * GET /api/authors/<OL…A>/works[?name=<her name>]
 *
 * With `name` (since ROADMAP 6.60, plan §6.4) the key is widened to her other
 * records of the same name, by the author search's rule (`keysForLinkedAuthor`):
 * one Open Library request more, and if it stays silent the key alone is
 * asked, as before. Without `name` nothing changes.
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
  measure('authors', request);
  const limited = rateLimited(request, 'author');
  if (limited) return limited;

  const { key } = await context.params;
  const authorKey = decodeURIComponent(key);
  if (!isAuthorKey(authorKey)) {
    return NextResponse.json({ error: 'Malformed author key' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const name = (request.nextUrl.searchParams.get('name') ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  let keys = [authorKey];
  if (name.length >= 3) {
    try {
      keys = keysForLinkedAuthor(authorKey, await searchAuthorsByName(name));
    } catch {
      // The name lookup is a bonus; silence leaves the key alone (as before 6.60).
    }
  }

  let docs;
  try {
    docs = await searchAuthorWorks(keys);
  } catch {
    return NextResponse.json({ error: 'Open Library did not answer' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const body: AuthorWorksResponse = {
    authorKey,
    works: withCuratedCovers(otherWorksByAuthor(docs, keys), CURATED_COVERS),
  };
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
