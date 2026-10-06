/**
 * The signals a browser sends when a reader leaves a page (ROADMAP 3.1b,
 * docs/plans/PLAN-3.1-analyse.md §4). Pure and client-safe: the page builds a
 * signal with these functions, the server checks it with the same ones.
 *
 * A signal summarises one visit in fixed classes, so the store can add it to
 * a daily total and nothing else: no identifier, no time of day, no free text
 * except the words of a search that found nothing (Julian, 2026-10-04: kept
 * 90 days, shown from two equal searches on).
 */
import type { Market } from '../market';

// `shelf`: a book page reached from a Shelf-Portrait (`/shelfportrait…`, ROADMAP 5.18b) — every cover on a shared board leads to one.
/** Pages of this site a visit can come from; `page` is any other page of it (about, create, …). */
export const INTERNAL_ORIGINS = ['home', 'search', 'collection', 'shelf', 'book', 'page'] as const;

/**
 * Where a visit can come from outside the site (ROADMAP 5.6a,
 * docs/plans/PLAN-5.5-5.6-kanaele.md §3): the platforms a launch or a pin
 * goes to have a class each, so a channel can be told apart from the rest of
 * `social`. `blog` and `mail` come only from a `?via=` mark; `site` is a tab
 * opened from another tab of this site.
 */
export const ENTRIES = [
  'engine', 'reddit', 'pinterest', 'hn', 'instagram', 'tiktok', 'bluesky', 'producthunt', 'blog', 'mail',
  'social', 'other', 'site', 'direct',
] as const;
export type Entry = (typeof ENTRIES)[number];

export const ORIGINS = [...INTERNAL_ORIGINS, ...ENTRIES] as const;
export type Origin = (typeof ORIGINS)[number];

/**
 * The values `?via=` may carry on a link we post ourselves (5.6a). A mark wins
 * over the referrer, which in-app browsers (Instagram, TikTok, often Reddit)
 * do not send. Anything else in `via` is ignored.
 */
export const VIA = ['pinterest', 'hn', 'reddit', 'producthunt', 'instagram', 'tiktok', 'bluesky', 'blog', 'mail'] as const satisfies readonly Entry[];

/** Pages whose leaving is summarised as a `landing` signal (5.6a); book pages and searches have their own. */
export const LANDINGS = ['home', 'search', 'collections', 'collection', 'wall'] as const;
export type Landing = (typeof LANDINGS)[number];

export const PAGES = ['0', '1', '2', '3', '4+'] as const;
export const SEEN = ['0-12', '13-40', '41-100', '101-250', '250+'] as const;
export const VERDICTS = [
  'none', 'verified', 'differs', 'uncompared', 'unknown', 'unavailable', 'pending',
  // Open Library stood in for Google (ROADMAP 1.12): how often the fallback is what readers see.
  'catalogueVerified', 'catalogueDiffers', 'catalogueUncompared', 'catalogueUnknown',
] as const;
export const OUTCOMES = ['results', 'empty', 'failed'] as const;
export const COUNTS = ['0', '1', '2-5', '6-20', '20+'] as const;
export const POSITIONS = ['1', '2', '3', '4-10', '11+', 'none'] as const;
export const MODES = ['title', 'author', 'isbn'] as const;

export interface BookSignal {
  t: 'book';
  work: string;
  from: Origin;
  market: Market;
  pages: (typeof PAGES)[number];
  seen: (typeof SEEN)[number];
  /** A cover was picked during the visit. */
  picked: boolean;
  /** The last verdict shown for a picked cover, or `none`. */
  verdict: (typeof VERDICTS)[number];
  /** At least one click to a shop (through `/go/`). */
  bought: boolean;
  /** At least one click on an image search or catalogue (Lens, TinEye, WorldCat, Open Library). */
  found: boolean;
  /** The channel the tab's visit began with (5.6a); `from` is only the page before. */
  entry: Entry;
}

export interface SearchSignal {
  t: 'search';
  outcome: (typeof OUTCOMES)[number];
  count: (typeof COUNTS)[number];
  clicked: (typeof POSITIONS)[number];
  mode: (typeof MODES)[number];
  /** Only when `outcome` is `empty`: the search, lower-cased, at most 80 characters. */
  q?: string;
}

/**
 * One visit to a page a reader can arrive on from outside (5.6a): which kind
 * of page, which channel the tab's visit began with, whether this was its
 * first page, and whether a book was opened from it. No collection or wall
 * id — a reader's wall would point at a person.
 */
