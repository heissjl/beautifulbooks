import { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { cspReportLine, MAX_REPORT_BYTES } from '@/lib/cspreport';

/**
 * POST /api/csp — a browser's report that the page did something the
 * Content-Security-Policy does not allow (ROADMAP 2.12). The policy is
 * report-only, so this is the only place its violations become visible: one
 * `bb.csp` line in the Vercel log per report, with the directive, the host
 * that was blocked and the page's path — nothing about the reader, no IP,
 * no user agent, no query string. **Always 204**, like `/api/seen`: a report
 * is the browser's doing, and nobody learns anything from the answer.
 */
export const dynamic = 'force-dynamic';

const NOTHING = () => new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  if (rateLimited(request, 'csp')) return NOTHING();
  let text: string;
  try {
    text = await request.text();
  } catch {
    return NOTHING();
  }
  if (text.length > MAX_REPORT_BYTES) return NOTHING();
  const line = cspReportLine(text);
  // Ungated like the quota breaker's line: operation's telemetry, not debugging.
  if (line) console.warn(`bb.csp ${line}`);
  return NOTHING();
}
