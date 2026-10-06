/**
 * Purchase and search links (SPEC §2.4, §8.3, §8.5, decision E9).
 *
 * Two tiers, both generated at display time and never stored:
 *
 * - Buy links need an ISBN and depend on the market: retailer list, order,
 *   Amazon domain and affiliate tag differ per market. Print books' Amazon
 *   ASIN is the ISBN-10, so Amazon gets a direct product link.
 * - Search links work without an ISBN and exist for every edition: title +
 *   publisher + year searches at antiquarian and auction sites, reverse
 *   image search with the cover, and library catalogues as provenance.
 *
 * Affiliate parameters come from environment variables per market. Without
 * them the neutral link is produced so the site works before any program
 * is approved. In hobby mode (SPEC E20) they are ignored even when set: the
 * public site promises that no link earns anything, and a promise that
 * depends on nobody having typed a variable is not one.
 */
import type { BuyLink, Edition } from './model';
import { DEFAULT_MARKET, type Market } from './market';
import { isbn13to10, searchablePublisher } from './normalize';
import { commerceEnabled } from './sitemode';

type Env = Record<string, string | undefined>;

interface Retailer {
  id: string;
  label: string;
  /** Environment variable holding the affiliate id/tag for this market. */
  affiliateEnv?: string;
  url: (isbn13: string, affiliate: string | undefined) => string;
  /**
   * Whether the URL lands on one book's page or on a list of results.
   * Defaults to a search, which is what most retailers give for an ISBN.
   */
  kind?: (isbn13: string, affiliate: string | undefined) => BuyLink['kind'];
  /**
   * The same shop searched by words instead of by number (ROADMAP 1.11
   * lever 5). Only defined where the retailer's own ISBN endpoint above
   * already takes free text, so no URL shape is invented here: Blackwell's
   * has product URLs only, and Booklooker's `isbn=` path segment has no
   * confirmed `titel=` sibling. Those two are simply absent (ROADMAP 1.8).
   */
  searchUrl?: (terms: string, affiliate: string | undefined) => string;
}

const enc = encodeURIComponent;

const withTag = (url: string, key: string, value: string | undefined) =>
  value ? `${url}${url.includes('?') ? '&' : '?'}${key}=${encodeURIComponent(value)}` : url;

/** Amazon: /dp/<ISBN-10> product page; 979-ISBNs have no ISBN-10 and fall back to a books-only search. */
function amazon(domain: string, affiliateEnv: string): Retailer {
  return {
    id: 'amazon',
    label: 'Amazon',
    affiliateEnv,
    url: (isbn, tag) => {
      const isbn10 = isbn13to10(isbn);
      const base = isbn10 ? `https://www.amazon.${domain}/dp/${isbn10}` : `https://www.amazon.${domain}/s?k=${isbn}&i=stripbooks`;
      return withTag(base, 'tag', tag);
    },
    // 979-prefixed ISBNs have no ISBN-10, so those fall back to a search.
    kind: isbn => (isbn13to10(isbn) ? 'product' : 'search'),
    searchUrl: (terms, tag) => withTag(`https://www.amazon.${domain}/s?k=${enc(terms)}&i=stripbooks`, 'tag', tag),
  };
}

/*
  In Germany the same marketplace is ZVAB (Julian, 2026-09-28): AbeBooks owns
  it, it answers the same `/servlet/SearchResults` fields, and it is the name
  German readers know. The id stays `abebooks` so the link plan, `/go` and the
  click log treat it as the one shop it is; only host and label change.
*/
const ABEBOOKS_HOST: Record<Market, { host: string; label: string }> = {
  us: { host: 'www.abebooks.com', label: 'AbeBooks' },
  uk: { host: 'www.abebooks.co.uk', label: 'AbeBooks' },
  de: { host: 'www.zvab.com', label: 'ZVAB' },
};

function abebooks(market: Market): Retailer {
  const { host, label } = ABEBOOKS_HOST[market];
  return {
    id: 'abebooks',
    label,
    url: isbn => `https://${host}/servlet/SearchResults?isbn=${isbn}`,
  };
}

