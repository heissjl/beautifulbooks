import { describe, expect, it } from 'vitest';
import { buyLinksFor, searchLinksFor, titleSearchLinksFor } from '../buylinks';
import { linkPlan, orderEditionsForMarket, type LinkPlanInput } from '../linkplan';
import type { Market } from '../market';

/** No affiliate ids and no shop mode: the hobby site, which is what runs today (E20). */
const ENV = {};

const GATSBY = 'The Great Gatsby';

function plan(isbn13: string | undefined, market: Market, over: Partial<LinkPlanInput> = {}) {
  const edition = { isbn13 };
  return linkPlan({
    edition,
    buyLinks: buyLinksFor(edition, market, ENV),
    searchLinks: searchLinksFor({ title: 'Muhtesem Gatsby', author: 'F. Scott Fitzgerald', publisher: 'Everest', year: 2013, coverUrl: 'https://covers.example/1.jpg' }, market),
    anyEditionLinks: titleSearchLinksFor({ title: GATSBY, author: 'F. Scott Fitzgerald' }, market, ENV),
    market,
    ...over,
  });
}

// A Turkish, an English, a German and an Amazon-issued number.
const TR = '9789944886321';
const EN = '9780141036144';
const DE = '9783596219261';
const KDP = '9798575362159';

describe('linkPlan cases', () => {
  it('calls an English ISBN home in the US and foreign in Germany', () => {
    expect(plan(EN, 'us').case).toBe('home');
    expect(plan(EN, 'de').case).toBe('foreign');
    expect(plan(DE, 'de').case).toBe('home');
    expect(plan(DE, 'us').case).toBe('foreign');
  });

  it('reads the Turkish group and names it in the note', () => {
    const p = plan(TR, 'us');
    expect(p.case).toBe('foreign');
    expect(p.place).toBe('Turkey');
    expect(p.note).toContain('registered in Turkey');
  });

  it('keeps Amazon’s own range apart and says why the link is a search', () => {
    const p = plan(KDP, 'us');
    expect(p.case).toBe('kdp');
    expect(p.lead.map(l => l.label)).toEqual(['Amazon']);
    expect(p.note).toContain('no ISBN-10');
  });

  it('has a case for an edition without any ISBN', () => {
    const p = plan(undefined, 'us');
    expect(p.case).toBe('no-isbn');
    expect(p.lead.length).toBeGreaterThan(0);
    expect(p.note).toContain('no ISBN on record');
  });
});

describe('linkPlan order', () => {
  it('leads with the market’s own shops at home', () => {
    expect(plan(EN, 'us').lead.map(l => l.label)).toEqual(['Bookshop.org', 'Amazon']);
    expect(plan(DE, 'de').lead.map(l => l.label)).toEqual(['Thalia', 'Amazon']);
  });

  it('leads with the marketplaces for a foreign number', () => {
    expect(plan(TR, 'us').lead.map(l => l.label)).toEqual(['AbeBooks', 'eBay']);
    expect(plan(TR, 'de').lead.map(l => l.label)).toEqual(['AbeBooks', 'Booklooker']);
  });

  it('puts the image search up front when the publisher’s image differs', () => {
    expect(plan(TR, 'us', { verdict: 'differs' }).lead.map(l => l.label)).toContain('Google Lens');
    expect(plan(TR, 'us', { verdict: 'verified' }).lead.map(l => l.label)).not.toContain('Google Lens');
  });

  it('says nothing in the home case, where there is no order to explain', () => {
    expect(plan(EN, 'us').note).toBe('');
  });
});

describe('linkPlan: a link to this printing wins (Julian, 2026-09-09)', () => {
  it('offers no other-edition row while a shop that could pay has this number', () => {
    expect(plan(EN, 'us').anyEdition).toEqual([]);
    expect(plan(DE, 'de').anyEdition).toEqual([]);
    expect(plan(KDP, 'us').anyEdition).toEqual([]);
  });

  it('offers it exactly when no such link is possible', () => {
    expect(plan(TR, 'us').anyEdition.map(l => l.label)).toEqual(['Bookshop.org', 'Amazon']);
    expect(plan(TR, 'de').anyEdition.map(l => l.label)).toEqual(['Thalia', 'Amazon']);
    expect(plan(undefined, 'us').anyEdition.map(l => l.label)).toEqual(['Bookshop.org', 'Amazon']);
  });

  it('searches the work’s title there, not the printing’s', () => {
    // 56 % of cover-bearing editions carry a translated title; "Muhtesem
    // Gatsby" at Bookshop US is another empty result (plan §2.3).
    for (const link of plan(TR, 'us').anyEdition) {
      expect(decodeURIComponent(link.url)).toContain(GATSBY);
      expect(decodeURIComponent(link.url)).not.toContain('Muhtesem');
    }
  });

  it('does not also offer those shops the foreign number', () => {
    const labels = plan(TR, 'us').rest.map(l => l.label);
    expect(labels).not.toContain('Bookshop.org');
    expect(labels).not.toContain('Amazon');
  });
});

