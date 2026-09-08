import { describe, expect, it } from 'vitest';
import { buyLinksFor, retailersFor, searchLinksFor } from '../buylinks';
import { cookieValue, detectMarket, normalizeMarket } from '../market';
import { isbn13to10 } from '../normalize';

describe('isbn13to10', () => {
  it('converts 978 ISBNs, including an X check digit', () => {
    expect(isbn13to10('9780684824772')).toBe('0684824779');
    expect(isbn13to10('9780141187761')).toBe('014118776X');
    expect(isbn13to10('9780804429573')).toBe('080442957X');
    expect(isbn13to10('0684824779')).toBe('0684824779');
  });
  it('has no ISBN-10 for 979 ISBNs or garbage', () => {
    expect(isbn13to10('9798472370790')).toBeUndefined();
    expect(isbn13to10('nope')).toBeUndefined();
  });
});

describe('detectMarket (E9)', () => {
  it('prefers the explicit choice, then country, then language, then US', () => {
    expect(detectMarket({ explicit: 'de', country: 'US', acceptLanguage: 'en-US' })).toBe('de');
    expect(detectMarket({ explicit: 'gb' })).toBe('uk');
    expect(detectMarket({ explicit: 'xx', country: 'AT' })).toBe('de');
    expect(detectMarket({ country: 'IE' })).toBe('uk');
    expect(detectMarket({ country: 'FR', acceptLanguage: 'de-DE,de;q=0.9' })).toBe('de');
    expect(detectMarket({ country: 'FR', acceptLanguage: 'en-GB,en;q=0.8' })).toBe('uk');
    expect(detectMarket({ country: 'FR', acceptLanguage: 'fr-FR' })).toBe('us');
    expect(detectMarket({})).toBe('us');
  });
  it('parses cookies and normalizes values', () => {
    expect(cookieValue('a=1; market=uk; b=2', 'market')).toBe('uk');
    expect(cookieValue(undefined, 'market')).toBeUndefined();
    expect(normalizeMarket(' UK ')).toBe('uk');
    expect(normalizeMarket('fr')).toBeUndefined();
  });
});

