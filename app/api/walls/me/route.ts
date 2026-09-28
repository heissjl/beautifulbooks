import { NextRequest } from 'next/server';
import { ownerHashes } from '@/lib/walls/account';
import { isVisitorId, normalVisitorId, toPublic } from '@/lib/walls/model';
import { hashVisitor } from '@/lib/walls/owner';
import { wallsOfAll } from '@/lib/walls/store';
import { claimant, json, linkIfSignedIn, openWalls, readJson, setVisitor, storeDown } from '../guard';

/**
 * GET /api/walls/me — this browser's visitor id, its walls and, when signed
 * in (5.13h), which provider — the walls then include those of every visitor
 * the account linked (E22, E23).
 * POST /api/walls/me {visitor} — the footer's Save, as on taketest.xyz: this
 * browser becomes the visitor whose id was pasted; a signed-in browser also
 * links that visitor to its account.
 */
export async function GET(request: NextRequest) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  try {
    const { visitor, linked, session } = await claimant(request, open.store);
    const account = session ? { provider: session.provider } : null;
    if (!visitor && !session) return json({ visitor: null, walls: [], account: null });
    const walls = await wallsOfAll(open.store, ownerHashes(visitor ? hashVisitor(visitor) : null, linked));
    return json({ visitor, walls: walls.map(toPublic), account });
  } catch {
    return storeDown();
  }
}

export async function POST(request: NextRequest) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const body = await readJson(request);
  const id = typeof body?.visitor === 'string' ? normalVisitorId(body.visitor) : '';
  if (!isVisitorId(id)) return json({ error: 'That is not an ID from this site.' }, 400);
  try {
    const { session } = await claimant(request, open.store);
    await linkIfSignedIn(open.store, session, id);
    const linked = session ? await open.store.linked(session.account) : [];
    const walls = (await wallsOfAll(open.store, ownerHashes(hashVisitor(id), linked))).map(toPublic);
    return setVisitor(json({ visitor: id, walls, account: session ? { provider: session.provider } : null }), id);
  } catch {
    return storeDown();
  }
}
