import { describe, expect, it } from 'vitest';
import { collectionPin, comparePin, decadePin, FORBIDDEN_PIN_WORDS, PIN_DESCRIPTION_MAX, PIN_TITLE_MAX, pinLink, type Pin } from '../pins';

const LIVE = 'https://buyitscovers.com';

const dune = decadePin({
  id: 'OL893414W', title: 'Dune', author: 'Frank Herbert', covers: 83, records: 140, from: 1960, to: 2020,
  publishers: ['Ace', 'Hodder', 'New English Library'],
}, LIVE);

const potter = decadePin({
  id: 'OL82563W', title: "Harry Potter and the Philosopher's Stone", author: 'J. K. Rowling', covers: 176, records: 300, from: 1990, to: 2020,
  publishers: ['Bloomsbury'],
}, LIVE);

const masterworks = collectionPin({
  slug: 'sf-masterworks', title: 'SF Masterworks series', what: 'science fiction book covers', count: 75,
  firstTitles: ['The Forever War', 'I Am Legend', 'Cities in Flight'], artists: ['Chris Moore', 'Jim Burns', 'Fred Gambino'], creditSource: 'ISFDB',
}, LIVE);

const press = collectionPin({
  slug: 'feminist-press', title: 'Feminist Press', what: 'book covers from its list', count: 75,
  firstTitles: ['Earthsong', 'The Yellow Wallpaper', 'Daughter of Earth'], artists: [],
}, LIVE);

const duneCompare = comparePin({
  id: 'OL893414W', board: 'Three editions', title: 'Dune', author: 'Frank Herbert', covers: 84,
  editions: [{ coverId: 'ol:2', year: 1965, publisher: 'Chilton' }, { coverId: 'ol:5', year: 1978, publisher: 'New English Library' }, { coverId: 'ol:4', year: 1984 }],
}, LIVE);

// A full stop after a word, not after an initial: "J. K. Rowling" is one name.
const twoSentences = (text: string) => text.split(/(?<=[a-z]{2,}[.!?])\s+(?=[A-Z0-9])/).length;

describe.each<[string, Pin]>([['Dune', dune], ['Harry Potter', potter], ['SF Masterworks', masterworks], ['Feminist Press', press], ['Dune, three editions', duneCompare]])(
  'the pin for %s (ROADMAP 5.5a, PLAN-5.5-5.6 §7)',
  (_, pin) => {
    it('stays inside Pinterest’s limits', () => {
      expect(pin.title.length).toBeLessThanOrEqual(PIN_TITLE_MAX);
      expect(pin.description.length).toBeLessThanOrEqual(PIN_DESCRIPTION_MAX);
    });

    it('has two sentences, the words people search, no superlative and no completeness', () => {
      expect(twoSentences(pin.description)).toBe(2);
      expect(pin.title).toMatch(/book covers|three editions/);
      expect(pin.title).not.toMatch(FORBIDDEN_PIN_WORDS);
      expect(pin.description).not.toMatch(FORBIDDEN_PIN_WORDS);
    });

    it('links the live site with the mark the analytics count, and names its picture there', () => {
      expect(pin.link).toMatch(/^https:\/\/buyitscovers\.com\/.+\?via=pinterest(&cover=[a-z]+:[^&]+)?$/);
      expect(pin.picture).toMatch(/^https:\/\/buyitscovers\.com\/.+\/(pin|compare)\.jpg/);
    });
  },
);

