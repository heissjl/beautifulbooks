import { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { buildReport, parseMarket, parseRange } from '@/lib/insights/report';
import { ADMIN_COOKIE, adminMatches, adminTokenValid } from '@/lib/suggest/auth';

/**
 * GET /api/insights?days=7|30|90&market=us|uk|de — the analytics as JSON
 * (ROADMAP 3.1a), for the Cockpit and anything else of Julian's. Julian only:
 * the admin cookie from /curate, or the admin password as a bearer token.
 * Anyone else gets 404, so the address does not announce itself, and pays
 * from the login bucket for asking.
 */
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

function isAdmin(request: NextRequest): boolean {
  return (
    adminTokenValid(request.cookies.get(ADMIN_COOKIE)?.value) ||
    adminMatches((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''))
  );
}

export async function GET(request: NextRequest) {
  if (!isAdmin(request)) {
    return rateLimited(request, 'login') ?? NextResponse.json({ error: 'Not found' }, { status: 404, headers: NO_STORE });
  }
  const params = request.nextUrl.searchParams;
  const report = await buildReport(parseRange(params.get('days')), parseMarket(params.get('market')), undefined);
  if (!report.ok) {
    // A silent store is not a range without clicks (N12).
    return NextResponse.json({ error: report.reason === 'no-store' ? 'No store configured' : 'The store did not answer' }, { status: 503, headers: NO_STORE });
  }
  return NextResponse.json(report, { headers: NO_STORE });
}
