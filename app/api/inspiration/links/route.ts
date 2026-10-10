import { NextRequest, NextResponse } from 'next/server';
import { boardQuery } from '@/lib/inspiration/board';
import { linkStoreFromEnv } from '@/lib/inspiration/store';
import { measure } from '@/app/api/measure';
import { rateLimited } from '@/app/api/rate';
import { ADMIN_COOKIE, adminMatches, adminTokenValid } from '@/lib/suggest/auth';

/**
 * GET /api/inspiration/links — every Shelf-Portrait short link, newest first, for Julian only (K17, ROADMAP 5.18b):
 * the admin cookie from /curate or the admin password as a bearer token, like /api/insights. Anyone else gets 404.
 * Each row is the date, the id and the board's query — the same that its public link shows; nothing about a maker.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  measure('curate', request);
  const admin =
    adminTokenValid(request.cookies.get(ADMIN_COOKIE)?.value) ||
    adminMatches((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''));
  // A wrong password costs a token from the login bucket, as on /api/insights.
  if (!admin) return rateLimited(request, 'login') ?? NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'cache-control': 'no-store' } });
  const store = linkStoreFromEnv();
  if (!store?.list) return NextResponse.json({ ok: false, reason: 'no-store' }, { headers: { 'cache-control': 'no-store' } });
  try {
    const list = await store.list(1000);
    if (!list) return NextResponse.json({ ok: false, reason: 'no-scan' }, { headers: { 'cache-control': 'no-store' } });
    return NextResponse.json(
      { ok: true, count: list.count, truncated: list.truncated, links: list.links.map(r => ({ id: r.id, at: r.at, q: boardQuery(r.board) })) },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json({ ok: false, reason: 'store-down' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
