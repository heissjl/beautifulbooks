/**
 * The daily heartbeat mail (ROADMAP 2.18g, red team B1). Pure.
 *
 * Vercel keeps logs for an hour and the alerts mail only for two events, so a
 * site that broke quietly at night was found the next time someone looked.
 * One mail a morning with yesterday's three numbers turns silence into a
 * signal: **no mail means the cron, the store or the mail itself failed**, and
 * a mail with zeros where there are usually numbers means readers saw a broken
 * page. Nothing about any reader is in it — totals only.
 */
import { SITE_NAME } from './seo';
import type { AlertMail } from './alerts';

export interface HeartbeatFacts {
  /** Yesterday, `YYYY-MM-DD` (UTC). */
  day: string;
  /** Book-page visits yesterday, or null when the store could not be read. */
  bookVisits: number | null;
  /** Shop clicks yesterday, or null when the store could not be read. */
  shopClicks: number | null;
  /** The store's answer time for one GET now, or null when silent. */
  redisMs: number | null;
  /** Seconds the Google breaker still stays shut; 0 when open. */
  googlePausedS: number;
  googleFieldsBroken: boolean;
}

export function heartbeatMail(f: HeartbeatFacts): AlertMail {
  const n = (v: number | null) => (v === null ? 'could not be read' : String(v));
  const google = f.googlePausedS > 0 ? `paused for ${f.googlePausedS} s` : f.googleFieldsBroken ? 'its field search answers nothing (1.13)' : 'answering';
  const store = f.redisMs === null ? 'did not answer' : `answered in ${f.redisMs} ms`;
  const trouble = f.redisMs === null || f.bookVisits === null;
  return {
    subject: `${SITE_NAME} ${f.day}: ${n(f.bookVisits)} book visits, ${n(f.shopClicks)} shop clicks${trouble ? ' — something is off' : ''}`,
    text: [
      `Yesterday (${f.day}, UTC):`,
      `  book-page visits: ${n(f.bookVisits)}`,
      `  shop clicks: ${n(f.shopClicks)}`,
      '',
      `Now: the store ${store}; Google is ${google}.`,
      '',
      'This mail comes every morning. If one does not come, the cron, the store or the mail failed — look at /api/health and the Vercel log within the hour.',
    ].join('\n'),
  };
}
