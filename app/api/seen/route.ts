import { NextRequest, NextResponse } from 'next/server';
import { later } from '@/app/api/count';
import { rateLimited } from '@/app/api/rate';
import { MAX_SIGNAL_BYTES, parseSignal } from '@/lib/insights/signals';
import { countSignal } from '@/lib/insights/store';
import { ADMIN_COOKIE, adminTokenValid } from '@/lib/suggest/auth';

/**
 * POST /api/seen — one summary of a page a reader just left (ROADMAP 3.1b,
 * docs/plans/PLAN-3.1-analyse.md §4), sent with `navigator.sendBeacon`.
 *
 * **Always 204**, whatever arrives and whatever the store does: a reader must
 * never be able to tell from the answer whether anything was counted. A body
 * that is too long, not JSON, or has a field outside its list is dropped
 * whole (`parseSignal`). Julian's own visits, with the admin cookie, are not
 * counted. The name is deliberately not "track", "event" or "analytics",
 * which ad blockers' lists catch.
 */
export const dynamic = 'force-dynamic';

const NOTHING = () => new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  if (rateLimited(request, 'seen')) return NOTHING();
  if (adminTokenValid(request.cookies.get(ADMIN_COOKIE)?.value)) return NOTHING();
  let text: string;
  try {
    text = await request.text();
  } catch {
    return NOTHING();
  }
  if (text.length > MAX_SIGNAL_BYTES) return NOTHING();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NOTHING();
  }
  const signal = parseSignal(body);
  if (signal) later(() => countSignal(signal));
  return NOTHING();
}
