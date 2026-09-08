/**
 * A brake on cheap crawlers (SPEC §8.7, §10 B5). Server-side only.
 *
 * The scarce resource is not CPU, it is the Google Books quota: a search
 * costs one request, a cold detail page two, and nothing else costs anything
 * (SPEC §8.7, §9.3 step 13a). So the routes that can spend one share a
 * `google` bucket on top of their own, which is the honest way to bound the
 * bill — bounding each route separately would still let a crawler spend the
 * day's quota through the cheapest of them.
 *
 * **This is not a security feature.** The counters live in the memory of one
 * instance, and a serverless deployment runs several, so the real limit is a
 * multiple of the numbers below. It stops one crawler walking a sitemap,
 * which is the case §8.7 names. A shared counter needs Redis, which §8.6
 * defers until the numbers demand it.
 */
import { debug } from './debug';

export interface RateRule {
  /** Requests allowed in one burst. */
  capacity: number;
  /** Sustained rate: tokens added per minute. */
  refillPerMinute: number;
}

export interface Bucket {
  tokens: number;
  /** When `tokens` was last brought up to date, in ms. */
  updated: number;
}

export interface RateDecision {
  ok: boolean;
  /** Whole seconds until the next token, 0 when the request passed. */
  retryAfter: number;
}

/**
 * Per-route buckets. A detail page loads up to sixteen pages of editions and
 * a result list asks for up to twenty mosaics, so `works` has to be wide
 * enough for two of each in a burst without ever letting a crawler settle in.
 */
export const RATE_RULES = {
  search: { capacity: 30, refillPerMinute: 20 },
  works: { capacity: 120, refillPerMinute: 60 },
  isbn: { capacity: 40, refillPerMinute: 20 },
  /** The dearest route: every click asks every shop twice (SPEC §9.3 step 16). */
  availability: { capacity: 6, refillPerMinute: 3 },
  /**
   * Similar covers: a scan over the built index, no external request at all
   * (ROADMAP 6.10). Generous on purpose — it costs CPU measured in
   * microseconds and nobody else's quota — but not unbounded, because a
   * crawler that walks every cover would still occupy a function.
   */
  similar: { capacity: 60, refillPerMinute: 60 },
  /** Shared by every request that can spend a Google Books request. */
  google: { capacity: 20, refillPerMinute: 5 },
} as const satisfies Record<string, RateRule>;

export type RateBucketName = keyof typeof RATE_RULES;

/**
 * Takes one token, refilling first. Pure: the caller passes the clock, so the
 * behaviour over time is testable without waiting for it.
 */
export function take(bucket: Bucket, rule: RateRule, now: number): { bucket: Bucket; decision: RateDecision } {
  const perMs = rule.refillPerMinute / 60_000;
  const tokens = Math.min(rule.capacity, bucket.tokens + Math.max(0, now - bucket.updated) * perMs);
  if (tokens >= 1) {
    return { bucket: { tokens: tokens - 1, updated: now }, decision: { ok: true, retryAfter: 0 } };
  }
  const waitMs = (1 - tokens) / perMs;
  return {
    bucket: { tokens, updated: now },
    decision: { ok: false, retryAfter: Math.max(1, Math.ceil(waitMs / 1000)) },
  };
}

/** Above this many keys the store drops the idle ones (see `sweep`). */
export const MAX_KEYS = 10_000;

const store = new Map<string, Bucket>();

/**
 * Drops buckets that are full again: their owner has stopped asking, so
 * forgetting them changes nothing. Runs only when the store grows past
 * `MAX_KEYS`, which needs ten thousand distinct clients on one instance.
 */
function sweep(now: number): void {
  for (const [key, bucket] of store) {
    const rule = RATE_RULES[key.slice(0, key.indexOf(':')) as RateBucketName];
    if (!rule) {
      store.delete(key);
      continue;
    }
    if (bucket.tokens + (now - bucket.updated) * (rule.refillPerMinute / 60_000) >= rule.capacity) {
      store.delete(key);
    }
  }
  debug('ratelimit', `swept, ${store.size} keys left`);
}

/**
 * Spends one token of `name` for `client`. Exported for the routes; the
 * store is module state, so tests use `take` or `resetRateLimits`.
 */
export function consume(name: RateBucketName, client: string, now = Date.now()): RateDecision {
  const rule = RATE_RULES[name];
  const key = `${name}:${client}`;
  const current = store.get(key) ?? { tokens: rule.capacity, updated: now };
  const { bucket, decision } = take(current, rule, now);
  store.set(key, bucket);
  if (store.size > MAX_KEYS) sweep(now);
  if (!decision.ok) debug('ratelimit', `${key} exhausted, retry in ${decision.retryAfter}s`);
  return decision;
}

/** For tests. */
export function resetRateLimits(): void {
  store.clear();
}

/**
 * Who is asking. The first entry of `x-forwarded-for` is the client as the
 * edge saw it; everything after it is proxies. Requests without any of these
 * headers share one bucket, which is the conservative direction: a caller we
 * cannot tell apart from another is treated as the same caller.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