const RETAILERS: Record<Market, Retailer[]> = {
  us: [
    {
      id: 'bookshop',
      label: 'Bookshop.org',
      affiliateEnv: 'AFFILIATE_BOOKSHOP_ID_US',
      url: (isbn, aff) => (aff ? `https://bookshop.org/a/${aff}/${isbn}` : `https://bookshop.org/search?keywords=${isbn}`),
      kind: (_isbn, aff) => (aff ? 'product' : 'search'),
      // No tag: the affiliate form we know is `/a/<id>/<isbn>`, which needs an
      // ISBN. A search that earns is open work in 4.1, not something to guess.
      searchUrl: terms => `https://bookshop.org/search?keywords=${enc(terms)}`,
    },
    amazon('com', 'AFFILIATE_AMAZON_TAG_US'),
    abebooks('us'),
    {
      id: 'thriftbooks', label: 'ThriftBooks',
      url: isbn => `https://www.thriftbooks.com/browse/?b.search=${isbn}`,
      searchUrl: terms => `https://www.thriftbooks.com/browse/?b.search=${enc(terms)}`,
    },
    {
      id: 'ebay', label: 'eBay',
      url: isbn => `https://www.ebay.com/sch/i.html?_nkw=${isbn}&_sacat=267`,
      searchUrl: terms => `https://www.ebay.com/sch/i.html?_nkw=${enc(terms)}&_sacat=267`,
    },
  ],
  uk: [
    {
      id: 'bookshop',
      label: 'Bookshop.org',
      affiliateEnv: 'AFFILIATE_BOOKSHOP_ID_UK',
      url: (isbn, aff) => (aff ? `https://uk.bookshop.org/a/${aff}/${isbn}` : `https://uk.bookshop.org/search?keywords=${isbn}`),
      kind: (_isbn, aff) => (aff ? 'product' : 'search'),
      searchUrl: terms => `https://uk.bookshop.org/search?keywords=${enc(terms)}`,
    },
    amazon('co.uk', 'AFFILIATE_AMAZON_TAG_UK'),
    { id: 'blackwells', label: "Blackwell's", url: isbn => `https://blackwells.co.uk/bookshop/product/${isbn}`, kind: () => 'product' },
    {
      id: 'waterstones', label: 'Waterstones',
      url: isbn => `https://www.waterstones.com/books/search/term/${isbn}`,
      searchUrl: terms => `https://www.waterstones.com/books/search/term/${enc(terms)}`,
    },
    abebooks('uk'),
    {
      id: 'ebay', label: 'eBay',
      url: isbn => `https://www.ebay.co.uk/sch/i.html?_nkw=${isbn}&_sacat=267`,
      searchUrl: terms => `https://www.ebay.co.uk/sch/i.html?_nkw=${enc(terms)}&_sacat=267`,
    },
  ],
  de: [
    {
      id: 'thalia', label: 'Thalia',
      url: isbn => `https://www.thalia.de/suche?sq=${isbn}`,
      searchUrl: terms => `https://www.thalia.de/suche?sq=${enc(terms)}`,
    },
    {
      id: 'genialokal', label: 'genialokal',
      url: isbn => `https://www.genialokal.de/Suche/?q=${isbn}`,
      searchUrl: terms => `https://www.genialokal.de/Suche/?q=${enc(terms)}`,
    },
    amazon('de', 'AFFILIATE_AMAZON_TAG_DE'),
    {
      id: 'hugendubel', label: 'Hugendubel',
      url: isbn => `https://www.hugendubel.de/de/search?q=${isbn}`,
      searchUrl: terms => `https://www.hugendubel.de/de/search?q=${enc(terms)}`,
    },
    abebooks('de'),
    { id: 'booklooker', label: 'Booklooker', url: isbn => `https://www.booklooker.de/B%C3%BCcher/Angebote/isbn=${isbn}` },
    /*
      abebooks.de beside ZVAB (Julian, 2026-09-28: „zvab bei deutschem markt
      priorisieren, aber abe books auch zeigen unter weitere"). ZVAB shows a
      subset of the same marketplace — measured on one ISBN, 117 offers against
      139, the missing ones nearly all from sellers abroad — so ZVAB leads and
      AbeBooks follows behind the fold for the reader who wants those too.
    */
    { id: 'abebooks-de', label: 'AbeBooks', url: isbn => `https://www.abebooks.de/servlet/SearchResults?isbn=${isbn}` },
  ],
};

/**
 * Shops that can be asked two different things about one printing in this
 * market: their ISBN field, and title/author/publisher/year.
 *
 * Read off the table rather than listed by hand, so a shop that gains a
 * search form joins by itself. AbeBooks has no `searchUrl` — its search is
 * the fielded one built in `searchLinksFor` — and is added here.
 */
