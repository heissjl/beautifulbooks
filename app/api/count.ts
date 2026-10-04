import { after } from 'next/server';
import { takeDailyStops } from '@/lib/googlequota';
import { countOp } from '@/lib/insights/store';
import type { Op } from '@/lib/insights/model';

/**
 * Adds to the analytics after the response has left (ROADMAP 3.1a): the
 * reader never waits on Redis, and a silent store costs a number, not a page.
 */
export function countOpAfter(op: Op): void {
  later(async () => {
    await countOp(op);
  });
}

/**
 * `after` outside a request (a test calling a handler directly) throws; a
 * number is never worth a failed response, so it is skipped there.
 */
export function later(task: () => Promise<unknown>): void {
  try {
    after(task);
  } catch {
    // No request scope: nothing to count against.
  }
}

/**
 * Hands the Google daily stops this instance noted (lib/googlequota.ts) to the
 * analytics. Called by the routes that can spend a Google request; a stop
 * noted while rendering a page waits for the next such request on the same
 * instance.
 */
export function countGoogleStopsAfter(): void {
  later(async () => {
    const stops = takeDailyStops();
    for (let i = 0; i < stops; i++) await countOp('google-stop');
  });
}
