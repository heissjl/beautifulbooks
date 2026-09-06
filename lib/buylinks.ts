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
 * is approved.
 */
import type { BuyLink, Edition } from './model';
import { DEFAULT_MARKET, type Market } from './market';
import { isbn13to10 } from './normalize';

type Env = Record<string, string | undefined>;

interface Retailer {
  id: string;
  label: string;
  /** Environment variable holding the affiliate id/tag for this market. */
  affiliateEnv?: string;
  url: (isbn13: string, affiliate: string | undefined) => string;
}

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
  };
}

function abebooks(domain: string): Retailer {
  return {
    id: 'abebooks',
    label: 'AbeBooks',
    url: isbn => `https://www.abebooks.${domain}/servlet/SearchResults?isbn=${isbn}`,
  };
}

const RETAILERS: Record<Market, Retailer[]> = {
  us: [
    {
      id: 'bookshop',
      label: 'Bookshop.org',
      affiliateEnv: 'AFFILIATE_BOOKSHOP_ID_US',
      url: (isbn, aff) => (aff ? `https://bookshop.org/a/${aff}/${isbn}` : `https://bookshop.org/search?keywords=${isbn}`),
    },
    amazon('com', 'AFFILIATE_AMAZON_TAG_US'),
    abebooks('com'),
    { id: 'thriftbooks', label: 'ThriftBooks', url: isbn => `https://www.thriftbooks.com/browse/?b.search=${isbn}` },
    { id: 'ebay', label: 'eBay', url: isbn => `https://www.ebay.com/sch/i.html?_nkw=${isbn}&_sacat=267` },
  ],
  uk: [
    {
      id: 'bookshop',
      label: 'Bookshop.org',
      affiliateEnv: 'AFFILIATE_BOOKSHOP_ID_UK',
      url: (isbn, aff) => (aff ? `https://uk.bookshop.org/a/${aff}/${isbn}` : `https://uk.bookshop.org/search?keywords=${isbn}`),
    },
    amazon('co.uk', 'AFFILIATE_AMAZON_TAG_UK'),
    { id: 'blackwells', label: "Blackwell's", url: isbn => `https://blackwells.co.uk/bookshop/product/${isbn}` },
    { id: 'waterstones', label: 'Waterstones', url: isbn => `https://www.waterstones.com/books/search/term/${isbn}` },
    abebooks('co.uk'),
    { id: 'ebay', label: 'eBay', url: isbn => `https://www.ebay.co.uk/sch/i.html?_nkw=${isbn}&_sacat=267` },
  ],
  de: [
    { id: 'thalia', label: 'Thalia', url: isbn => `https://www.thalia.de/suche?sq=${isbn}` },
    { id: 'genialokal', label: 'genialokal', url: isbn => `https://www.genialokal.de/Suche/?q=${isbn}` },
    amazon('de', 'AFFILIATE_AMAZON_TAG_DE'),
    { id: 'hugendubel', label: 'Hugendubel', url: isbn => `https://www.hugendubel.de/de/search?searchString=${isbn}` },
    abebooks('de'),
    { id: 'booklooker', label: 'Booklooker', url: isbn => `https://www.booklooker.de/B%C3%BCcher/Angebote/isbn=${isbn}` },
  ],
};

export function retailersFor(market: Market): ReadonlyArray<Pick<Retailer, 'id' | 'label'>> {
  return RETAILERS[market];
}

/** Buy links for an edition in a market. Empty without an ISBN. */
export function buyLinksFor(edition: Pick<Edition, 'isbn13'>, market: Market = DEFAULT_MARKET, env: Env = process.env): BuyLink[] {
  if (!edition.isbn13) return [];
  return RETAILERS[market].map(r => ({
    provider: r.id,
    label: r.label,
    url: r.url(edition.isbn13!, r.affiliateEnv ? env[r.affiliateEnv] || undefined : undefined),
  }));
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
}

const ABEBOOKS_DOMAIN: Record<Market, string> = { us: 'com', uk: 'co.uk', de: 'de' };
const EBAY_DOMAIN: Record<Market, string> = { us: 'com', uk: 'co.uk', de: 'de' };

/**
 * Search links that work for every edition, ISBN or not (SPEC §8.5):
 * antiquarian and auction searches by title/publisher/year, reverse image
 * search with the cover, and catalogue provenance. Pure; safe on the client.
 */
export function searchLinksFor(input: SearchLinkInput, market: Market = DEFAULT_MARKET): BuyLink[] {
  const q = (s: string) => encodeURIComponent(s);
  const terms = [input.title, input.author, input.publisher, input.year ? String(input.year) : undefined].filter(Boolean).join(' ');
  const out: BuyLink[] = [];

  const abe = new URLSearchParams({ tn: input.title });
  if (input.author) abe.set('an', input.author);
  if (input.publisher) abe.set('pn', input.publisher);
  if (input.year) { abe.set('yrl', String(input.year)); abe.set('yrh', String(input.year)); }
  out.push({ provider: 'abebooks-search', label: 'AbeBooks', url: `https://www.abebooks.${ABEBOOKS_DOMAIN[market]}/servlet/SearchResults?${abe}` });

  out.push({ provider: 'ebay-search', label: 'eBay', url: `https://www.ebay.${EBAY_DOMAIN[market]}/sch/i.html?_nkw=${q(terms)}&_sacat=267` });

  if (input.coverUrl) {
    out.push({ provider: 'google-lens', label: 'Google Lens', url: `https://lens.google.com/uploadbyurl?url=${q(input.coverUrl)}` });
    out.push({ provider: 'tineye', label: 'TinEye', url: `https://tineye.com/search?url=${q(input.coverUrl)}` });
  }

  out.push({ provider: 'worldcat', label: 'WorldCat', url: `https://search.worldcat.org/search?q=${q(terms)}` });
  if (input.editionId?.startsWith('ol:')) {
    out.push({ provider: 'openlibrary', label: 'Open Library', url: `https://openlibrary.org/books/${input.editionId.slice(3)}` });
  }
  return out;
}
