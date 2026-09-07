/**
 * What a reader clicked on their way to a shop (SPEC §10 C9). Server-side only.
 *
 * The order of the retailers under a cover is the only lever we hold
 * ourselves, and without numbers it is a guess. This records the click and
 * nothing about the person who made it: provider, market, ISBN, link kind,
 * time. No IP, no cookie, no user agent, no referrer, no identifier of any
 * kind — there is nothing to pseudonymise because nothing personal is
 * collected, which is also the sentence that can go into the privacy notice.
 *
 * This is the one place in `lib/` that writes to stdout without a DEBUG
 * guard, and it is deliberate: the line is the product's telemetry, not
 * debugging. Vercel keeps it in the platform log. That is enough to see
 * *that* links are used; answering "which retailer earns" needs a store, and
 * the plan for that is in docs/plans/PLAN-B.md under the analytics page.
 */
import type { Market } from './market';

export interface ClickEvent {
  provider: string;
  market: Market;
  isbn13: string;
  /** Does the target open one book's page or a list of results? */
  kind: 'product' | 'search';
}

/** Writes one structured line. Never throws: a click must not fail on logging. */
export function recordClick(event: ClickEvent): void {
  try {
    console.info(`bb.click ${JSON.stringify({ ...event, at: new Date().toISOString() })}`);
  } catch {
    // A log line is not worth breaking a redirect over.
  }
}
