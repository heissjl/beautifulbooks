/**
 * What happened when a cover could not be fetched through `/img` (ROADMAP
 * 6.25). Server-side only.
 *
 * Since 1.3 every cover leaves from one server instead of from each reader's
 * own address, which is exactly the shape under which Open Library's
 * documented rate limits for covers would bite — and until 2026-09-10 the
 * route answered 502 without saying *why*, so the question "are we being
 * throttled?" could not be answered from the logs at all. This line answers
 * it: the upstream status, or the reason there was none.
 *
 * Like `lib/clicks.ts`, this writes without a DEBUG guard on purpose. It is
 * written only on failure, so a healthy wall costs no log lines, and it says
 * nothing about the reader: no IP, no user agent, no referrer — a cover id,
 * a size, a status and a duration.
 */
export interface CoverFailure {
  coverId: string;
  size: 'S' | 'M' | 'L';
  source: 'openlibrary' | 'googlebooks';
  /** The upstream HTTP status, when there was a response at all. */
  status: number | null;
  /** Why the image was not served. `status` means the upstream answered but not with 2xx. */
  reason: 'status' | 'not-image' | 'timeout' | 'error';
  /** Milliseconds from the request to the failure. */
  ms: number;
}

/** Writes one structured line. Never throws: a failing image must not fail twice. */
export function recordCoverFailure(failure: CoverFailure): void {
  try {
    console.info(`bb.img ${JSON.stringify({ ...failure, at: new Date().toISOString() })}`);
  } catch {
    // A log line is not worth breaking a response over.
  }
}

/** `429` and `403` from upstream are the two answers that would mean "you, specifically, are being refused". */
export function looksLikeThrottling(failure: Pick<CoverFailure, 'status'>): boolean {
  return failure.status === 429 || failure.status === 403;
}
