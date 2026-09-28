import { NextRequest } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { ADMIN_COOKIE, adminMatches, adminSessionValid } from '@/lib/suggest/auth';
import { isWallId, moderate, toPublic } from '@/lib/walls/model';
import { moderationList } from '@/lib/walls/store';
import { json, openWalls, readJson, storeDown } from '../guard';

/**
 * Julian's look at walls readers show (ROADMAP 5.13d). There is no review
 * before a wall appears (Julian, 2026-09-28: „ohne review“); this lists the
 * shown and taken-down walls, the most reported first, and lets him take one
 * down or put it back. Julian only: the admin cookie from /curate, or the
 * admin password as a bearer token.
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
    const [list, total] = await Promise.all([moderationList(open.store), open.store.count()]);
    return json({
      walls: list.map((s) => ({ wall: toPublic(s.wall), views: s.views, reports: s.reports })),
      totals: { collections: total },
    });
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
  if (!isWallId(id) || (decision !== 'hidden' && decision !== 'shown')) return json({ error: 'Send an id and hidden or shown.' }, 400);
  try {
    const wall = await open.store.get(id);
    if (!wall) return json({ error: 'No such collection.' }, 404);
    if (!wall.showcase) return json({ error: 'The owner stopped showing it.' }, 409);
    const next = moderate(wall, decision, new Date().toISOString());
    await open.store.put(next);
    return json({ wall: toPublic(next) });
  } catch {
    return storeDown();
  }
}
