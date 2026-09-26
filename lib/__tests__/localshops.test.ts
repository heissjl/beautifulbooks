import { describe, expect, it } from 'vitest';
import { defaultLocalCountry, isLocalCountry, LOCAL_COUNTRIES, LOCAL_SHOPS_COPY, localShopLinks } from '../localshops';
import { MARKETS } from '../market';

const ISBN = '9782070360024';

describe('localShopLinks (5.12)', () => {
  it('builds the confirmed ISBN links for Germany and France', () => {
    expect(localShopLinks('de', { isbn13: ISBN })).toEqual([
      expect.objectContaining({ id: 'genialokal', kind: 'book', url: `https://www.genialokal.de/Suche/?q=${ISBN}` }),
    ]);
    expect(localShopLinks('fr', { isbn13: ISBN })).toEqual([
      expect.objectContaining({ id: 'librairiesindependantes', kind: 'book', url: `https://www.librairiesindependantes.com/product/search/?query=${ISBN}` }),
    ]);
  });

  it('searches by title and author without an ISBN, where that shape is confirmed', () => {
    const [link] = localShopLinks('de', { title: 'Der Prozess', author: 'Franz Kafka' });
    expect(link.kind).toBe('book');
    expect(link.url).toBe('https://www.genialokal.de/Suche/?q=Der%20Prozess%20Franz%20Kafka');
  });

  it('falls back to the finder where a title search is not confirmed', () => {
    const [link] = localShopLinks('fr', { title: "L'Étranger", author: 'Albert Camus' });
    expect(link.kind).toBe('finder');
    expect(link.url).toBe('https://www.librairiesindependantes.com/');
    expect(link.id).toBe('librairiesindependantes-finder');
  });

  it('offers only finder links where no book URL is confirmed yet', () => {
    for (const country of ['at', 'ch', 'it', 'es', 'nl'] as const) {
      const links = localShopLinks(country, { isbn13: ISBN, title: 'x' });
      expect(links.length).toBeGreaterThan(0);
      expect(links.every(l => l.kind === 'finder')).toBe(true);
      // Never the ISBN in a URL whose shape nobody checked.
      expect(links.every(l => !l.url.includes(ISBN))).toBe(true);
    }
  });

  it('gives the UK and the US a finder plus Bookshop.org', () => {
    expect(localShopLinks('uk', { isbn13: ISBN }).map(l => [l.id, l.kind])).toEqual([['hive-finder', 'finder'], ['bookshop-uk', 'book']]);
    expect(localShopLinks('us', { isbn13: ISBN }).map(l => [l.id, l.kind])).toEqual([['indiebound-finder', 'finder'], ['bookshop', 'book']]);
  });

  it('uses https everywhere and never carries anything but the book', () => {
    for (const { id } of LOCAL_COUNTRIES) {
      for (const link of localShopLinks(id, { isbn13: ISBN, title: 'T', author: 'A' })) {
        expect(link.url.startsWith('https://')).toBe(true);
        expect(link.url).not.toMatch(/postcode|zip|plz|lat=|lon=/i);
      }
    }
  });
});

describe('countries', () => {
  it('lists nine countries by name and opens with the market', () => {
    expect(LOCAL_COUNTRIES.map(c => c.id)).toEqual(['at', 'fr', 'de', 'it', 'nl', 'es', 'ch', 'uk', 'us']);
    for (const m of MARKETS) expect(isLocalCountry(defaultLocalCountry(m.id))).toBe(true);
    expect(isLocalCountry('xx')).toBe(false);
    expect(isLocalCountry(undefined)).toBe(false);
  });
});

describe('wording', () => {
  it('never claims a shop has the book, or that the list is complete', () => {
    const texts = [
      ...Object.values(LOCAL_SHOPS_COPY),
      ...LOCAL_COUNTRIES.flatMap(c => localShopLinks(c.id, { isbn13: ISBN }).flatMap(l => [l.label, l.note])),
    ];
    for (const t of texts) {
      expect(t).not.toMatch(/\b(in stock|available|has it|have it|every|all|complete)\b/i);
    }
    expect(LOCAL_SHOPS_COPY.noStock).toMatch(/does not know/);
  });
});
