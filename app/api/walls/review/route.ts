import { NextRequest } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { ADMIN_COOKIE, adminMatches, adminSessionValid } from '@/lib/suggest/auth';
import { isWallId, review, toPublic } from '@/lib/walls/model';
import { awaitingReview } from '@/lib/walls/store';
import { json, openWalls, readJson, storeDown } from '../guard';

/**
 * Julian's look at walls offered for the showcase (ROADMAP 5.13d): readers
 * write the title and the paragraph, so nothing they wrote is shown among
 * readers' walls until he has read it. Julian only: the admin cookie from
 * signing in on /curate, or the admin password as a bearer token.
 */
function isAdmin(request: NextRequest): boolean {
  return (
    adminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value) ||
    adminMatches((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''))
  );
}

export async function GET(request: NextRequest) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  if (!isAdmin(request)) return rateLimited(request, 'login') ?? json({ error: 'Only Julian can read this. Sign in on /curate first.' }, 403);
  try {
    return json({ walls: (await awaitingReview(open.store)).map(toPublic) });
  } catch {
    return storeDown();
  }
}

export async function POST(request: NextRequest) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  if (!isAdmin(request)) return rateLimited(request, 'login') ?? json({ error: 'Only Julian can decide this.' }, 403);
  const body = await readJson(request);
  const id = body?.id;
  const decision = body?.decision;
  if (!isWallId(id) || (decision !== 'approved' && decision !== 'declined')) return json({ error: 'Send an id and approved or declined.' }, 400);
  try {
    const wall = await open.store.get(id);
    if (!wall) return json({ error: 'No such wall.' }, 404);
    if (!wall.showcase) return json({ error: 'The owner withdrew it.' }, 409);
    const next = review(wall, decision, new Date().toISOString());
    await open.store.put(next);
    return json({ wall: toPublic(next) });
  } catch {
    return storeDown();
  }
}
