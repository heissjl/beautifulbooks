/**
 * Does a retailer's link for this ISBN lead anywhere? (SPEC §9.3 step 16.)
 * Server-side only.
 *
 * There is no clean way to ask this. Measured against the live shops on
 * 2026-09-07 with one real ISBN and one that cannot exist:
 *
 * - eBay, ThriftBooks, Blackwell's and Bookshop UK refuse a request from a
 *   server outright (403, 406).
 * - Amazon .com answers every request with a bot check; .de and .co.uk
 *   sometimes answer properly and sometimes do not.
 * - Hugendubel and genialokal answer, but render their results in the
 *   browser: the HTML is byte-identical for a real ISBN and an invented one,
 *   so it carries no information.
 * - Bookshop US, Thalia, AbeBooks and Amazon UK/DE answer, and their pages
 *   differ substantially in size between a hit and the control.
 *
 * So the check compares the shop's answer for this ISBN with its answer for
 * a control ISBN that no publisher can have been assigned. A clearly larger
 * page means the shop found something; the same size means its results are
 * not in the HTML at all. **This is never a stock check**, and the wording
 * shown to the reader must not imply one.
 */
import { debug } from './debug';
import { buyLinksFor } from './buylinks';
import { DEFAULT_MARKET, type Market } from './market';

/** A syntactically valid ISBN-13 that no publisher can have been assigned. */
export const CONTROL_ISBN = '9780000000019';

export type ShopStatus =
  /** The page is much bigger than for the control: the shop found something. */
  | 'listed'
  /** Same size as the control: the shop shows nothing, or renders in the browser. */
  | 'nothing'
  /** The shop refuses automated requests, or answered with a bot check. */
  | 'blocked'
  /** Timeout, network error, or an unexpected status. */
  | 'error';

export interface ShopCheck {
  provider: string;
  label: string;
  status: ShopStatus;
}

export interface AvailabilityOptions {
  /** Stop waiting for slow shops after this long. */
  deadlineMs?: number;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
}

const DEFAULT_DEADLINE_MS = 9000;
const DEFAULT_TIMEOUT_MS = 8000;
/** The control answer changes only when a shop changes its template. */
const CONTROL_REVALIDATE = 24 * 60 * 60;
const ANSWER_REVALIDATE = 6 * 60 * 60;
/** Below this difference the two pages are the same template with no results. */
const SAME_PAGE_RATIO = 0.02;
const SAME_PAGE_BYTES = 512;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

interface Answer {
  bytes: number;
  blocked: boolean;
}

async function ask(url: string, timeoutMs: number, revalidate: number): Promise<Answer | null> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9,de;q=0.8' },
      next: { revalidate },
    });
    if (res.status === 403 || res.status === 406 || res.status === 429) return { bytes: 0, blocked: true };
    if (!res.ok) return null;
    const body = await res.text();
    const low = body.toLowerCase();
    const blocked = low.includes('captcha') || low.includes('automated access') || low.includes('are you a robot');
    return { bytes: body.length, blocked };
  } catch (err) {
    debug('availability', `${url} failed: ${(err as Error).message}`);
    return null;
  }
}

/** Compares a shop's answer for the ISBN with its answer for the control. */
export function classify(answer: Answer | null, control: Answer | null): ShopStatus {
  if (!answer) return 'error';
  if (answer.blocked) return 'blocked';
  if (!control || control.blocked) return 'error';
  const difference = Math.abs(answer.bytes - control.bytes);
  const threshold = Math.max(SAME_PAGE_BYTES, control.bytes * SAME_PAGE_RATIO);
  return difference > threshold ? 'listed' : 'nothing';
}

/**
 * Checks every retailer of a market for one ISBN. Never throws: a shop that
 * does not answer is reported as such, which is the honest result.
 */
export async function checkAvailability(
  isbn13: string,
  market: Market = DEFAULT_MARKET,
  options: AvailabilityOptions = {},
): Promise<ShopCheck[]> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + (options.deadlineMs ?? DEFAULT_DEADLINE_MS);
  const env = options.env ?? process.env;

  const links = buyLinksFor({ isbn13 }, market, env);
  const controls = buyLinksFor({ isbn13: CONTROL_ISBN }, market, env);
  const controlByProvider = new Map(controls.map(l => [l.provider, l.url]));

  return Promise.all(
    links.map(async (link): Promise<ShopCheck> => {
      if (Date.now() > deadline) return { provider: link.provider, label: link.label, status: 'error' };
      const controlUrl = controlByProvider.get(link.provider);
      const [answer, control] = await Promise.all([
        ask(link.url, timeoutMs, ANSWER_REVALIDATE),
        controlUrl ? ask(controlUrl, timeoutMs, CONTROL_REVALIDATE) : Promise.resolve(null),
      ]);
      return { provider: link.provider, label: link.label, status: classify(answer, control) };
    }),
  );
}
