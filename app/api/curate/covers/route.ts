import { NextRequest } from 'next/server';
import { inSeries } from '@/lib/collectionedit';
import { getWorkPage, isWorkId } from '@/lib/work';
import { json, memberGate } from '../../suggest/guard';
import { draftStore, loadDraft } from '../store';

/**
 * Covers of one book for a draft, a hundred editions a page (ROADMAP 5.10b).
 * Open Library only, never Google, no siblings, no description: one external
 * call per page. For a series draft only the covers of editions under one of
 * its publisher spellings, as in Julian's tool.
 */
export async function GET(request: NextRequest) {
  const gate = memberGate(request);
  if ('response' in gate) return gate.response;
  const s = draftStore();
  if ('response' in s) return s.response;
  const loaded = await loadDraft(s.store, request.nextUrl.searchParams.get('draft'));
  if ('response' in loaded) return loaded.response;
  const id = request.nextUrl.searchParams.get('work') ?? '';
  const offset = Math.max(0, Math.floor(Number(request.nextUrl.searchParams.get('offset')) || 0));
  if (!isWorkId(id) || offset % 100 !== 0) return json({ error: 'bad work or offset' }, 400);
  let page;
  try {
    page = await getWorkPage(id, { offset, googleBooks: false, siblings: false, workDescription: 'never' });
  } catch {
    return json({ error: 'Open Library did not answer. Try again in a moment.' }, 502);
  }
  if (!page) return json({ error: 'No such book.' }, 404);
  const draft = loaded.draft;
  const editions = new Map(page.editions.map(e => [e.id, e]));
  const covers = page.covers
    .filter(c => c.id.startsWith('ol:'))
    .map(c => ({ c, editions: c.editionIds.map(e => editions.get(e)).filter(e => e !== undefined) }))
    .filter(({ editions: es }) => draft.kind !== 'series' || es.some(e => inSeries(e.publisher ? [e.publisher] : undefined, draft.publishers ?? [])))
    .map(({ c, editions: es }) => ({ id: c.id, year: es[0]?.year, publisher: es[0]?.publisher }));
  const { offset: at, limit, total } = page.page;
  return json({ covers, next: at + limit < (total ?? 0) ? at + limit : null });
}
