import { NextRequest } from 'next/server';
import { applyOp, isWallId, toPublic, WallError, type Wall, type WallOp } from '@/lib/walls/model';
import { isOwner } from '@/lib/walls/owner';
import type { WallStore } from '@/lib/walls/store';
import { json, openWalls, readJson, storeDown, visitorOf } from '../guard';

type Params = { params: Promise<{ id: string }> };

async function load(store: WallStore, id: string): Promise<Wall | null | 'down'> {
  try {
    return await store.get(id);
  } catch {
    return 'down';
  }
}

/** GET /api/walls/<id> — the wall, and whether this browser may change it. */
export async function GET(request: NextRequest, { params }: Params) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const { id } = await params;
  if (!isWallId(id)) return json({ error: 'No such collection.' }, 404);
  const wall = await load(open.store, id);
  if (wall === 'down') return storeDown();
  if (!wall) return json({ error: 'No such collection.' }, 404);
  return json({ wall: toPublic(wall), canEdit: isOwner(wall, visitorOf(request)) });
}

/** POST /api/walls/<id> {ops} — changes, one small operation at a time, by the owner only. */
export async function POST(request: NextRequest, { params }: Params) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const { id } = await params;
  if (!isWallId(id)) return json({ error: 'No such collection.' }, 404);
  const body = await readJson(request);
  if (!body) return json({ error: 'Send JSON.' }, 415);
  const wall = await load(open.store, id);
  if (wall === 'down') return storeDown();
  if (!wall) return json({ error: 'No such collection.' }, 404);
  if (!isOwner(wall, visitorOf(request))) return json({ error: 'Only the browser that made this collection can change it.' }, 403);

  const ops = Array.isArray(body.ops) ? (body.ops as WallOp[]).slice(0, 50) : [];
  let next = wall;
  try {
    const now = new Date().toISOString();
    for (const op of ops) next = applyOp(next, op, now);
  } catch (err) {
    return json({ error: err instanceof WallError ? err.message : 'Bad operation.' }, 400);
  }
  try {
    // Into the list of shown walls first, whenever it is newly shown (5.13d):
    // if that fails nothing has changed, and the answer "did not answer" is true.
    // A listed id whose wall is not saved as shown is skipped on reading.
    if (next.showcase === 'shown' && wall.showcase !== 'shown') await open.store.submitted(next.id);
    await open.store.put(next);
    // Counted once, when it stops being a try (5.13j).
    if (wall.unsaved && !next.unsaved) await open.store.counted(next.id);
  } catch {
    return storeDown();
  }
  return json({ wall: toPublic(next), canEdit: true });
}