describe('linkPlan: one label, one place', () => {
  const cases: Array<[string | undefined, Market]> = [
    [EN, 'us'], [TR, 'us'], [DE, 'us'], [KDP, 'us'], [undefined, 'us'],
    [EN, 'uk'], [TR, 'uk'], [undefined, 'uk'],
    [EN, 'de'], [TR, 'de'], [DE, 'de'], [undefined, 'de'],
  ];
  it.each(cases)('never shows a label twice (%s, %s)', (isbn, market) => {
    const p = plan(isbn, market);
    const labels = [...p.lead, ...p.rest, ...p.anyEdition].map(l => l.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('shows AbeBooks as the title search when it leads, and not again by ISBN', () => {
    const p = plan(TR, 'us');
    const abe = [...p.lead, ...p.rest].filter(l => l.label === 'AbeBooks');
    expect(abe).toHaveLength(1);
    expect(abe[0].provider).toBe('abebooks-search');
  });
});

describe('linkPlan: nothing is thrown away', () => {
  it.each(['us', 'uk', 'de'] as const)('keeps every shop reachable in %s', market => {
    const p = plan(TR, market);
    const shown = new Set([...p.lead, ...p.rest, ...p.anyEdition].map(l => l.label));
    const offered = new Set([
      ...buyLinksFor({ isbn13: TR }, market, ENV).map(l => l.label),
      ...searchLinksFor({ title: 'Muhtesem Gatsby' }, market).map(l => l.label),
    ]);
    for (const label of offered) expect(shown).toContain(label);
  });
});

describe('orderEditionsForMarket (lever 2)', () => {
  const editions = [
    { id: 'a', isbn13: TR, year: 2013 },
    { id: 'b', isbn13: undefined, year: 1953 },
    { id: 'c', isbn13: EN, year: 2004 },
    { id: 'd', isbn13: DE, year: 2010 },
    { id: 'e', isbn13: EN, year: 2021 },
  ];

  it('leads with an ISBN from the reader’s own area, newest first', () => {
    // us: both English first (2021, 2004), then the foreign ISBNs by year
    // (Turkish 2013 before German 2010), then the record without a number.
    expect(orderEditionsForMarket(editions, 'us').map(e => e.id)).toEqual(['e', 'c', 'a', 'd', 'b']);
    expect(orderEditionsForMarket(editions, 'de').map(e => e.id)).toEqual(['d', 'e', 'a', 'c', 'b']);
  });

  it('puts an edition without any ISBN last, never drops it', () => {
    expect(orderEditionsForMarket(editions, 'us')).toHaveLength(editions.length);
    expect(orderEditionsForMarket(editions, 'us').at(-1)?.id).toBe('b');
  });

  it('keeps the catalogue’s order among equals', () => {
    const same = [{ id: 'x', isbn13: EN, year: 2004 }, { id: 'y', isbn13: EN, year: 2004 }];
    expect(orderEditionsForMarket(same, 'us').map(e => e.id)).toEqual(['x', 'y']);
  });
});

describe('linkPlan: no product page is promised for a number the shop never had (lever 3)', () => {
  it('withdraws the claim outside the home case', () => {
    // Blackwell's builds /bookshop/product/<isbn> for any number at all.
    const uk = plan(TR, 'uk');
    expect(uk.rest.find(l => l.label === "Blackwell's")?.kind).toBeUndefined();
  });
  it('keeps it where the number belongs to the market', () => {
    expect(plan(EN, 'uk').rest.find(l => l.label === "Blackwell's")?.kind).toBe('product');
  });
});
