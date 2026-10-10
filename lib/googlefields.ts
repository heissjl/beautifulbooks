/**
 * Google Books' field search answering nothing (ROADMAP 1.13). Server-side only.
 *
 * Found 2026-10-09: with the site's key, every query that uses a field
 * operator — `isbn:`, `intitle:`, `inauthor:` — answers `totalItems: 0`
 * without an error, for ISBNs Google plainly holds, while the same words
 * without an operator answer hundreds of items. The cause is on Google's
 * side and unknown here; it was the same with and without `country=`, with
 * the colon encoded or not, and still so in the evening. Both of the site's
 * Google calls use operators, so without this module every verdict fell to
 * `unknown` ("no publisher's image") — a failure reported as a finding (N12)
 * — and the Open Library fallback of 1.12 never started, because Google had
 * formally answered.
 *
 * So an empty answer is not believed on its own. When a field query comes
 * back empty, two canary ISBNs that Google certainly lists are asked the same
 * way; if both come back empty too, the field search is held broken for an
 * hour and the callers treat Google as not asked — the ISBN lookup returns
 * `null`, which sends the verdict down the catalogue path of 1.12. One
 * canary alone would not do: the day Google really dropped it, the breaker
 * would open on a fact. The check costs at most two requests an hour while
 * broken and two a day while fine, against a quota of 1,000.
 *
 * The asking is injected, so this module stays pure and testable; the
 * Google client provides it.
 */

/** Two printings Google Books has listed for years: Harper Perennial's *To Kill a Mockingbird* (2006) and Scholastic's *Harry Potter and the Sorcerer's Stone* (1999). */
export const CANARY_ISBNS = ['9780061120084', '9780439708180'] as const;

/** How long a broken field search is believed broken before a canary is asked again. */
export const FIELD_BROKEN_MS = 60 * 60 * 1000;
/** How long a working canary answer is trusted before an empty answer triggers it again. */
export const FIELD_OK_MS = 24 * 60 * 60 * 1000;

let brokenUntil = 0;
let okUntil = 0;
let checking: Promise<boolean> | null = null;

/** Is the field search known to be broken right now? Costs nothing. */
export function fieldSearchKnownBroken(now = Date.now()): boolean {
  return now < brokenUntil;
}

/**
 * A field query answered nothing: is that Google's answer or Google's fault?
 * `countFor` asks Google how many items it lists for an ISBN, by `isbn:`.
 * Concurrent callers share one check.
 */
export function fieldSearchBroken(countFor: (isbn13: string) => Promise<number>, now = Date.now()): Promise<boolean> {
  if (now < brokenUntil) return Promise.resolve(true);
  if (now < okUntil) return Promise.resolve(false);
  if (!checking) {
    checking = (async () => {
      try {
        for (const isbn of CANARY_ISBNS) {
          if ((await countFor(isbn)) > 0) {
            okUntil = now + FIELD_OK_MS;
            return false;
          }
        }
        brokenUntil = now + FIELD_BROKEN_MS;
        logFieldEvent(now);
        return true;
      } catch {
        // A canary that fails is no evidence either way; the caller keeps the empty answer.
        return false;
      } finally {
        checking = null;
      }
    })();
  }
  return checking;
}

/**
 * One ungated line when the breaker opens, as `lib/googlequota.ts` writes
 * one: operation's telemetry, not debugging, so it is visible in the Vercel log.
 */
function logFieldEvent(now: number): void {
  try {
    console.warn(`bb.google ${JSON.stringify({
      event: 'field-search-empty',
      pausedForS: Math.round(FIELD_BROKEN_MS / 1000),
      until: new Date(now + FIELD_BROKEN_MS).toISOString(),
      at: new Date(now).toISOString(),
    })}`);
  } catch {
    // A log line is not worth breaking a page over.
  }
}

/** For tests. */
export function resetGoogleFields(): void {
  brokenUntil = 0;
  okUntil = 0;
  checking = null;
}
