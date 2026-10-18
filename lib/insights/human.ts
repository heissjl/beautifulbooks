/**
 * Can this request be a person? (ROADMAP 3.1i, 2026-10-18.) Pure.
 *
 * On 16–18 October the scraper of 2.18f ran with a real browser: ten old
 * user agents in rotation (Chrome 118–120, Firefox 120/121, Edge 119/120) and
 * `Lightpanda/1.0` clicked `/go/` 406 times on the 17th and sent the beacon
 * to `/api/seen` 974 times, from hundreds of residential addresses, while real
 * browsers clicked four times in three days. Both counters took every request
 * for a reader, and K1 and K16 said so for a month.
 *
 * Two things tell a person from that script, and neither is a list of bots:
 *
 * - **What the browser says about the request.** A click on a link sends
 *   `Sec-Fetch-Mode: navigate` and `Sec-Fetch-User: ?1` (the `?1` only for a
 *   user-activated navigation); a `fetch` from a script, a `curl`, or a page
 *   loaded by a headless driver does not. A beacon from one of this site's own
 *   pages sends `Sec-Fetch-Site: same-origin`; a script posting to the API
 *   sends none, `none` or `cross-site`. Every current Chrome, Firefox, Edge
 *   and Safari since 16.4 sends these headers.
 * - **How old the browser claims to be.** Chrome, Edge and Firefox release a
 *   major every four weeks and update themselves, so a major from two years
 *   ago on a live request is not a person's browser but a user-agent string
 *   somebody copied. The threshold is derived from the date (the first major
 *   of the previous calendar year, estimated from one anchor release per
 *   family at a conservative twelve a year), so nothing here needs maintaining
 *   as the years pass: Chrome 118 falls out of the window in late 2026 by
 *   itself. Safari gets one year more, because its major is the year's OS
 *   version and a phone keeps it until its owner updates; a browser this code
 *   does not recognise passes, so an unknown real browser is never thrown out.
 * - `HeadlessChrome` and `Lightpanda` name themselves, and are never a person.
 *
 * The rule reads two or three headers of one request and keeps none of them;
 * what the store gets is the reason, a class, as one number per day.
 */
import type { HeaderBag } from '../ownpage';

export type GuardRoute = 'go' | 'seen';

/** Why a request was not counted; a class, never anything about the request. */
export const REJECTIONS = ['headless', 'old-browser', 'not-a-click', 'not-own-page'] as const;
export type Rejection = (typeof REJECTIONS)[number];

export type Verdict = { human: true } | { human: false; reason: Rejection };

const HEADLESS = /HeadlessChrome|Lightpanda/i;

/**
 * One anchor per fast-release family: a major and the day it reached stable.
 * Both families ship about thirteen majors a year; twelve is assumed, so the
 * estimate errs towards letting a real browser through.
 */
const ANCHORS = {
  chrome: { major: 120, date: Date.UTC(2023, 11, 5) },
  firefox: { major: 121, date: Date.UTC(2023, 11, 19) },
} as const;
const MAJORS_PER_YEAR = 12;
const YEAR_MS = 365.25 * 86_400_000;

/** The lowest major of `family` that can have been released in the previous calendar year. */
export function oldestCurrentMajor(family: keyof typeof ANCHORS, now: Date): number {
  const anchor = ANCHORS[family];
  const startOfPreviousYear = Date.UTC(now.getUTCFullYear() - 1, 0, 1);
  const years = (startOfPreviousYear - anchor.date) / YEAR_MS;
  return anchor.major + Math.floor(years * MAJORS_PER_YEAR);
}

export type BrowserAge = 'current' | 'old' | 'unknown';

/**
 * Is the browser named in `ua` from this year or the last? Only a plain
 * Chrome, Edge, Firefox or Safari string is judged — one that ends the way
 * those browsers end theirs. A Chromium browser that adds its own token
 * (Samsung Internet, Opera, Yandex, …) carries a Chrome number that lags the
 * browser's own age, so it is `unknown` and passes.
 */
export function browserAge(ua: string, now: Date): BrowserAge {
  const s = ua.trim();
  if (!s) return 'unknown';
  // Chrome and Edge on Android, Windows, macOS, Linux: "… (KHTML, like Gecko) Chrome/131.0.0.0 [Mobile ]Safari/537.36[ Edg/131.0.0.0]".
  // Nothing may stand between the engine and the Chrome token: Samsung Internet puts its own name there.
  const chrome = /\(KHTML, like Gecko\) Chrome\/(\d+)[\d.]* (?:Mobile )?Safari\/537\.36(?: Edg[A]?\/\d+[\d.]*)?$/.exec(s);
  // Chrome and Edge on iOS carry WebKit's Safari token; their own number tracks the desktop release.
  const ios = /\b(?:CriOS|EdgiOS)\/(\d+)/.exec(s);
  const firefox = /\bFirefox\/(\d+)[\d.]*$/.exec(s) ?? /\bFxiOS\/(\d+)/.exec(s);
  if (chrome || ios) {
    const major = Number((chrome ?? ios)![1]);
    return major >= oldestCurrentMajor('chrome', now) ? 'current' : 'old';
  }
  if (firefox) return Number(firefox[1]) >= oldestCurrentMajor('firefox', now) ? 'current' : 'old';
  // Safari: "… Version/18.7 [Mobile/15E148 ]Safari/604.1" and no other browser's token.
  const safari = /\bVersion\/(\d+)[\d.]* (?:Mobile\/\w+ )?Safari\/[\d.]+$/.exec(s);
  if (safari) {
    const major = Number(safari[1]);
    // Safari 15 was 2021, 16 2022, 17 2023, 18 2024; from 26 on (2025) the major is the year.
    const year = major >= 26 ? 2000 + major : 2006 + major;
    return year >= now.getUTCFullYear() - 2 ? 'current' : 'old';
  }
  return 'unknown';
}

const header = (headers: HeaderBag, name: string) => (headers.get(name) ?? '').trim().toLowerCase();

/**
 * Whether the request can be a person's, for the route it came to. The
 * redirect of `/go/` and the 204 of `/api/seen` do not depend on the answer;
 * only the count does.
 */
export function humanRequest(headers: HeaderBag, route: GuardRoute, now: Date = new Date()): Verdict {
  const ua = headers.get('user-agent') ?? '';
  if (HEADLESS.test(ua)) return { human: false, reason: 'headless' };
  if (browserAge(ua, now) === 'old') return { human: false, reason: 'old-browser' };
  if (route === 'go') {
    const click = header(headers, 'sec-fetch-mode') === 'navigate' && header(headers, 'sec-fetch-user') === '?1';
    return click ? { human: true } : { human: false, reason: 'not-a-click' };
  }
  return header(headers, 'sec-fetch-site') === 'same-origin' ? { human: true } : { human: false, reason: 'not-own-page' };
}