describe('a decade pin', () => {
  it('carries the page’s numbers, the span and the publishers', () => {
    expect(dune.board).toBe('Covers through the decades');
    expect(dune.title).toBe('Dune by Frank Herbert – book covers by decade, 1960s to 2020s');
    expect(dune.description).toBe(
      '83 book covers of Dune by Frank Herbert, one group per decade from the 1960s to the 2020s, counted from 140 printings with a known year on Open Library. ' +
      'Publishers include Ace, Hodder and New English Library; each cover opens its edition with publisher, year and ISBN.',
    );
    expect(dune.link).toBe('https://buyitscovers.com/book/OL893414W/decades?via=pinterest');
    expect(dune.picture).toBe('https://buyitscovers.com/book/OL893414W/pin.jpg');
  });

  it('drops the span before it would cut the title', () => {
    const long = decadePin({
      id: 'OL1W', title: 'The Life and Opinions of Tristram Shandy, Gentleman', author: 'Laurence Sterne and 2 others', covers: 30, records: 40, from: 1900, to: 2010, publishers: [],
    }, LIVE);
    expect(long.title.length).toBeLessThanOrEqual(PIN_TITLE_MAX);
    // With the author the title would be 107 characters: the span goes first, then the author.
    expect(long.title).toBe('The Life and Opinions of Tristram Shandy, Gentleman – book covers by decade');
    const shorter = decadePin({ id: 'OL1W', title: 'The Life and Opinions of Tristram Shandy', author: 'Laurence Sterne', covers: 30, records: 40, from: 1900, to: 2010, publishers: [] }, LIVE);
    expect(shorter.title).toBe('The Life and Opinions of Tristram Shandy by Laurence Sterne – book covers by decade, 1900s to 2010s');
    expect(long.description).toMatch(/^30 book covers of .* Each cover opens its edition/);
  });
});

describe('a collection pin', () => {
  it('names the first books, the artists where the file has them, and the source of the credit', () => {
    expect(masterworks.board).toBe('SF Masterworks series');
    expect(masterworks.title).toBe('SF Masterworks series – 75 science fiction book covers');
    expect(masterworks.description).toContain('The Forever War, I Am Legend, Cities in Flight and more');
    expect(masterworks.description).toContain('cover art by Chris Moore, Jim Burns and Fred Gambino and others where ISFDB names the artist');
    expect(press.description).not.toContain('cover art');
    expect(press.link).toBe('https://buyitscovers.com/collections/feminist-press?via=pinterest');
  });
});

describe('a comparison pin (second format)', () => {
  it('names the covers in the picture’s address, the years in the title, and opens the first cover', () => {
    expect(duneCompare.board).toBe('Three editions');
    expect(duneCompare.picture).toBe('https://buyitscovers.com/book/OL893414W/compare.jpg?covers=ol:2,ol:5,ol:4');
    expect(duneCompare.title).toBe('Dune by Frank Herbert – three editions, 1965, 1978, 1984');
    expect(duneCompare.description).toBe(
      'Three editions of Dune by Frank Herbert next to each other: Chilton (1965), New English Library (1978) and 1984, out of 84 covers on record for this book. ' +
      'Each cover opens its edition with publisher, year and ISBN, beside the other editions on record.',
    );
    expect(duneCompare.link).toBe('https://buyitscovers.com/book/OL893414W?via=pinterest&cover=ol:2');
  });

  it('drops the years, then the author, before the title would be cut; an edition without a record is said so', () => {
    const long = comparePin({
      id: 'OL1W', board: 'Three editions', title: 'The Life and Opinions of Tristram Shandy, Gentleman', author: 'Laurence Sterne and 2 others', covers: 30,
      editions: [{ coverId: 'ol:1', year: 1900 }, { coverId: 'ol:2', year: 1950 }, { coverId: 'ol:3' }],
    }, LIVE);
    expect(long.title.length).toBeLessThanOrEqual(PIN_TITLE_MAX);
    expect(long.title).toBe('The Life and Opinions of Tristram Shandy, Gentleman by Laurence Sterne and 2 others – three editions');
    expect(long.description).toContain('1900, 1950 and an undated printing');
    const longer = comparePin({ ...{ id: 'OL1W', board: 'Three editions', title: 'The Life and Opinions of Tristram Shandy, Gentleman, in Nine Volumes', author: 'Laurence Sterne and 2 others', covers: 30, editions: [] } }, LIVE);
    expect(longer.title).toBe('The Life and Opinions of Tristram Shandy, Gentleman, in Nine Volumes – three editions');
    expect(longer.link).toBe('https://buyitscovers.com/book/OL1W?via=pinterest');
  });
});

describe('pinLink', () => {
  it('appends the mark to a path with or without a query', () => {
    expect(pinLink('/collections/sf-masterworks', LIVE)).toBe('https://buyitscovers.com/collections/sf-masterworks?via=pinterest');
    expect(pinLink('/book/OL1W?cover=ol:1', 'https://buyitscovers.com/')).toBe('https://buyitscovers.com/book/OL1W?cover=ol:1&via=pinterest');
  });
});