export function twoQuestionShops(market: Market = DEFAULT_MARKET): ReadonlySet<string> {
  const ids = RETAILERS[market].filter(r => r.searchUrl).map(r => r.id);
  const withIsbnLink = new Set(RETAILERS[market].map(r => r.id));
  return new Set([...ids, ...(withIsbnLink.has('abebooks') ? ['abebooks'] : [])]);
}

export function retailersFor(market: Market): ReadonlyArray<Pick<Retailer, 'id' | 'label'>> {
  return RETAILERS[market];
}

/**
 * Providers in this market that run a programme we could join (Phase 4).
 *
 * It says nothing about whether a link *currently* earns anything — in hobby
 * mode none do (E20). It answers one question only: is there a shop here that
 * could ever pay for a link to *this* ISBN? Julian's rule on 2026-09-09: if
 * there is, that link takes precedence and the "read it in another edition"
 * row is not offered at all.
 */
export function earningProviders(market: Market): ReadonlySet<string> {
  return new Set(RETAILERS[market].filter(r => r.affiliateEnv).map(r => r.id));
}

/**
 * The shops whose links carry an affiliate parameter right now, by label and
 * without repeats across markets — what the privacy notice names as the places
 * a click may leave a cookie (ROADMAP 4.13 step 5). Empty in hobby mode, where
 * no link carries one (E20), and empty for a programme whose variable is unset,
 * so the notice never names a partner the links do not use.
 */
export function affiliateShops(env: Env = process.env, commerce: boolean = commerceEnabled()): string[] {
  if (!commerce) return [];
  const labels: string[] = [];
  for (const market of Object.keys(RETAILERS) as Market[]) {
    for (const r of RETAILERS[market]) {
      if (r.affiliateEnv && env[r.affiliateEnv] && !labels.includes(r.label)) labels.push(r.label);
    }
  }
  return labels;
}

/**
 * The same shops searched by words instead of by number (ROADMAP 1.11
 * lever 5) — the row that answers "I just want to read the book".
 *
 * Only the retailers whose ISBN endpoint already takes free text appear; see
 * `Retailer.searchUrl`. The provider ids carry a `-title` suffix so they can
 * never be confused with the ISBN links, which are the ones that go through
 * the counting redirect (a search has no ISBN to count against).
 */
export function titleSearchLinksFor(
  terms: { title: string; author?: string },
  market: Market = DEFAULT_MARKET,
  env: Env = process.env,
): BuyLink[] {
  const query = [terms.title, terms.author].filter(Boolean).join(' ');
  if (!query.trim()) return [];
  const commerce = commerceEnabled(env.NEXT_PUBLIC_SITE_MODE);
  return RETAILERS[market].flatMap(r => {
    if (!r.searchUrl) return [];
    const affiliate = commerce && r.affiliateEnv ? env[r.affiliateEnv] || undefined : undefined;
    return [{ provider: `${r.id}-title`, label: r.label, url: r.searchUrl(query, affiliate), kind: 'search' as const, ...(affiliate ? { affiliate: true } : {}) }];
  });
}

/** Buy links for an edition in a market. Empty without an ISBN. */
export function buyLinksFor(edition: Pick<Edition, 'isbn13'>, market: Market = DEFAULT_MARKET, env: Env = process.env): BuyLink[] {
  if (!edition.isbn13) return [];
  const isbn13 = edition.isbn13;
  // The mode is read from the same env so a test can set both at once.
  const commerce = commerceEnabled(env.NEXT_PUBLIC_SITE_MODE);
  return RETAILERS[market].map(r => {
    const affiliate = commerce && r.affiliateEnv ? env[r.affiliateEnv] || undefined : undefined;
    return {
      provider: r.id,
      label: r.label,
      url: r.url(isbn13, affiliate),
      kind: r.kind ? r.kind(isbn13, affiliate) : 'search',
      ...(affiliate ? { affiliate: true } : {}),
    };
  });
}

/**
 * The sentence under the shop links in shop mode (ROADMAP 4.11, prepared for
 * the day E20 switches to `shop`).
 *
 * Read off the links actually shown, not off the mode: a market without a
 * programme, or a printing whose only links are searches without an id,
 * earns nothing and must not say it does. Amazon's operating agreement asks
 * for its own sentence in so many words, so that one is added verbatim
 * whenever an Amazon link carries a tag (docs/vergleich-whichedition.md).
 * The order clause is true because the order follows the ISBN (SPEC 2.4).
 */
export const COMMISSION_NOTE = 'Some of these links earn this site a small commission if you buy through them, at no cost to you. It does not change their order.';
export const AMAZON_ASSOCIATE_NOTE = 'As an Amazon Associate I earn from qualifying purchases.';

