/**
 * The token bucket behind the API limits (SPEC §10 B5, lib/ratelimit.ts).
 * `take` is pure, so the passage of time is a parameter, not a wait.
 */
import { describe, expect, it } from 'vitest';
import { clientKey, consume, RATE_RULES, resetRateLimits, take, type Bucket } from '../ratelimit';

const RULE = { capacity: 10, refillPerMinute: 60 } as const;
const full = (now: number): Bucket => ({ tokens: RULE.capacity, updated: now });

describe('take', () => {
  it('lets a full bucket through in one burst, then refuses', () => {
    let bucket = full(0);
    for (let i = 0; i < RULE.capacity; i++) {
      const r = take(bucket, RULE, 0);
      expect(r.decision.ok).toBe(true);
      bucket = r.bucket;
    }
    const refused = take(bucket, RULE, 0);
    expect(refused.decision.ok).toBe(false);
    // 60 per minute is one per second, so the next token is a second away.
    expect(refused.decision.retryAfter).toBe(1);
  });

  it('refills over time and never past the capacity', () => {
    const empty: Bucket = { tokens: 0, updated: 0 };
    expect(take(empty, RULE, 5_000).decision.ok).toBe(true);
    // An hour idle must not buy an hour's worth of requests.
    const rested = take(empty, RULE, 3_600_000);
    expect(rested.bucket.tokens).toBe(RULE.capacity - 1);
  });

  it('reports a wait of at least a second, rounded up', () => {
    const slow = { capacity: 3, refillPerMinute: 3 } as const;
    const empty: Bucket = { tokens: 0, updated: 0 };
    // 3 per minute is one per 20 s; half a token in means 10 s to wait.
    expect(take(empty, slow, 10_000).decision.retryAfter).toBe(10);
    expect(take(empty, slow, 19_500).decision.retryAfter).toBe(1);
  });

  it('ignores a clock that jumps backwards', () => {
    const bucket: Bucket = { tokens: 2, updated: 10_000 };
    const r = take(bucket, RULE, 5_000);
    expect(r.decision.ok).toBe(true);
    expect(r.bucket.tokens).toBe(1);
  });
});

describe('consume', () => {
  it('keeps clients apart and buckets apart', () => {
    resetRateLimits();
    const now = 1_000_000;
    for (let i = 0; i < RATE_RULES.availability.capacity; i++) {
      expect(consume('availability', 'a', now).ok).toBe(true);
    }
    expect(consume('availability', 'a', now).ok).toBe(false);
    // Another caller is unaffected, and so is another route for the same caller.
    expect(consume('availability', 'b', now).ok).toBe(true);
    expect(consume('search', 'a', now).ok).toBe(true);
  });

  it('lets a whole search result page through without a refusal', () => {
    resetRateLimits();
    const now = 2_000_000;
    // One search, twenty card mosaics, then a detail page: sixteen edition
    // pages of which only the first is charged against the Google bucket.
    expect(consume('search', 'c', now).ok).toBe(true);
    expect(consume('google', 'c', now).ok).toBe(true);
    for (let i = 0; i < 20; i++) expect(consume('works', 'c', now).ok).toBe(true);
    for (let i = 0; i < 16; i++) expect(consume('works', 'c', now).ok).toBe(true);
    expect(consume('google', 'c', now).ok).toBe(true);
  });
});

describe('clientKey', () => {
  it('takes the first address of x-forwarded-for, else x-real-ip', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(clientKey(new Headers({ 'x-real-ip': '203.0.113.8' }))).toBe('203.0.113.8');
  });

  it('puts callers it cannot tell apart in one bucket', () => {
    expect(clientKey(new Headers())).toBe('unknown');
    expect(clientKey(new Headers({ 'x-forwarded-for': '  ' }))).toBe('unknown');
  });
});
