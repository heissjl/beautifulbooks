import { describe, expect, it } from 'vitest';
import { compareOrder, coverFacts, findCover, parseCoverIds, pickCompareCovers } from '../comparepin';
import type { Cover, Edition } from '../model';

const edition = (id: string, year: number | undefined, publisher?: string): Edition =>
  ({ id, workId: 'OL1W', source: 'openlibrary', title: 'Dune', year, publisher });

const cover = (id: string, editionIds: string[], similarIds?: string[]): Cover =>
  ({ id, url: `https://covers.openlibrary.org/b/id/${id.slice(3)}-L.jpg`, source: 'openlibrary', editionIds, similarIds });

// A wall in the catalogue's order: the 2005 Ace first, then two of the 1960s, a 1984, a 1978, two undated.
const editions = [
  edition('ol:e1', 2005, 'Ace'),
  edition('ol:e2', 1965, 'Chilton'),
  edition('ol:e3', 1968, 'New English Library'),
  edition('ol:e4', 1984, 'Berkley'),
  edition('ol:e5', 1978, 'New English Library'),
  edition('ol:e6', undefined, 'Heyne'),
  edition('ol:e7', undefined),
  edition('ol:e8', 1965, 'Chilton Books'),
];
const covers = [
  cover('ol:1', ['ol:e1']),
  cover('ol:2', ['ol:e2', 'ol:e8'], ['ol:9']),
  cover('ol:3', ['ol:e3']),
  cover('ol:4', ['ol:e4']),
  cover('ol:5', ['ol:e5']),
  cover('ol:6', ['ol:e6']),
  cover('ol:7', ['ol:e7']),
];
const ids = (list: ReturnType<typeof pickCompareCovers>) => list.map(c => c.cover.id);

describe('pickCompareCovers (ROADMAP 5.5a, comparison pin)', () => {
  it('without ids takes the oldest dated cover and the oldest of two further decades, then spares', () => {
    const picked = pickCompareCovers(covers, editions);
    expect(ids(picked).slice(0, 3)).toEqual(['ol:2', 'ol:5', 'ol:4']);
    // Spares: the remaining decade (2000s), then the other dated covers oldest first, then the undated.
    expect(ids(picked).slice(3)).toEqual(['ol:1', 'ol:3', 'ol:6']);
    expect(picked[0]).toMatchObject({ year: 1965, publisher: 'Chilton' });
    expect(picked[1]).toMatchObject({ year: 1978, publisher: 'New English Library' });
  });

  it('with ids takes those, in that order, and fills the rest by the decade rule', () => {
    const picked = pickCompareCovers(covers, editions, ['ol:4', 'ol:1', 'ol:2']);
    expect(ids(picked).slice(0, 3)).toEqual(['ol:4', 'ol:1', 'ol:2']);
    expect(ids(pickCompareCovers(covers, editions, ['ol:4'])).slice(0, 3)).toEqual(['ol:4', 'ol:2', 'ol:5']);
  });

  it('finds a cover that was folded under another scan, and ignores an id the work does not have', () => {
    expect(findCover(covers, 'ol:9')?.id).toBe('ol:2');
    expect(findCover(covers, 'ol:99')).toBeUndefined();
    expect(ids(pickCompareCovers(covers, editions, ['ol:99', 'ol:9'])).slice(0, 3)).toEqual(['ol:2', 'ol:5', 'ol:4']);
  });

  it('falls back to the oldest dated covers when the decades run out, and to the wall when the years do', () => {
    const sixties = covers.filter(c => ['ol:2', 'ol:3', 'ol:6', 'ol:7'].includes(c.id));
    expect(ids(pickCompareCovers(sixties, editions)).slice(0, 3)).toEqual(['ol:2', 'ol:3', 'ol:6']);
    const undated = covers.filter(c => ['ol:6', 'ol:7'].includes(c.id));
    expect(ids(pickCompareCovers(undated, editions))).toEqual(['ol:6', 'ol:7']);
  });

  it('gives a cover the earliest year among its editions and that edition’s publisher', () => {
    const byId = new Map(editions.map(e => [e.id, e]));
    expect(coverFacts(cover('ol:x', ['ol:e8', 'ol:e2', 'ol:e1']), byId)).toEqual({ year: 1965, publisher: 'Chilton Books' });
    expect(coverFacts(cover('ol:y', ['ol:e7', 'ol:e6']), byId)).toEqual({ year: undefined, publisher: undefined });
    expect(coverFacts(cover('ol:z', ['ol:e6']), byId)).toEqual({ year: undefined, publisher: 'Heyne' });
    const placeholders = new Map([['p1', edition('p1', 1950, '[publisher not identified]')], ['p2', edition('p2', 1951, '[s.n.]')], ['p3', edition('p3', 1952, 'Unknown')]]);
    for (const id of ['p1', 'p2', 'p3']) expect(coverFacts(cover('ol:p', [id]), placeholders).publisher).toBeUndefined();
  });
});

describe('compareOrder', () => {
  it('sorts by year with the undated last, unless the covers were asked for by id', () => {
    const shown = [{ id: 'c', year: 2005 }, { id: 'a' }, { id: 'b', year: 1965 }];
    expect(compareOrder(shown, false).map(s => s.id)).toEqual(['b', 'c', 'a']);
    expect(compareOrder(shown, true).map(s => s.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('parseCoverIds', () => {
  it('reads up to three ids of the site’s forms and drops the rest', () => {
    expect(parseCoverIds('ol:1, ol:2,gb:abc-DEF_9')).toEqual(['ol:1', 'ol:2', 'gb:abc-DEF_9']);
    expect(parseCoverIds('ol:1,ol:1,ol:2,ol:3,ol:4')).toEqual(['ol:1', 'ol:2', 'ol:3']);
    expect(parseCoverIds('https://evil/x,ol:1;drop,ol:2')).toEqual(['ol:2']);
    expect(parseCoverIds(null)).toEqual([]);
    expect(parseCoverIds('')).toEqual([]);
  });
});