export function commissionNote(links: ReadonlyArray<Pick<BuyLink, 'provider' | 'affiliate'>>): string | undefined {
  const earning = links.filter(l => l.affiliate);
  if (earning.length === 0) return undefined;
  const amazon = earning.some(l => l.provider.replace(/-(title|search)$/, '') === 'amazon');
  return amazon ? `${COMMISSION_NOTE} ${AMAZON_ASSOCIATE_NOTE}` : COMMISSION_NOTE;
}

/**
 * The link a reader actually clicks: our own redirect, which counts the click
 * and forwards to the shop (SPEC §10 C9, `app/go/[provider]/[isbn]`).
 *
 * The shop URL itself never travels through it; the redirect rebuilds the
 * target from the table above, so this cannot become an open redirect.
 */
export function trackedBuyHref(provider: string, isbn13: string, market: Market): string {
  return `/go/${encodeURIComponent(provider)}/${encodeURIComponent(isbn13)}?market=${market}`;
}

export interface SearchLinkInput {
  title: string;
  publisher?: string;
  year?: number;
  /** Primary author, improves title searches. */
  author?: string;
  /** Cover image URL for reverse image search. */
  coverUrl?: string;
  /** Open Library edition id (`ol:OL123M`) for the provenance link. */
  editionId?: string;
  /**
   * The printing's ISBN. When there is one, WorldCat is asked for that number
   * (`bn:`) rather than for title, publisher and year, which lists every
   * printing a library holds (ROADMAP 6.83).
   */
  isbn13?: string;
}

/**
 * Publisher and year for a title search — only when a catalogue record of a
 * printed edition vouches for them (ROADMAP 6.35, E21).
 *
 * On 2026-09-11 the blue *Infinite Jest* came from a Google band filed as
 * "Hachette UK · 2011": the e-book's metadata. AbeBooks, asked for title,
 * author, that publisher and that year, found nothing; without the publisher
 * it found 270 copies, the blue one among them under Little, Brown 2006
 * ([Testbericht M10]). A search that is too narrow is a dead end; one that is
 * a little wide is a list. So a Google band, and an e-book record, search by
 * title and author alone.
 */
export function searchFacts(edition: Pick<Edition, 'source' | 'format' | 'publisher' | 'year'>): { publisher?: string; year?: number } {
  if (edition.source !== 'openlibrary' || edition.format === 'ebook') return {};
  return { publisher: edition.publisher, year: edition.year };
}

const EBAY_DOMAIN: Record<Market, string> = { us: 'com', uk: 'co.uk', de: 'de' };

/**
 * Search links that work for every edition, ISBN or not (SPEC §8.5):
 * antiquarian and auction searches by title/publisher/year, reverse image
 * search with the cover, and catalogue provenance. Pure; safe on the client.
 */
export function searchLinksFor(input: SearchLinkInput, market: Market = DEFAULT_MARKET): BuyLink[] {
  const q = (s: string) => encodeURIComponent(s);
  /*
    The publisher is asked in the form a shop can answer, not in the form the
    catalogue stores it (`searchablePublisher`, ROADMAP 1.11). "Penguin Books,
    Limited" finds nothing where "Penguin Books" finds the book, and
    "Independently Published" — 40 % of the publisher mentions measured on
    2026-09-10 — buries every real result under a platform's catalogue.

    **Only the question is trimmed.** What the sidebar prints above these
    links is still the name Open Library holds; nothing here rewrites the
    record.
  */
  const publisher = searchablePublisher(input.publisher);
  const terms = [input.title, input.author, publisher, input.year ? String(input.year) : undefined].filter(Boolean).join(' ');
  const out: BuyLink[] = [];

  const abe = new URLSearchParams({ tn: input.title });
  if (input.author) abe.set('an', input.author);
  if (publisher) abe.set('pn', publisher);
  if (input.year) { abe.set('yrl', String(input.year)); abe.set('yrh', String(input.year)); }
  out.push({ provider: 'abebooks-search', label: ABEBOOKS_HOST[market].label, url: `https://${ABEBOOKS_HOST[market].host}/servlet/SearchResults?${abe}` });

  out.push({ provider: 'ebay-search', label: 'eBay', url: `https://www.ebay.${EBAY_DOMAIN[market]}/sch/i.html?_nkw=${q(terms)}&_sacat=267` });
  if (market === 'de') out.push({ provider: 'abebooks-de-search', label: 'AbeBooks', url: `https://www.abebooks.de/servlet/SearchResults?${abe}` });

  /*
    Every shop with a search form is asked about *this printing* too, not only
    about the work (Julian, 2026-09-10). Their `searchUrl` existed all along
    and was used only for the "another edition" row, which asks a different
    question — title and author, the work — so a foreign printing left the
    market's own shops with nothing to answer at all: their ISBN link is
    withdrawn there, and nothing took its place.

    No affiliate tag: these are built on the client, where the ids are not
    available. `titleSearchLinksFor` sets one where there is one.
  */
  for (const r of RETAILERS[market]) {
    if (!r.searchUrl || out.some(l => l.provider === `${r.id}-search`)) continue;
    out.push({ provider: `${r.id}-search`, label: r.label, url: r.searchUrl(terms, undefined), kind: 'search' });
  }

  if (input.coverUrl) {
    out.push({ provider: 'google-lens', label: 'Google Lens', url: `https://lens.google.com/uploadbyurl?url=${q(input.coverUrl)}` });
    out.push({ provider: 'tineye', label: 'TinEye', url: `https://tineye.com/search?url=${q(input.coverUrl)}` });
  }

  out.push({ provider: 'worldcat', label: 'WorldCat', url: `https://search.worldcat.org/search?q=${input.isbn13 ? `bn:${input.isbn13}` : q(terms)}` });
  if (input.editionId?.startsWith('ol:')) {
    out.push({ provider: 'openlibrary', label: 'Open Library', url: `https://openlibrary.org/books/${input.editionId.slice(3)}` });
  }
  return out;
}

