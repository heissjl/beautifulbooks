import { NextRequest, NextResponse } from 'next/server';
import { readBounded } from '@/app/api/body';
import { later } from '@/app/api/count';
import { rateLimited } from '@/app/api/rate';
import { MAX_SIGNAL_BYTES, parseSignal } from '@/lib/insights/signals';
import { countRejected, flushInsights, queueSignal } from '@/lib/insights/store';
import { humanRequest } from '@/lib/insights/human';
import { recordRejected } from '@/lib/clicks';
import { ADMIN_COOKIE, adminTokenValid } from '@/lib/suggest/auth';
import { measure } from '@/app/api/measure';

/**
 * POST /api/seen — one summary of a page a reader just left (ROADMAP 3.1b,
 * docs/plans/PLAN-3.1-analyse.md §4), sent with `navigator.sendBeacon`.
 *
 * **Always 204**, whatever arrives and whatever the store does: a reader must
 * never be able to tell from the answer whether anything was counted. A body
 * that is too long, not JSON, or has a field outside its list is dropped
 * whole (`parseSignal`). Julian's own visits, with the admin cookie, are not
 * counted. Nor is a beacon that cannot be a person's (ROADMAP 3.1i,
 * `lib/insights/human.ts`): one not sent from a page of this site, or from a
 * browser of two years ago — the scraper of 2.18f sent 974 of those on
 * 2026-10-17 and K16 called them readers. Such a request adds one to the
 * day's rejected count, a class, and gets the same 204. The name is
 * deliberately not "track", "event" or "analytics", which ad blockers' lists
 * catch.
 */
export const dynamic = 'force-dynamic';

const NOTHING = () => new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  measure('seen', request);
  if (rateLimited(request, 'seen')) return NOTHING();
  if (adminTokenValid(request.cookies.get(ADMIN_COOKIE)?.value)) return NOTHING();
  const verdict = humanRequest(request.headers, 'seen');
  if (!verdict.human) {
    recordRejected('seen', verdict.reason);
    later(() => countRejected('seen', verdict.reason));
    return NOTHING();
  }
  // Cut off at the ceiling before it is held in memory (red team L3), not measured after reading.
  const text = await readBounded(request, MAX_SIGNAL_BYTES);
  if (text === null) return NOTHING();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NOTHING();
  }
  const signal = parseSignal(body);
  if (signal) {
    // Into the instance's buffer now, to the store at most every ten seconds, after the answer has left (2.18d).
    queueSignal(signal);
    later(() => flushInsights());
  }
  return NOTHING();
}
