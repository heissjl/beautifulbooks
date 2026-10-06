import { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { inspirationEnabled } from '@/lib/inspiration/switch';
import type { RateBucketName } from '@/lib/ratelimit';

/**
 * Why a route of "The books that inspired me" may not answer (ROADMAP 5.18b):
 * switched off (404, as if it did not exist) or too many requests (429).
 * Returns null when the route may go on.
 */
export function closed(request: NextRequest, bucket: RateBucketName): NextResponse | null {
  if (!inspirationEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return rateLimited(request, bucket);
}

export function json(body: unknown, status = 200, cache = 'no-store'): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cache } });
}

/** A day, like the search: a work's editions do not change by the hour (N4). */
export const DAY = 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400';

/** A source that did not answer is not "no covers" (SPEC N12). */
export const SILENT = 'Open Library did not answer. Try again in a moment.';
