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

  it('leads with the marketplaces for a foreign number, and asks them by ISBN', () => {
    /*
      Julian, 2026-09-10: „isbn immer zuerst, wenn isbn existiert." Measured
      the same day on a Mexican printing of Der Steppenwolf (9789681500955):
      AbeBooks returned 11 offers for the number against 8 for title, author,
      publisher and year. The suffix is there because the other question is
      still offered, behind the fold — see the label rule below.
    */
    expect(plan(TR, 'us').lead.map(l => l.label)).toEqual(['AbeBooks · ISBN', 'eBay · ISBN']);
    expect(plan(TR, 'de').lead.map(l => l.label)).toEqual(['AbeBooks · ISBN', 'Booklooker']);
  });

  it('drops the suffix when there is no second question to tell it apart from', () => {
    // Without an ISBN a shop is asked one way only, so nothing needs naming.
    expect(plan(undefined, 'us').lead.map(l => l.label)).toEqual(['AbeBooks', 'eBay']);
  });

  it('hands the row to the searches when the publisher’s image differs', () => {
    /*
      Julian, 2026-09-09: „dann müssen suchen mit autor und jahr leichter
      vorgeschlagen werden als nur zig buttons wo immer ein anderes cover
      dahinter liegt." An ISBN link ships the other jacket, so it cannot lead.
    */
    for (const isbn of [EN, TR, DE]) {
      const lead = plan(isbn, 'us', { verdict: 'differs' }).lead;
      // The one case where the number does *not* lead, even though it exists:
      // it opens the other jacket by construction.
      expect(lead.map(l => l.label)).toEqual(['AbeBooks · title & year', 'eBay · title & year', 'Google Lens']);
      // Every one of them searches by title, author, publisher and year.
      for (const link of lead.slice(0, 2)) {
        expect(decodeURIComponent(link.url)).toContain('Everest');
        expect(decodeURIComponent(link.url)).toContain('2013');
      }
    }
  });

  it('moves the market’s shops behind the fold on differs, without losing them', () => {
    const p = plan(EN, 'us', { verdict: 'differs' });
    expect(p.lead.map(l => l.label)).not.toContain('Bookshop.org');
    expect(p.rest.map(l => l.label)).toEqual(expect.arrayContaining(['Bookshop.org', 'Amazon']));
  });

  it('adds the antiquarian search when no publisher image is on record (lever 4)', () => {
    // Only the order changes; "unknown" still says nothing about buying.
    expect(plan(EN, 'us', { verdict: 'unknown' }).lead.map(l => l.label)).toEqual(['Bookshop.org', 'Amazon', 'AbeBooks · ISBN']);
    expect(plan(EN, 'us', { verdict: 'verified' }).lead.map(l => l.label)).toEqual(['Bookshop.org', 'Amazon']);
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

  it('offers a shop both questions, and names which is which', () => {
    /*
      Until 2026-09-10 the second question was dropped: the label was spoken
      for, so the AbeBooks ISBN link vanished from the fold entirely. Julian:
      „ich finde aber auch wichtig, dass wir beide optionen anbieten, weil
      beide in verschiedenen fällen gewinnbringend sein können. die ein label
      ein platz regel sollte hart gehandhabt werden." So the rule holds — no
      two identical labels — and the duplicate is renamed instead of dropped.
    */
    const p = plan(TR, 'us');
    const abe = [...p.lead, ...p.rest].filter(l => l.label.startsWith('AbeBooks'));
    expect(abe.map(l => l.provider)).toEqual(['abebooks', 'abebooks-search']);
    expect(abe.map(l => l.label)).toEqual(['AbeBooks · ISBN', 'AbeBooks · title & year']);
    // The number leads; the words stay one row behind it.
    expect(p.lead.map(l => l.provider)).toContain('abebooks');
    expect(p.rest.map(l => l.provider)).toContain('abebooks-search');
  });
});

