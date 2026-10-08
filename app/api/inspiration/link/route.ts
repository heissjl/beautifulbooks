import { NextRequest } from 'next/server';
import { measure } from '@/app/api/measure';
import { closed, json } from '@/app/api/inspiration/guard';
import { boardQuery, filledCount, isFull, parseBoard } from '@/lib/inspiration/board';
import { linkStoreFromEnv } from '@/lib/inspiration/store';

/**
 * POST /api/inspiration/link { q } — the address a finished board is shared
 * under (ROADMAP 5.18b).
 *
 * With the links' own store: `/inspiration/<8 characters>`, written once.
 * Without it, or when it does not answer: the long form, which needs no
 * store because the board is in it. Either way the reader gets a link that
 * works; `short` says which one it is. Nothing about the reader is kept —
 * the record is the board and the name they put on the picture.
 */
export async function POST(request: NextRequest) {
  measure('portrait', request);
  const refused = closed(request, 'inspiration');
  if (refused) return refused;
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return json({ error: 'Send JSON.' }, 415);
  let q = '';
  try {
    const body: unknown = await request.json();
    if (body && typeof body === 'object' && typeof (body as { q?: unknown }).q === 'string') q = (body as { q: string }).q.slice(0, 2000);
  } catch {
    return json({ error: 'Send JSON.' }, 400);
  }
  const board = parseBoard(new URLSearchParams(q));
  if (filledCount(board) === 0) return json({ error: 'An empty board gets no link.' }, 400);
  // Only a full board is shared (lib/inspiration/board.ts, isFull); the editor says so before it asks.
  if (!isFull(board)) return json({ error: 'Fill every place on the board first, or choose a smaller board.' }, 400);
  const long = `/shelfportrait/board?${boardQuery(board)}`;
  const store = linkStoreFromEnv();
  if (!store) return json({ path: long, short: false });
  try {
    return json({ path: `/shelfportrait/${await store.put(board)}`, short: true }, 201);
  } catch {
    return json({ path: long, short: false });
  }
}
