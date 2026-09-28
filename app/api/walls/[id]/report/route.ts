import { NextRequest } from 'next/server';
import { isWallId } from '@/lib/walls/model';
import { json, openWalls, storeDown } from '../../guard';

/**
 * POST /api/walls/<id>/report — anyone may flag a shown wall (ROADMAP 5.13d).
 * With no review before a wall appears, this is how Julian learns of one to
 * take down. A count per wall; nothing about who pressed it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const { id } = await params;
  if (!isWallId(id)) return json({ error: 'No such collection.' }, 404);
  try {
    const wall = await open.store.get(id);
    if (!wall || wall.showcase !== 'shown') return json({ error: 'No such collection among readers’ collections.' }, 404);
    await open.store.report(id);
    return json({ reported: true });
  } catch {
    return storeDown();
  }
}
