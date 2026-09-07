/**
 * Stops asking Google Books once Google says the day is spent
 * (SPEC §8.7 point 5). Server-side only.
 *
 * Read from the Cloud console on 2026-09-07: **1,000 queries per day**, of
 * which a day of development had already used 298. A search costs one and a
 * cold detail page two, so the ceiling is around 500 cold detail pages a day.
 * Running into that ceiling unchecked means every further request answers
 * with an error, for the rest of the day, on every page view.
 *
 * The plan called for a daily counter. A counter cannot be honest here: the
 * Next data cache serves the title search for an hour and the ISBN lookup for
 * a day, and nothing tells this code which of its calls actually left the
 * machine. Counting them all would throttle the site long before the real
 * limit — an expensive mistake in the wrong direction.
 *
 * So the trigger is Google's own answer. It is exact, it costs nothing, and
 * it distinguishes the day being over from a momentary rate limit. What it
 * must never do is mistake a misconfigured key for an exhausted quota: a 403
 * without a quota reason leaves the breaker shut, so a wrong key fails loudly
 * per request instead of silently disabling Google for a day.
 */
import { debug } from './debug';
import { HttpError } from './sources/http';

export type QuotaVerdict =
  /** The day's quota is gone; do not ask again until it resets. */
  | 'daily'
  /** Too many requests just now; a short pause is enough. */
  | 'rate'
  /** Not a quota problem at all. */
  | 'other';

/** Pause after a per-minute limit, well over the one-minute window. */
export const RATE_PAUSE_MS = 90_000;

/**
 * What kind of refusal is this? Google reports both an exhausted daily quota
 * and a bad API key as 403; only the body tells them apart.
 */
export function classifyQuotaError(error: unknown): QuotaVerdict {
  if (!(error instanceof HttpError)) return 'other';
  if (error.status !== 403 && error.status !== 429) return 'other';
  const body = error.body.toLowerCase();
  if (body.includes('dailylimitexceeded') || body.includes('quotaexceeded')) return 'daily';
  if (body.includes('ratelimitexceeded')) return 'rate';
  // A 429 with no reason we recognise is still too many requests, but it is
  // not evidence that the day is over.
  return error.status === 429 ? 'rate' : 'other';
}

/**
 * Milliseconds until Google's daily quota resets, which happens at midnight
 * Pacific time whatever the server's own clock says.
 *
 * A day on which Pacific time changes offset is 23 or 25 hours long, so this
 * can be an hour out twice a year. An hour of caution once every six months
 * is not worth a date library.
 */
export function pacificMsUntilReset(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  // Intl renders midnight as hour 24 in some runtimes.
  const hour = value('hour') % 24;
  const elapsed = ((hour * 60 + value('minute')) * 60 + value('second')) * 1000;
  return 24 * 60 * 60 * 1000 - elapsed;
}

/** When the breaker opens, in ms since the epoch; 0 while it is shut. */
let closedUntil = 0;

/** May we spend a Google request right now? */
export function googleAvailable(now = Date.now()): boolean {
  return now >= closedUntil;
}

/** How long the current pause still lasts, in seconds. 0 when open for business. */
export function googlePausedFor(now = Date.now()): number {
  return Math.max(0, Math.ceil((closedUntil - now) / 1000));
}

/**
 * Records a failed Google request. Returns what it made of it, so callers can
 * log or test it.
 */
export function noteGoogleFailure(error: unknown, now = Date.now()): QuotaVerdict {
  const verdict = classifyQuotaError(error);
  if (verdict === 'other') return verdict;
  const pause = verdict === 'daily' ? pacificMsUntilReset(new Date(now)) : RATE_PAUSE_MS;
  const until = now + pause;
  if (until > closedUntil) {
    closedUntil = until;
    debug('googlequota', `${verdict} limit reached, not asking again for ${Math.round(pause / 1000)}s`);
  }
  return verdict;
}

/** For tests. */
export function resetGoogleQuota(): void {
  closedUntil = 0;
}
