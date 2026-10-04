/**
 * Shop searches by words through the counting redirect (ROADMAP 3.1, plan §4).
 *
 * Two promises, checked for every shop in every market: the redirect sends a
 * reader to exactly the URL the page would have linked to directly, and no
 * input can send them anywhere but that shop.
 */
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isWordsProvider, parseWordsQuery, searchLinksFor, titleSearchLinksFor, trackedSearchHref, wordsLinkFor, type WordsQuery } from '../buylinks';
import type { Market } from '../market';
import { LOCAL_COUNTRIES, localLinkFor, localShopLinks, trackedLocalHref } from '../localshops';
import { GET } from '@/app/go/[provider]/[isbn]/route';

const MARKETS: Market[] = ['us', 'uk', 'de'];

/** Titles a catalogue really holds, and a few nobody should. */
const QUERIES: WordsQuery[] = [
  { title: 'Nineteen Eighty-Four', author: 'George Orwell', publisher: 'Secker & Warburg', year: 1949 },
  { title: 'Die Blechtrommel', author: 'Günter Grass', publisher: 'Luchterhand', year: 1959 },
  { title: 'Ansichten eines Clowns', author: 'Heinrich Böll' },
  { title: 'Gödel, Escher, Bach: an Eternal Golden Braid', author: 'Douglas R. Hofstadter', publisher: 'Basic Books', year: 1979 },
  { title: 'L\'Étranger', author: 'Albert Camus', publisher: 'Gallimard', year: 1942 },
  { title: '1984 / Animal Farm', author: 'Orwell' },
  { title: '100% & "quotes" + plus #hash ?q=1', author: 'A/B' },
  { title: 'Война и мир', author: 'Лев Толстой' },
  { title: '吾輩は猫である', author: '夏目漱石' },
];

/** Inputs that try to be an address. They must end up as words at the shop. */
const ATTACKS = [
  'https://evil.example/login',
  '//evil.example',
  '\\\\evil.example',
  'javascript:alert(1)',
  'x\r\nLocation: https://evil.example',
  '@evil.example',
  '%2F%2Fevil.example',
];

function hrefParams(href: string): URLSearchParams {
  return new URL(href, 'https://buyitscovers.com').searchParams;
}

function shopLinks(query: WordsQuery, market: Market) {
  return [
    ...searchLinksFor(query, market).filter(l => isWordsProvider(l.provider)),
    ...titleSearchLinksFor({ title: query.title, author: query.author }, market),
  ];
}

