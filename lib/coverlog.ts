/**
 * What the other side answered when a cover did not arrive (ROADMAP 6.25).
 * Server-side only.
 *
 * Julian, 2026-09-09: „es bleiben einfach oft kacheln leer … vielleicht werden
 * wir von der openlibrary api absichtlich abgefangen?" The question cannot be
 * answered from here, because `/img` swallowed the upstream status: every
 * failure came back as a 502 and the log said nothing about whether Open
 * Library refused us, took too long, or was never asked.
 *
 * This records **only failures**, and only what the failure was: the cover, the
 * size, what came back, and how long it took. Nothing about the reader — no
 * IP, no cookie, no user agent, no referrer — the same rule `lib/clicks.ts`
 * follows, and the same reason it may write to stdout without a DEBUG guard:
 * this is the product's telemetry, not debugging.
 *
 * Successes are not logged. A wall is three hundred images; a line each would
 * bury the twenty that matter.
 */

export interface CoverFailure {
  /** `ol:12345` or `gb:abc`, as the route rebuilt it. */
  coverId: string;
  size: 'S' | 'M' | 'L';
  /**
   * What happened, in the words the question needs:
   * a number is the upstream's HTTP status, `timeout` is our 15 s running out,
   * `network` is a connection that never answered, and `not-an-image` is a
   * 200 whose body was something else — an error page, usually.
   */
  reason: number | 'timeout' | 'network' | 'not-an-image';
  /** Milliseconds spent before giving up. */
  ms: number;
}

/** Writes one structured line. Never throws: a missing cover is bad enough. */
export function recordCoverFailure(failure: CoverFailure): void {
  try {
    console.warn(`bb.cover ${JSON.stringify({ ...failure, at: new Date().toISOString() })}`);
  } catch {
    // A log line is not worth breaking a response over.
  }
}

/** The header that carries the same answer to whoever is measuring in a browser. */
export const COVER_UPSTREAM_HEADER = 'X-Cover-Upstream';