describe('buyLinksFor per market', () => {
  const isbn = { isbn13: '9780684824772' };
  const amazon = (market: 'us' | 'uk' | 'de', env: Record<string, string | undefined> = {}) =>
    buyLinksFor(isbn, market, env).find(l => l.provider === 'amazon')!.url;

  const shop = { NEXT_PUBLIC_SITE_MODE: 'shop' };

  it('links straight to the Amazon product page on the market domain, with the market tag in shop mode', () => {
    expect(amazon('us')).toBe('https://www.amazon.com/dp/0684824779');
    expect(amazon('uk')).toBe('https://www.amazon.co.uk/dp/0684824779');
    expect(amazon('de', { ...shop, AFFILIATE_AMAZON_TAG_DE: 'bb-21', AFFILIATE_AMAZON_TAG_US: 'wrong' })).toBe('https://www.amazon.de/dp/0684824779?tag=bb-21');
  });
  it('ignores affiliate variables in hobby mode, set or not (E20)', () => {
    const env = { AFFILIATE_AMAZON_TAG_DE: 'bb-21', AFFILIATE_BOOKSHOP_ID_US: 'shop1', AFFILIATE_BOOKSHOP_ID_UK: 'shop1' };
    for (const mode of [undefined, '', 'hobby']) {
      for (const market of ['us', 'uk', 'de'] as const) {
        for (const link of buyLinksFor(isbn, market, { ...env, NEXT_PUBLIC_SITE_MODE: mode })) {
          expect(link.url, `${market} ${link.provider}`).not.toMatch(/[?&]tag=|\/a\//);
        }
      }
    }
    expect(buyLinksFor(isbn, 'us', { ...env, NEXT_PUBLIC_SITE_MODE: 'shop' })[0].url).toContain('/a/shop1/');
  });
  it('falls back to a books-only search for 979 ISBNs', () => {
    expect(buyLinksFor({ isbn13: '9798472370790' }, 'us', {}).find(l => l.provider === 'amazon')!.url)
      .toBe('https://www.amazon.com/s?k=9798472370790&i=stripbooks');
  });
  it('orders retailers per market as specified', () => {
    expect(retailersFor('us').map(r => r.id)).toEqual(['bookshop', 'amazon', 'abebooks', 'thriftbooks', 'ebay']);
    expect(retailersFor('uk').map(r => r.id)).toEqual(['bookshop', 'amazon', 'blackwells', 'waterstones', 'abebooks', 'ebay']);
    expect(retailersFor('de').map(r => r.id)).toEqual(['thalia', 'genialokal', 'amazon', 'hugendubel', 'abebooks', 'booklooker']);
    expect(buyLinksFor(isbn, 'de', {}).map(l => l.provider)).toEqual(retailersFor('de').map(r => r.id));
  });
  it('uses the Bookshop affiliate storefront only when configured', () => {
    expect(buyLinksFor(isbn, 'uk', {})[0].url).toBe('https://uk.bookshop.org/search?keywords=9780684824772');
    expect(buyLinksFor(isbn, 'uk', { ...shop, AFFILIATE_BOOKSHOP_ID_UK: 'shop1' })[0].url).toBe('https://uk.bookshop.org/a/shop1/9780684824772');
  });
  it('returns no buy links without an ISBN', () => {
    expect(buyLinksFor({ isbn13: undefined })).toEqual([]);
  });
});

describe('searchLinksFor (no ISBN needed)', () => {
  it('always offers title searches, adds image search with a cover and provenance for OL editions', () => {
    const links = searchLinksFor({ title: 'Mumbo Jumbo', author: 'Ishmael Reed', publisher: 'Doubleday', year: 1972, coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg', editionId: 'ol:OL5468355M' }, 'us');
    expect(links.map(l => l.provider)).toEqual(['abebooks-search', 'ebay-search', 'google-lens', 'tineye', 'worldcat', 'openlibrary']);
    const abe = new URL(links[0].url);
    expect(abe.searchParams.get('tn')).toBe('Mumbo Jumbo');
    expect(abe.searchParams.get('pn')).toBe('Doubleday');
    expect(abe.searchParams.get('yrl')).toBe('1972');
    expect(links[2].url).toContain('lens.google.com/uploadbyurl?url=https%3A%2F%2Fcovers');
    expect(links[5].url).toBe('https://openlibrary.org/books/OL5468355M');
  });
  it('uses market domains and skips what it cannot build', () => {
    const links = searchLinksFor({ title: 'Stolz und Vorurteil' }, 'de');
    expect(links.map(l => l.provider)).toEqual(['abebooks-search', 'ebay-search', 'worldcat']);
    expect(links[0].url).toContain('abebooks.de');
    expect(links[1].url).toContain('ebay.de');
  });
});

describe('link kind (SPEC §9.3 step 16)', () => {
  it('marks the Amazon product page as a product and the 979 fallback as a search', () => {
    const [amazonUs] = buyLinksFor({ isbn13: '9780307388629' }, 'us', {}).filter(l => l.provider === 'amazon');
    expect(amazonUs).toMatchObject({ kind: 'product' });
    expect(amazonUs.url).toContain('/dp/030738862X');

    const [amazon979] = buyLinksFor({ isbn13: '9791234567896' }, 'us', {}).filter(l => l.provider === 'amazon');
    expect(amazon979).toMatchObject({ kind: 'search' });
  });

  it('marks Bookshop as a product only once an affiliate id makes it one', () => {
    const without = buyLinksFor({ isbn13: '9780307388629' }, 'us', {}).find(l => l.provider === 'bookshop');
    expect(without).toMatchObject({ kind: 'search' });
    const with_ = buyLinksFor({ isbn13: '9780307388629' }, 'us', { NEXT_PUBLIC_SITE_MODE: 'shop', AFFILIATE_BOOKSHOP_ID_US: '12345' }).find(l => l.provider === 'bookshop');
    expect(with_).toMatchObject({ kind: 'product' });
  });

  it('marks every ISBN search as a search', () => {
    const de = buyLinksFor({ isbn13: '9783499130656' }, 'de', {});
    const searches = de.filter(l => l.kind === 'search').map(l => l.provider);
    expect(searches).toEqual(['thalia', 'genialokal', 'hugendubel', 'abebooks', 'booklooker']);
  });
});
