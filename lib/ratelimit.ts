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
  /**
   * The "More by …" row (ROADMAP 6.53): one request per wall a reader
   * scrolls to the bottom of, one Open Library search per author and day
   * behind the cache. Never `google` — the route cannot spend a request of it.
   */
  author: { capacity: 60, refillPerMinute: 30 },
  /**
   * The cover game (ROADMAP 5.8a): the next pair and the board. A pair a
   * click, and nobody clicks faster than once a second for long.
   */
  versus: { capacity: 60, refillPerMinute: 60 },
  /**
   * Votes and "not a cover" reports. Tighter than the pairs, because each one
   * writes to the store; the signed pair already stops a vote without a pair.
   */
  vote: { capacity: 40, refillPerMinute: 40 },
  /**
   * Cover images through our own route (ROADMAP 1.3). A single detail page
   * asks for up to 151 of them — measured on *The Great Gatsby* — so the
   * burst has to clear two walls without a crawler being able to settle in.
   * Most requests never reach the function at all: the CDN in front of it
   * holds each cover for 30 days.
   */
  img: { capacity: 800, refillPerMinute: 400 },
  /**
   * The suggestion tool behind its password (ROADMAP 5.10a): covers of a
   * book, and sending a suggestion. A friend picks a few books an evening.
   */
  suggest: { capacity: 40, refillPerMinute: 20 },
  /** Password attempts: few, so the shared password cannot be guessed at speed. */
  login: { capacity: 5, refillPerMinute: 2 },
  /**
   * Readers' own walls (ROADMAP 5.13a): each add, move or title change is one
   * write. A reader filling a wall clicks quickly, but not for long.
   */
  walls: { capacity: 60, refillPerMinute: 30 },
  /**
   * A photo read by the image model (5.13a): the one route that costs money
   * per request. Per instance, like every bucket here, so it bounds a burst,
   * not a bill; the switch keeps it off in production until Julian says.
   */
  wallsPhoto: { capacity: 3, refillPerMinute: 1 },
  /**
   * A Calibre library looked up at Open Library (5.17a): one request is 8
   * books, about 11 catalogue requests. The burst holds a whole library of
   * 500 books (63 requests); after it, 12 a minute is ~130 catalogue requests
   * a minute for one reader — so a second library at once waits instead of
   * taking Open Library from everyone else. The page waits and goes on by itself.
   */
  wallsCalibre: { capacity: 64, refillPerMinute: 12 },
  /**
   * The analytics' signals from the browser (ROADMAP 3.1b): one per page a
   * reader leaves. Generous for a reader, tight for someone feeding numbers.
   */
  seen: { capacity: 60, refillPerMinute: 60 },
  /**
   * "The books that inspired me" (ROADMAP 5.18b): the lists, a book's editions
   * (two to four Open Library requests when nobody asked before) and a board's
   * link. A reader building a board asks a few dozen times.
   */
  inspiration: { capacity: 60, refillPerMinute: 30 },
  /**
   * A poster or a link card: nine covers fetched and one picture drawn, the
   * heaviest thing this feature does. The CDN keeps the answer, so a reader
   * needs one per format and board.
   */
  inspirationPoster: { capacity: 12, refillPerMinute: 6 },
  /**
   * A browser's CSP violation report (ROADMAP 2.12): a page with a broken
   * rule sends one per blocked resource, so a reader needs a handful; a
   * script feeding reports fills the log for nothing.
   */
  csp: { capacity: 20, refillPerMinute: 10 },
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