describe('which links are shop searches', () => {
  it('takes every -search and -title shop, and no image search or catalogue', () => {
    const all = searchLinksFor({ title: 'Dune', author: 'Frank Herbert', coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg', editionId: 'ol:OL1M', isbn13: '9780441013593' }, 'us');
    const words = all.filter(l => isWordsProvider(l.provider)).map(l => l.provider);
    expect(words).toContain('abebooks-search');
    expect(words).toContain('ebay-search');
    expect(words).toContain('amazon-search');
    for (const other of ['google-lens', 'tineye', 'worldcat', 'openlibrary']) expect(isWordsProvider(other)).toBe(false);
  });
});

describe('the redirect rebuilds exactly the link the page shows', () => {
  for (const market of MARKETS) {
    it(`in market ${market}, for every shop and every title`, () => {
      let checked = 0;
      for (const query of QUERIES) {
        for (const link of shopLinks(query, market)) {
          const href = trackedSearchHref(link.provider, query, market);
          const parsed = parseWordsQuery(hrefParams(href));
          expect(parsed, href).not.toBeNull();
          const rebuilt = wordsLinkFor(link.provider, parsed as WordsQuery, market);
          expect(rebuilt?.url, `${link.provider} ${query.title}`).toBe(link.url);
          checked++;
        }
      }
      // Every market has at least five shop searches; a table change that drops them shows here.
      expect(checked).toBeGreaterThanOrEqual(QUERIES.length * 5);
    });
  }

  it('keeps the affiliate id on "another edition" links in shop mode, as the page does', () => {
    const env = { NEXT_PUBLIC_SITE_MODE: 'shop', AFFILIATE_AMAZON_TAG_US: 'bic-20' };
    const direct = titleSearchLinksFor({ title: 'Dune', author: 'Frank Herbert' }, 'us', env).find(l => l.provider === 'amazon-title');
    const rebuilt = wordsLinkFor('amazon-title', { title: 'Dune', author: 'Frank Herbert' }, 'us', env);
    expect(direct?.url).toContain('tag=bic-20');
    expect(rebuilt?.url).toBe(direct?.url);
  });
});

describe('no input sends a reader anywhere but the shop', () => {
  for (const market of MARKETS) {
    it(`in market ${market}`, () => {
      for (const attack of ATTACKS) {
        const query = { title: attack, author: attack, publisher: attack };
        for (const link of shopLinks({ title: 'Dune', author: 'Frank Herbert', publisher: 'Ace', year: 1990 }, market)) {
          const rebuilt = wordsLinkFor(link.provider, parseWordsQuery(hrefParams(trackedSearchHref(link.provider, query, market))) as WordsQuery, market);
          expect(rebuilt, link.provider).toBeDefined();
          const url = new URL(rebuilt!.url);
          expect(url.protocol).toBe('https:');
          expect(url.host, `${link.provider} with ${JSON.stringify(attack)}`).toBe(new URL(link.url).host);
          expect(rebuilt!.url).not.toMatch(/[\r\n]/);
        }
      }
    });
  }

  it('refuses an unknown shop, a non-shop and a missing title', () => {
    const q = { title: 'Dune' };
    expect(wordsLinkFor('evil-search', q, 'us')).toBeUndefined();
    expect(wordsLinkFor('google-lens', q, 'us')).toBeUndefined();
    expect(wordsLinkFor('worldcat', q, 'us')).toBeUndefined();
    expect(parseWordsQuery(new URLSearchParams('a=Herbert'))).toBeNull();
    expect(parseWordsQuery(new URLSearchParams('t=%20%20'))).toBeNull();
  });

  it('caps the words and drops a year that is not one', () => {
    const q = parseWordsQuery(new URLSearchParams({ t: 'x'.repeat(1000), y: '19x9' }));
    expect(q?.title).toHaveLength(300);
    expect(q?.year).toBeUndefined();
  });
});

describe('the route', () => {
  async function go(path: string): Promise<Response> {
    const url = new URL(path, 'https://buyitscovers.com');
    const [, , provider, isbn] = url.pathname.split('/');
    return GET(new NextRequest(url), { params: Promise.resolve({ provider: decodeURIComponent(provider), isbn }) });
  }

  it('redirects a shop search to the shop and does not let the response be cached', async () => {
    const query = { title: 'Ansichten eines Clowns', author: 'Heinrich Böll' };
    const direct = titleSearchLinksFor(query, 'de').find(l => l.provider === 'thalia-title');
    const res = await go(trackedSearchHref('thalia-title', query, 'de'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(direct?.url);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('sends anything it cannot rebuild home', async () => {
    for (const path of ['/go/evil-search/title?t=x&market=us', '/go/amazon-search/title?market=us', '/go/google-lens/title?t=x&market=us']) {
      const res = await go(path);
      expect(new URL(res.headers.get('location') ?? '').pathname, path).toBe('/');
    }
  });
});

describe('local bookshops through the counting redirect (ROADMAP 3.1, 5.12)', () => {
  const EDITIONS = [
    { isbn13: '9780141036144', title: 'Nineteen Eighty-Four', author: 'George Orwell' },
    { title: 'Ansichten eines Clowns', author: 'Heinrich Böll' },
    { title: 'L\'Étranger & "autres" 100%', author: 'Albert Camus' },
    {},
  ];

  it('rebuilds exactly the link the section shows, for every country and service', () => {
    let checked = 0;
    for (const { id: country } of LOCAL_COUNTRIES) {
      for (const edition of EDITIONS) {
        for (const link of localShopLinks(country, edition)) {
          const href = new URL(trackedLocalHref(country, link, edition, 'us'), 'https://buyitscovers.com');
          const target = decodeURIComponent(href.pathname.split('/')[3]);
          expect(localLinkFor(target, href.searchParams)?.url, `${country} ${link.id}`).toBe(link.url);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(LOCAL_COUNTRIES.length * EDITIONS.length);
  });

  it('never leaves the service, whatever the words say', () => {
    for (const { id: country } of LOCAL_COUNTRIES) {
      for (const attack of ATTACKS) {
        const edition = { title: attack, author: attack };
        for (const link of localShopLinks(country, edition)) {
          const href = new URL(trackedLocalHref(country, link, edition, 'de'), 'https://buyitscovers.com');
          const rebuilt = localLinkFor('title', href.searchParams);
          expect(new URL(rebuilt!.url).host, `${country} ${link.id}`).toBe(new URL(link.url).host);
        }
      }
    }
    expect(localLinkFor('title', new URLSearchParams('c=xx&id=hive'))).toBeUndefined();
    expect(localLinkFor('https://evil.example', new URLSearchParams('c=uk&id=hive'))).toBeUndefined();
    expect(localLinkFor('title', new URLSearchParams('c=uk&id=evil'))).toBeUndefined();
  });
});