export interface LandingSignal {
  t: 'landing';
  page: Landing;
  entry: Entry;
  first: boolean;
  opened: boolean;
}

export type Signal = BookSignal | SearchSignal | LandingSignal;

/** Largest body the receiver reads. */
export const MAX_SIGNAL_BYTES = 1024;
export const MAX_EMPTY_QUERY = 80;

export function pagesClass(pages: number): BookSignal['pages'] {
  return pages >= 4 ? '4+' : pages >= 3 ? '3' : pages >= 2 ? '2' : pages >= 1 ? '1' : '0';
}

export function seenClass(tiles: number): BookSignal['seen'] {
  if (tiles > 250) return '250+';
  if (tiles > 100) return '101-250';
  if (tiles > 40) return '41-100';
  if (tiles > 12) return '13-40';
  return '0-12';
}

export function countClass(results: number): SearchSignal['count'] {
  if (results > 20) return '20+';
  if (results > 5) return '6-20';
  if (results > 1) return '2-5';
  return results === 1 ? '1' : '0';
}

/** 1-based position of the card clicked, or null for none. */
export function positionClass(position: number | null): SearchSignal['clicked'] {
  if (position === null || position < 1) return 'none';
  if (position > 10) return '11+';
  if (position > 3) return '4-10';
  return String(position) as '1' | '2' | '3';
}

/** A search as it may be kept: lower case, single spaces, no control characters, clipped. */
export function emptyQuery(q: string): string | undefined {
  const text = q.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, MAX_EMPTY_QUERY);
  return text || undefined;
}

const ENGINES = /(^|\.)(google|bing|duckduckgo|ecosia|qwant|startpage|yahoo|yandex|baidu|brave|kagi|search\.yahoo)\./;
/** Platforms with a class of their own, tried in order; the rest of `SOCIAL` stays `social`. */
const PLATFORMS: Array<[Entry, RegExp]> = [
  ['reddit', /(^|\.)(reddit\.com|redd\.it)$/],
  ['pinterest', /(^|\.)(pinterest\.[a-z.]+|pin\.it)$/],
  ['hn', /(^|\.)news\.ycombinator\.com$/],
  ['instagram', /(^|\.)instagram\.com$/],
  ['tiktok', /(^|\.)tiktok\.com$/],
  ['bluesky', /(^|\.)(bsky\.app|bsky\.social)$/],
  ['producthunt', /(^|\.)producthunt\.com$/],
];
const SOCIAL = /(^|\.)(facebook|fb|instagram|t\.co|x\.com|twitter|reddit|pinterest|bsky|threads|linkedin|tiktok|youtube|whatsapp|telegram|mastodon|tumblr|discord)\b/;

/** Which part of this site a path is. */
function internalOrigin(path: string, search: string): Origin {
  if (path === '/' || path === '') {
    const p = new URLSearchParams(search);
    return p.get('q') || p.get('author') || p.get('key') ? 'search' : 'home';
  }
  if (path.startsWith('/collections') || path.startsWith('/c/')) return 'collection';
  if (path === '/shelfportrait' || path.startsWith('/shelfportrait/')) return 'shelf';
  if (path.startsWith('/book/')) return 'book';
  // Not `other`, which is an outside site: since 5.6a an outside class on a
  // book visit means the book was the tab's first page.
  return 'page';
}

/** The `?via=` mark of an address, or null when it has none or one not on the list. */
export function viaOf(search: string): Entry | null {
  const via = new URLSearchParams(search).get('via');
  return via && (VIA as readonly string[]).includes(via) ? (via as Entry) : null;
}

/** The class of an outside referrer; `site` when it is this site (a tab opened from another). */
function referrerClass(referrer: string, ownHost: string): Entry {
  if (!referrer) return 'direct';
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return 'other';
  }
  if (url.host === ownHost) return 'site';
  const host = url.host.toLowerCase();
  if (ENGINES.test(host)) return 'engine';
  for (const [entry, pattern] of PLATFORMS) if (pattern.test(host)) return entry;
  if (SOCIAL.test(host)) return 'social';
  return 'other';
}

/**
 * The channel a tab's visit began with: the `?via=` mark of its first page,
 * else the class of `document.referrer`. Computed once per tab in the browser;
 * neither the referrer nor the address is sent.
 */
export function entryOf(firstSearch: string, referrer: string, ownHost: string): Entry {
  return viaOf(firstSearch) ?? referrerClass(referrer, ownHost);
}

