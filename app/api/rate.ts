import { NextRequest, NextResponse } from 'next/server';
import { clientKey, consume, type RateBucketName } from '@/lib/ratelimit';

/**
 * Spends a token in each named bucket and returns a 429 when any is empty,
 * else null (SPEC §10 B5).
 *
 * Routes that can cost a Google Books request pass `'google'` as a second
 * bucket: the quota is shared, so bounding it per route would not bound it
 * at all. Buckets are spent left to right and a refusal stops there, so the
 * route's own bucket — the narrower statement about what the caller did —
 * decides the wait it is told to observe.
 */
export function rateLimited(request: NextRequest, ...buckets: RateBucketName[]): NextResponse | null {
  const client = clientKey(request.headers);
  for (const bucket of buckets) {
    const decision = consume(bucket, client);
    if (decision.ok) continue;
    return NextResponse.json(
      { error: 'Too many requests, try again shortly' },
      { status: 429, headers: { 'Retry-After': String(decision.retryAfter), 'Cache-Control': 'no-store' } },
    );
  }
  return null;
}
