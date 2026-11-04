import { describe, expect, it } from 'vitest';
import { coverPrinting, pickCoverPins, PLAIN_SHARE, plainShare, recordDoubts } from '../coverpins';
import type { ImageSignature } from '../imagesig';
import type { Cover, Edition } from '../model';

const edition = (id: string, year: number | undefined, publisher?: string, language = 'en', title = 'Dune', isbn10?: string): Edition =>
  ({ id, workId: 'OL1W', source: 'openlibrary', title, year, publisher, language, isbn10 });

const cover = (id: string, editionIds: string[], similarIds?: string[]): Cover =>
  ({ id, url: `https://covers.openlibrary.org/b/id/${id.slice(3)}-L.jpg`, source: 'openlibrary', editionIds, similarIds });

// The wall in the catalogue's order: a 2005 Ace, two of the 1960s, a 1984, a 1978, a German Heyne, an undated, a scanned page of 1966.
const editions = [
  edition('ol:e1', 2005, 'Ace'),
  edition('ol:e2', 1965, 'Chilton'),
  edition('ol:e3', 1968, 'New English Library'),
  edition('ol:e4', 1984, 'Berkley'),
  edition('ol:e5', 1978, 'New English Library'),
  edition('ol:e6', 1978, 'Heyne', 'de', 'Der Wüstenplanet'),
  edition('ol:e7', undefined),
  edition('ol:e8', 1965, 'Chilton Books'),
  edition('ol:e9', 1966, 'Gollancz'),
  edition('ol:e10', 2001, 'Mondadori', 'it', 'Dune'),
];
const covers = [
  cover('ol:1', ['ol:e1']),
  cover('ol:2', ['ol:e2', 'ol:e8'], ['ol:9']),
  cover('ol:3', ['ol:e3']),
  cover('ol:4', ['ol:e4']),
  cover('ol:5', ['ol:e5']),
  cover('ol:6', ['ol:e6']),
  cover('ol:7', ['ol:e7']),
  cover('ol:8', ['ol:e9']),
  cover('ol:10', ['ol:e10']),
];
const page: ImageSignature = { hash: '0'.repeat(16), contrast: 4, mean: 250 };
const signatures = new Map<string, ImageSignature>([['ol:8', page]]);
const ids = (list: ReturnType<typeof pickCoverPins>) => list.map(c => c.cover.id);

describe('coverPrinting', () => {
  it('names the earliest dated edition carrying the cover and counts the carriers', () => {
    const byId = new Map(editions.map(e => [e.id, e]));
    expect(coverPrinting(covers[1], byId)).toMatchObject({ year: 1965, publisher: 'Chilton', language: 'en', carriers: 2 });
    expect(coverPrinting(covers[1], byId).edition?.id).toBe('ol:e2');
    expect(coverPrinting(covers[6], byId)).toMatchObject({ carriers: 1 });
    expect(coverPrinting(covers[6], byId).year).toBeUndefined();
  });
});

describe('pickCoverPins (ROADMAP 5.5, the cover pins of 2026-11-04)', () => {
  it('takes the old printings oldest first, one decade each, then the foreign ones, then spares', () => {
    const picked = pickCoverPins(covers, editions, signatures);
    // Primaries: 1965 and 1978 (the 1968 shares the 1960s with the 1965). Spares: the rest, old ones first.
    expect(ids(picked)).toEqual(['ol:2', 'ol:5', 'ol:3', 'ol:6', 'ol:4', 'ol:10']);
    expect(picked[0].reasons).toEqual(['old']);
    expect(picked[3].reasons).toEqual(['old', 'foreign']);
    expect(picked[5]).toMatchObject({ reasons: ['foreign'], language: 'it' });
  });

  it('leaves out a scanned page, an excluded cover and a recent English printing', () => {
    const picked = pickCoverPins(covers, editions, signatures, { spare: 10 });
    expect(ids(picked)).not.toContain('ol:8');
    expect(ids(picked)).not.toContain('ol:1');
    expect(ids(picked)).not.toContain('ol:7');
    const less = pickCoverPins(covers, editions, signatures, { exclude: new Set(['ol:9', 'ol:5']) });
    expect(ids(less)).not.toContain('ol:2');
    expect(ids(less)).not.toContain('ol:5');
  });

  it('follows the rules it is given', () => {
    expect(ids(pickCoverPins(covers, editions, signatures, { maxYear: 1970, foreign: false, perWork: 1, spare: 0 }))).toEqual(['ol:2']);
    const foreignOnly = pickCoverPins(covers, editions, signatures, { maxYear: 1900, perWork: 2, spare: 0 });
    expect(ids(foreignOnly)).toEqual(['ol:6', 'ol:10']);
    expect(foreignOnly.map(c => c.reasons)).toEqual([['foreign'], ['foreign']]);
  });

  it('returns nothing for a work with only recent English printings', () => {
    expect(pickCoverPins([covers[0]], editions, signatures)).toEqual([]);
  });
});