/**
 * Where a visit to a book page came from, as a class. Computed in the browser;
 * neither the referrer nor the previous address is sent (plan §4).
 *
 * `previous` is the last address inside this site the reader saw in this tab,
 * kept in memory by the page (a client-side navigation leaves
 * `document.referrer` unchanged); `referrer` is `document.referrer` for the
 * first page of a visit, and `search` that page's query, whose `?via=` mark
 * wins over the referrer (5.6a).
 */
export function originOf(previous: { path: string; search: string } | null, referrer: string, ownHost: string, search = ''): Origin {
  if (previous) return internalOrigin(previous.path, previous.search);
  const via = viaOf(search);
  if (via) return via;
  if (referrer) {
    try {
      const url = new URL(referrer);
      if (url.host === ownHost) return internalOrigin(url.pathname, url.search);
    } catch {
      return 'other';
    }
  }
  return referrerClass(referrer, ownHost);
}

/** The landing class of an address of this site, or null for a page that is not one. */
export function landingOf(path: string, search: string): Landing | null {
  if (path === '/' || path === '') return internalOrigin(path, search) === 'search' ? 'search' : 'home';
  if (path === '/collections' || path === '/collections/readers') return 'collections';
  if (/^\/collections\/[^/]+$/.test(path)) return 'collection';
  if (/^\/c\/[^/]+$/.test(path)) return 'wall';
  return null;
}

const WORK = /^OL\d{1,12}W$/;
const MARKETS: readonly string[] = ['us', 'uk', 'de'];

function oneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/**
 * The signal in a body, or null. Every field is checked against its list; a
 * body with anything else, or anything missing, is dropped whole — the
 * receiver never stores what it did not expect.
 */
export function parseSignal(body: unknown): Signal | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.t === 'book') {
    if (typeof b.work !== 'string' || !WORK.test(b.work)) return null;
    if (!oneOf(ORIGINS, b.from) || !oneOf(MARKETS, b.market) || !oneOf(PAGES, b.pages) || !oneOf(SEEN, b.seen) || !oneOf(VERDICTS, b.verdict)) return null;
    if (typeof b.picked !== 'boolean' || typeof b.bought !== 'boolean' || typeof b.found !== 'boolean' || !oneOf(ENTRIES, b.entry)) return null;
    return { t: 'book', work: b.work, from: b.from, market: b.market as Market, pages: b.pages, seen: b.seen, picked: b.picked, verdict: b.verdict, bought: b.bought, found: b.found, entry: b.entry };
  }
  if (b.t === 'landing') {
    if (!oneOf(LANDINGS, b.page) || !oneOf(ENTRIES, b.entry) || typeof b.first !== 'boolean' || typeof b.opened !== 'boolean') return null;
    return { t: 'landing', page: b.page, entry: b.entry, first: b.first, opened: b.opened };
  }
  if (b.t === 'search') {
    if (!oneOf(OUTCOMES, b.outcome) || !oneOf(COUNTS, b.count) || !oneOf(POSITIONS, b.clicked) || !oneOf(MODES, b.mode)) return null;
    const q = b.outcome === 'empty' && typeof b.q === 'string' ? emptyQuery(b.q) : undefined;
    return { t: 'search', outcome: b.outcome, count: b.count, clicked: b.clicked, mode: b.mode, ...(q ? { q } : {}) };
  }
  return null;
}

const flag = (v: boolean) => (v ? '1' : '0');

/** The field a book signal adds one to in the day's `book` hash. */
export function bookField(s: BookSignal): string {
  return `from=${s.from}|market=${s.market}|pages=${s.pages}|seen=${s.seen}|picked=${flag(s.picked)}|verdict=${s.verdict}|bought=${flag(s.bought)}|found=${flag(s.found)}|entry=${s.entry}`;
}

/** The field a landing signal adds one to in the day's `landing` hash (5.6a). */
export function landingField(s: LandingSignal): string {
  return `page=${s.page}|entry=${s.entry}|first=${flag(s.first)}|opened=${flag(s.opened)}`;
}

/** The field in the day's `works` hash: which work, and whether the visit went to a shop. */
export function workField(s: BookSignal): string {
  return `${s.work}|${flag(s.bought)}`;
}

export function searchField(s: SearchSignal): string {
  return `outcome=${s.outcome}|count=${s.count}|clicked=${s.clicked}|mode=${s.mode}`;
}

/** A field written by `bookField`, `searchField` or `landingField`, read back; null for anything else. */
export function readField(field: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const part of field.split('|')) {
    const i = part.indexOf('=');
    if (i <= 0) return null;
    out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}
