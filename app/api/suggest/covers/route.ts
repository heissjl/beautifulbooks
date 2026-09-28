import { NextRequest } from 'next/server';
import { getWorkPage, isWorkId } from '@/lib/work';
import { friendGate, json } from '../guard';

/**
 * The covers of one book for the suggestion tool (ROADMAP 5.10a): one page of
 * a hundred Open Library editions, and **never Google** — the tool needs
 * cover ids a collection can keep, and Google's images are not those
 * (CLAUDE.md: Google is called in exactly two places). No siblings and no
 * description either: one external call per page, nothing else.
 */
export async function GET(request: NextRequest) {
  const gate = friendGate(request);
  if ('response' in gate) return gate.response;
  const id = request.nextUrl.searchParams.get('id') ?? '';
  const offset = Math.max(0, Math.floor(Number(request.nextUrl.searchParams.get('offset')) || 0));
  if (!isWorkId(id) || offset % 100 !== 0) return json({ error: 'bad id or offset' }, 400);
  let page;
  try {
    page = await getWorkPage(id, { offset, googleBooks: false, siblings: false, workDescription: 'never' });
  } catch {
    // A catalogue that did not answer is not a book without covers (N12).
    return json({ error: 'Open Library did not answer. Try again in a moment.' }, 502);
  }
  if (!page) return json({ error: 'No such book.' }, 404);
  const editions = new Map(page.editions.map(e => [e.id, e]));
  const covers = page.covers
    .filter(c => c.id.startsWith('ol:'))
    .map(c => {
      const e = editions.get(c.editionIds[0]);
      return { id: c.id, year: e?.year, publisher: e?.publisher };
    });
  return json({ covers, next: page.page.offset + page.page.limit < (page.page.total ?? 0) ? page.page.offset + page.page.limit : null });
}
