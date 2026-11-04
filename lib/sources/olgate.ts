/**
 * Spares Open Library when the site is busy (ROADMAP 2.18e, PLAN-2.18 §4).
 * Server-side only; per instance, like the rate buckets — it bounds what one
 * instance asks, not what the site asks.
 *
 * Two parts:
 *
 * - **At most four requests in flight** to `openlibrary.org` (covers are a
 *   different host and not counted). A request waits for a slot inside its own
 *   timeout; whatever it waited is taken off the time it then has, so a reader
 *   never waits longer than before, only differently.
 * - **A pause after a refusal.** Open Library blocks an address that asks too
 *   much (umgang §1: ECONNREFUSED from this Mac after a bulk run; 403/429 are
 *   its other ways of saying so). Asking again only lengthens the block, so
 *   after one refusal the instance does not ask for `BUSY_PAUSE_MS` and says
 *   "The catalogue is busy" instead — never "No books found" (N12). Cached
 *   answers keep coming from the CDN (`stale-if-error`) and ISR pages; what
 *   the pause withholds is the data cache inside the function, a price paid
 *   for not having to know whether a request would leave the machine
 *   (the same reasoning as `lib/googlequota.ts`).
 *
 * Timeouts and 5xx are silence, not refusal: they leave the pause shut.
 */

/** Requests to openlibrary.org at once, per instance. */
export const MAX_IN_FLIGHT = 4;

/** How long an instance stays quiet after a refusal: inside the plan's 60–120 s. */
export const BUSY_PAUSE_MS = 90_000;

/** Open Library turned a request away a moment ago; this one was not sent. */
export class CatalogueBusyError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`openlibrary is turning requests away; not asking for ${Math.ceil(retryAfterMs / 1000)} s`);
    this.name = 'CatalogueBusyError';
  }
}

let inFlight = 0;
const waiting: Array<() => void> = [];
let busyUntil = 0;

/** Milliseconds left in the pause, 0 when the catalogue may be asked. */
export function catalogueBusyFor(now = Date.now()): number {
  return Math.max(0, busyUntil - now);
}

/**
 * Opens the pause. One ungated `bb.ol` line per opening, so the log shows
 * that it happened (the breaker in `lib/googlequota.ts` does the same).
 */
export function tripCatalogue(reason: string, now = Date.now()): void {
  const wasOpen = busyUntil > now;
  busyUntil = now + BUSY_PAUSE_MS;
  if (!wasOpen) console.warn(`bb.ol ${JSON.stringify({ event: 'busy', reason, pauseS: BUSY_PAUSE_MS / 1000, at: new Date(now).toISOString() })}`);
}

/** Waits for a slot no longer than `ms`; false when the time ran out. */
function acquire(ms: number): Promise<boolean> {
  if (inFlight < MAX_IN_FLIGHT) {
    inFlight++;
    return Promise.resolve(true);
  }
  return new Promise(resolve => {
    const grant = () => {
      clearTimeout(timer);
      inFlight++;
      resolve(true);
    };
    const timer = setTimeout(() => {
      const i = waiting.indexOf(grant);
      if (i >= 0) waiting.splice(i, 1);
      resolve(false);
    }, ms);
    waiting.push(grant);
  });
}

function release(): void {
  inFlight--;
  waiting.shift()?.();
}

/** A wait for a slot that outlasted the request's own timeout reads as a timeout. */
function slotTimeout(): Error {
  const err = new Error('no free slot for openlibrary.org within the timeout');
  err.name = 'TimeoutError';
  return err;
}

/**
 * Runs one request to openlibrary.org through the gate. `run` gets the
 * milliseconds left after waiting for a slot; `isRefusal` says whether its
 * failure was Open Library turning us away.
 */
export async function throughCatalogueGate<T>(
  timeoutMs: number,
  run: (remainingMs: number) => Promise<T>,
  isRefusal: (err: unknown) => string | undefined,
): Promise<T> {
  const busy = catalogueBusyFor();
  if (busy > 0) throw new CatalogueBusyError(busy);
  const started = Date.now();
  if (!(await acquire(timeoutMs))) throw slotTimeout();
  try {
    // The pause may have opened while this one waited.
    const stillBusy = catalogueBusyFor();
    if (stillBusy > 0) throw new CatalogueBusyError(stillBusy);
    return await run(Math.max(1, timeoutMs - (Date.now() - started)));
  } catch (err) {
    const reason = isRefusal(err);
    if (reason) tripCatalogue(reason);
    throw err;
  } finally {
    release();
  }
}

/** Whether a failure, however wrapped, was the gate saying the catalogue is busy. */
export function isCatalogueBusy(err: unknown): boolean {
  return err instanceof CatalogueBusyError
    || (err instanceof Error && 'cause' in err && err.cause instanceof CatalogueBusyError);
}

/** For tests: an empty gate and no pause. */
export function resetCatalogueGate(): void {
  inFlight = 0;
  waiting.length = 0;
  busyUntil = 0;
}