describe('plainShare: a binding without its jacket', () => {
  const raster = (cells: Array<[number, number, number]>) => Uint8Array.from(cells.flat());
  const cloth: [number, number, number] = [90, 20, 24];
  it('is one for a plain cloth and stays above the threshold with a barcode label on it', () => {
    expect(plainShare(raster(Array.from({ length: 100 }, () => cloth)))).toBe(1);
    const label: [number, number, number] = [250, 250, 240];
    const withLabel = raster([...Array.from({ length: 92 }, () => cloth), ...Array.from({ length: 8 }, () => label)]);
    expect(plainShare(withLabel)).toBeGreaterThanOrEqual(PLAIN_SHARE);
  });
  it('is low for a printed cover with type and a picture', () => {
    const noisy = raster(Array.from({ length: 100 }, (_, i) => [(i * 37) % 256, (i * 91) % 256, (i * 53) % 256] as [number, number, number]));
    expect(plainShare(noisy)).toBeLessThan(0.3);
    const twoColours = raster([...Array.from({ length: 50 }, () => cloth), ...Array.from({ length: 50 }, () => [240, 200, 60] as [number, number, number])]);
    expect(plainShare(twoColours)).toBe(0.5);
    expect(plainShare(new Uint8Array())).toBe(0);
  });
});

describe('doubts: a record that contradicts itself (the Berkley scan under „Chilton 1965“, 2026-11-04)', () => {
  // The Berkley paperback's scan sits on a record dated 1965 that carries an ISBN; a second record of the same image is dated 1984.
  const misdated = edition('ol:m1', 1965, 'Chilton Books', 'en', 'Dune', '042507160X');
  const berkley = edition('ol:m2', 1984, 'Berkley', 'en', 'Dune', '042507160X');
  const early = edition('ol:m3', 1950, 'Someone');
  const byId = new Map([misdated, berkley, early, ...editions].map(e => [e.id, e]));

  it('doubts an ISBN before 1970 and a year before the first publication', () => {
    expect(recordDoubts(misdated)).toEqual(['isbn before 1970']);
    expect(recordDoubts(early, 1965)).toEqual(['before first publication']);
    expect(recordDoubts(berkley, 1965)).toEqual([]);
  });

  it('takes the earliest sound record over an earlier doubtful one, and says the carriers disagree', () => {
    const p = coverPrinting(cover('ol:20', ['ol:m1', 'ol:m2']), byId, 1965);
    expect(p).toMatchObject({ year: 1984, publisher: 'Berkley', carriers: 2, doubts: ['carriers disagree'] });
    const alone = coverPrinting(cover('ol:21', ['ol:m1']), byId, 1965);
    expect(alone).toMatchObject({ year: 1965, publisher: 'Chilton Books', doubts: ['isbn before 1970'] });
    expect(coverPrinting(covers[1], byId, 1965).doubts).toEqual([]);
  });

  it('puts a doubtful cover after the sound ones of its group', () => {
    const picked = pickCoverPins([cover('ol:21', ['ol:m1']), covers[1], covers[4]], [misdated, ...editions], signatures, { firstYear: 1965, perWork: 3, spare: 0 });
    expect(ids(picked)).toEqual(['ol:2', 'ol:5', 'ol:21']);
  });
});
