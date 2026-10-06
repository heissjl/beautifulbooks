import { NextRequest } from 'next/server';
import { WallError } from '@/lib/walls/model';
import { matchCalibreBooks, validQueries } from '@/lib/walls/calibre';
import { json, openWalls, readJson } from '../guard';
import { measure } from '@/app/api/measure';

/**
 * POST /api/walls/calibre {books: [{title, author, isbns}]} — a few books of
 * a Calibre library or a Goodreads export (5.19, `source`) → a match, a suggestion, nothing, or "did not answer" for
 * each, in the order sent (ROADMAP 5.17a). The library itself never comes
 * here: the browser read `metadata.db` and sends what it cleaned, at most
 * `CALIBRE_BOOKS_PER_REQUEST` books at a time, one request after another.
 *
 * Nothing is stored and nothing about the books is logged; one line `bb.calibre`
 * counts what was asked and found, as `bb.photo` does for a photo.
 */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  measure('walls', request);
  const open = openWalls(request, 'wallsCalibre');
  if ('response' in open) return open.response;
  const body = await readJson(request);
  if (!body) return json({ error: 'Send JSON.' }, 415);
  let books;
  try {
    books = validQueries(body.books);
  } catch (err) {
    return json({ error: err instanceof WallError ? err.message : 'Bad books.' }, 400);
  }
  const started = Date.now();
  const matches = await matchCalibreBooks(books);
  try {
    console.info(
      `bb.calibre ${JSON.stringify({
        // Which file the reader chose (5.19): the same lookup, counted apart.
        source: body.source === 'goodreads' ? 'goodreads' : 'calibre',
        books: books.length,
        withIsbn: books.filter((b) => b.isbns.length > 0).length,
        match: matches.filter((m) => m.status === 'match').length,
        suggestion: matches.filter((m) => m.status === 'suggestion').length,
        none: matches.filter((m) => m.status === 'none').length,
        failed: matches.filter((m) => m.status === 'failed').length,
        ms: Date.now() - started,
        at: new Date().toISOString(),
      })}`,
    );
  } catch {
    // A log line is not worth breaking the answer over.
  }
  return json({ matches });
}
