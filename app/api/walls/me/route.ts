import { NextRequest } from 'next/server';
import { isVisitorId, toPublic } from '@/lib/walls/model';
import { hashVisitor } from '@/lib/walls/owner';
import { wallsOf } from '@/lib/walls/store';
import { json, openWalls, readJson, setVisitor, storeDown, visitorOf } from '../guard';

/**
 * GET /api/walls/me — this browser's visitor id and its walls (E22).
 * POST /api/walls/me {visitor} — the footer's Save, as on taketest.xyz: this
 * browser becomes the visitor whose id was pasted.
 */
export async function GET(request: NextRequest) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const visitor = visitorOf(request);
  if (!visitor) return json({ visitor: null, walls: [] });
  try {
    return json({ visitor, walls: (await wallsOf(open.store, hashVisitor(visitor))).map(toPublic) });
  } catch {
    return storeDown();
  }
}

export async function POST(request: NextRequest) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const body = await readJson(request);
  const id = typeof body?.visitor === 'string' ? body.visitor.trim() : '';
  if (!isVisitorId(id)) return json({ error: 'That is not an ID from this site.' }, 400);
  try {
    const walls = (await wallsOf(open.store, hashVisitor(id))).map(toPublic);
    return setVisitor(json({ visitor: id, walls }), id);
  } catch {
    return storeDown();
  }
}
