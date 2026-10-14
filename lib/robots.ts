/**
 * What crawlers may fetch (ROADMAP 2.18n). Pure; `app/robots.ts` serves it.
 *
 * Every Open Library work id is a book page here, rendered when first asked
 * for, with requests to the catalogue — a space without an end. Measured on
 * 2026-10-05: in two days ClaudeBot rendered 6,776 of 8,281 book pages and
 * fetched 31,657 of 44,438 images, walking from book to book through "More
 * by …"; that was most of the functions' computing time and thousands of
 * catalogue requests from the site's address, which Open Library answers by
 * closing the door.
 *
 * **Two named groups since 2026-10-14** (Julian, 2026-10-10: „mach c“; and
 * 2026-10-14, after a day of SERankingBacklinksBot rendering 2,044 book pages:
 * „ja, setz um“):
 *
 * - **Search crawlers** (`SEARCH_CRAWLERS`) — what AI search and answer
 *   services cite from: ChatGPT search, Perplexity, Claude, and Amazon's,
 *   Meta's and Keenable's indexers. They get the general rules, like
 *   Googlebot and bingbot, so the site can be found in their answers; only a
 *   crawl delay stays, because their walk through "More by …" reaches the
 *   same endless book space ClaudeBot rendered (Amzn-SearchBot: 5,955 book
 *   pages in the week to 2026-10-14).
 * - **Shut out** (`TRAINING_CRAWLERS`, `TOOL_CRAWLERS`) — crawlers that train
 *   models, and SEO and backlink tools that build databases for their paying
 *   customers. Neither brings a reader. `Google-Extended` and
 *   `Applebot-Extended` are the tokens by which Google and Apple ask about
 *   training; naming them changes nothing for their search crawlers.
 *
 * Until 2026-10-14 the tools were *bounded* (only the published works' pages)
 * instead of shut out; that group is gone.
 *
 * Search engines' own crawlers and the fetchers that read one page because a
 * person asked (Claude-User, ChatGPT-User, Perplexity-User) are on none of
 * the lists and keep the general rules — K14 in /admin/insights shows
 * whether that holds. A crawler that ignores robots.txt is not stopped by it;
 * that is the firewall's job (ROADMAP 2.4).
 */
export const SEARCH_CRAWLERS = [
  'OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot',
  'Amzn-SearchBot', 'meta-webindexer', 'KeenableBot',
] as const;

export const TRAINING_CRAWLERS = [
  'GPTBot', 'ClaudeBot', 'anthropic-ai', 'CCBot', 'Bytespider', 'Amazonbot', 'Meta-ExternalAgent',
  'Google-Extended', 'Applebot-Extended', 'Reflectionbot',
] as const;

export const TOOL_CRAWLERS = [
  'SERankingBacklinksBot', 'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'PetalBot', 'DataForSeoBot',
] as const;

/** Seconds between two requests, for the crawlers that honour it. */
export const CRAWL_DELAY = 10;

/** Closed to every crawler: the API, the click counter, Julian's pages. */
export const CLOSED_TO_ALL = ['/api/', '/go/', '/admin/'];

/**
 * The one address under `/api/` a link card names as its picture: the
 * Shelf-Portrait's poster (`og:image` of `/shelfportrait/<id>`). X's
 * Twitterbot honours robots.txt for the image too, and under `Disallow: /api/`
 * a shared Shelf-Portrait showed its title over an empty grey box (2026-10-06).
 * The other cards are `opengraph-image` files beside their pages and were never
 * closed. Open to `*` only: the named crawlers have no use for it.
 */
export const CARD_IMAGES = ['/api/inspiration/poster'];

export interface RobotsRule {
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
  crawlDelay?: number;
}

export function robotsRules(): RobotsRule[] {
  return [
    { userAgent: '*', allow: ['/', ...CARD_IMAGES], disallow: CLOSED_TO_ALL },
    // The general rules, and a pause between requests (see above).
    { userAgent: [...SEARCH_CRAWLERS], allow: '/', disallow: CLOSED_TO_ALL, crawlDelay: CRAWL_DELAY },
    { userAgent: [...TRAINING_CRAWLERS, ...TOOL_CRAWLERS], disallow: '/' },
  ];
}

const list = (value: string | string[] | undefined): string[] => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern).split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
}

/**
 * Whether a crawler may fetch a path under these rules, the way RFC 9309
 * reads them: the group that names the crawler (else `*`), the longest
 * matching rule, and allow on a tie. For the tests and for anyone asking
 * "would this be crawled".
 */
export function mayFetch(rules: readonly RobotsRule[], userAgent: string, path: string): boolean {
  const named = rules.find(rule => list(rule.userAgent).some(agent => agent !== '*' && agent.toLowerCase() === userAgent.toLowerCase()));
  const group = named ?? rules.find(rule => list(rule.userAgent).includes('*'));
  if (!group) return true;
  let best = { length: -1, allowed: true };
  for (const [patterns, allowed] of [[list(group.allow), true], [list(group.disallow), false]] as const) {
    for (const pattern of patterns) {
      if (!matches(pattern, path)) continue;
      if (pattern.length > best.length || (pattern.length === best.length && allowed)) best = { length: pattern.length, allowed };
    }
  }
  return best.allowed;
}
