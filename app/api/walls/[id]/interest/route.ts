import { NextRequest } from 'next/server';
import { isWallId } from '@/lib/walls/model';
import { json, openWalls, storeDown } from '../../guard';

/**
 * POST /api/walls/<id>/interest — "I'd order this wall framed" (ROADMAP 5.14a).
 * Nothing is sold yet; this counts, per collection, how many would, so the
 * gate before step 2 has a number. Nothing about who pressed it; the browser
 * remembers it pressed, the server does not.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const { id } = await params;
  if (!isWallId(id)) return json({ error: 'No such collection.' }, 404);
  try {
    if (!(await open.store.get(id))) return json({ error: 'No such collection.' }, 404);
    await open.store.interest(id);
    return json({ counted: true });
  } catch {
    return storeDown();
  }
}