describe('linkPlan: nothing is thrown away', () => {
  it.each(['us', 'uk', 'de'] as const)('keeps every shop reachable in %s', market => {
    const p = plan(TR, market);
    /*
      Compared by shop, not by label: since 2026-09-10 a shop asked two ways
      carries a suffix that says which question a button puts ("AbeBooks ·
      ISBN"). The claim here is unchanged and now stronger — no shop is lost.
    */
    const shopOf = (label: string) => label.split(' · ')[0];
    const shown = new Set([...p.lead, ...p.rest, ...p.anyEdition].map(l => shopOf(l.label)));
    const offered = new Set([
      ...buyLinksFor({ isbn13: TR }, market, ENV).map(l => shopOf(l.label)),
      ...searchLinksFor({ title: 'Muhtesem Gatsby' }, market).map(l => shopOf(l.label)),
    ]);
    for (const shop of offered) expect(shown).toContain(shop);
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

  it('leads with the printing whose registered image is this cover', () => {
    /*
      Julian, 2026-09-09: „die version die das gleiche aktuelle cover hat wie
      die isbn sollte zuerst vorgeschlagen werden, nicht nach jahr sortiert."
      Measured on Beloved: Vintage International 2025 and 2004 carry the same
      folded cover, the year led with 2025, and it is 2004 whose ISBN the
      publisher still shows this jacket for.
    */
    const vintage = [
      { id: '2025', isbn13: EN, year: 2025 },
      { id: '2004', isbn13: '9780307388629', year: 2004 },
    ];
    const verdict = (isbn: string) => (isbn === '9780307388629' ? 'verified' as const : 'differs' as const);
    expect(orderEditionsForMarket(vintage, 'us', { verdictOf: verdict }).map(e => e.id)).toEqual(['2004', '2025']);
    // Without an answer yet, the year decides as before.
    expect(orderEditionsForMarket(vintage, 'us').map(e => e.id)).toEqual(['2025', '2004']);
  });

  it('does not reorder on an answer that has not arrived', () => {
    const two = [{ id: 'new', isbn13: EN, year: 2020 }, { id: 'old', isbn13: '9780307388629', year: 1999 }];
    for (const status of ['pending', 'unavailable', 'unknown'] as const) {
      expect(orderEditionsForMarket(two, 'us', { verdictOf: () => status }).map(e => e.id)).toEqual(['new', 'old']);
    }
  });

  it('lets the verdict outrank the market, because the reader picked a picture', () => {
    const mixed = [{ id: 'home', isbn13: EN, year: 2010 }, { id: 'foreign', isbn13: TR, year: 2013 }];
    const verdict = (isbn: string) => (isbn === TR ? 'verified' as const : 'unknown' as const);
    expect(orderEditionsForMarket(mixed, 'us', { verdictOf: verdict }).map(e => e.id)).toEqual(['foreign', 'home']);
  });

  it('leads with the printing that actually carried the scan on screen', () => {
    /*
      The case Julian's screenshot showed, and the one the verdict cannot
      answer: *Beloved* folds Vintage International 2025 and 2004 onto one
      tile, and both records carry **the same ISBN** — so both get the same
      verdict, and the year led with 2025. Only the pre-fold record of who
      carried the scan separates them.
    */
    const vintage = [
      { id: 'ol:OL1M', isbn13: EN, year: 2025 },
      { id: 'ol:OL2M', isbn13: EN, year: 2004 },
    ];
    const verdictOf = () => 'verified' as const;
    const carriedBy = new Set(['ol:OL2M']);
    expect(orderEditionsForMarket(vintage, 'us', { carriedBy, verdictOf }).map(e => e.id)).toEqual(['ol:OL2M', 'ol:OL1M']);
    // Pick the other scan above and the other printing leads.
    expect(orderEditionsForMarket(vintage, 'us', { carriedBy: new Set(['ol:OL1M']), verdictOf }).map(e => e.id))
      .toEqual(['ol:OL1M', 'ol:OL2M']);
  });

  it('skips the scan criterion when it knows nothing, rather than reshuffling', () => {
    const two = [{ id: 'a', isbn13: EN, year: 2025 }, { id: 'b', isbn13: EN, year: 2004 }];
    expect(orderEditionsForMarket(two, 'us', { carriedBy: new Set(['somewhere-else']) }).map(e => e.id)).toEqual(['a', 'b']);
    expect(orderEditionsForMarket(two, 'us', { carriedBy: new Set() }).map(e => e.id)).toEqual(['a', 'b']);
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