/**
 * Shop searches by words rather than by number (ROADMAP 3.1, plan §4):
 * `-search` asks a shop about *this printing* by title, author, publisher and
 * year; `-title` asks about the work, any edition. Recognised by the suffix
 * the two builders above give them. Google Lens, TinEye, WorldCat and Open
 * Library are not shops and never go through the counting redirect.
 */
export function isWordsProvider(provider: string): boolean {
  return /^[a-z0-9-]+-(search|title)$/.test(provider);
}

export interface WordsQuery {
  title: string;
  author?: string;
  /** As the catalogue holds it; `searchLinksFor` trims it for the shop itself. */
  publisher?: string;
  year?: number;
}

/** Longest text a counted search carries; a title longer than this is not one a shop would find anyway. */
const MAX_WORDS = 300;

/**
 * The counted form of a shop search: `/go/<provider>/title?t=…&a=…&p=…&y=…`.
 *
 * Only the words travel, never an address. The redirect rebuilds the shop's
 * URL from this file's table, so whatever someone types into `t` ends up as a
 * search term at that shop and never as the place the reader is sent — the
 * route cannot become an open redirect (CLAUDE.md).
 */
export function trackedSearchHref(provider: string, query: WordsQuery, market: Market): string {
  const params = new URLSearchParams({ t: query.title });
  if (query.author) params.set('a', query.author);
  if (provider.endsWith('-search')) {
    if (query.publisher) params.set('p', query.publisher);
    if (query.year) params.set('y', String(query.year));
  }
  params.set('market', market);
  return `/go/${encodeURIComponent(provider)}/title?${params}`;
}

function clipWords(value: string | null): string | undefined {
  // Control characters out: they have no place in a search and would only travel into a log line.
  const text = value?.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_WORDS);
  return text || undefined;
}

/** The words of a counted search, or null when there is no title to search for. */
export function parseWordsQuery(params: URLSearchParams): WordsQuery | null {
  const title = clipWords(params.get('t'));
  if (!title) return null;
  const year = params.get('y');
  return {
    title,
    author: clipWords(params.get('a')),
    publisher: clipWords(params.get('p')),
    ...(year && /^\d{3,4}$/.test(year) ? { year: Number(year) } : {}),
  };
}

/**
 * The shop search a counted link stands for, rebuilt from the table exactly as
 * the page built it: `-title` links with the market's affiliate id where shop
 * mode sets one (`titleSearchLinksFor`), `-search` links without
 * (`searchLinksFor`). Undefined for anything that is not a shop search here.
 */
export function wordsLinkFor(provider: string, query: WordsQuery, market: Market, env: Env = process.env): BuyLink | undefined {
  if (!isWordsProvider(provider)) return undefined;
  if (provider.endsWith('-title')) {
    return titleSearchLinksFor({ title: query.title, author: query.author }, market, env).find(l => l.provider === provider);
  }
  return searchLinksFor({ title: query.title, author: query.author, publisher: query.publisher, year: query.year }, market)
    .find(l => l.provider === provider);
}
