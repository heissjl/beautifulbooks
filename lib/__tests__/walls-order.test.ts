import { describe, expect, it } from 'vitest';
import { FIRST_PAGE, NEXT_PAGE, pageOf, parseSeed, readerOrder } from '../walls/order';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const wall = (id: string, createdOn: string, views: number) => ({ id, createdOn, views });

describe('readerOrder', () => {
  const walls = Array.from({ length: 40 }, (_, i) => wall(`w${String(i).padStart(9, '0')}`, '2026-06-01', i % 5));

  it('keeps one order for one seed and gives another for another', () => {
    expect(readerOrder(walls, 7, NOW)).toEqual(readerOrder(walls, 7, NOW));
    expect(readerOrder(walls, 7, NOW).map((w) => w.id)).not.toEqual(readerOrder(walls, 8, NOW).map((w) => w.id));
  });

  it('lets a new wall without views reach the top half, and puts a much-viewed wall ahead on most visits', () => {
    const fresh = wall('newnewnewn', '2026-09-28', 0);
    const famous = wall('famousfamo', '2026-01-01', 500);
    const all = [...walls, fresh, famous];
    let freshTop = 0;
    let famousAhead = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const ids = readerOrder(all, seed, NOW).map((w) => w.id);
      if (ids.indexOf('newnewnewn') < all.length / 2) freshTop++;
      if (ids.indexOf('famousfamo') < ids.indexOf('w000000000')) famousAhead++;
    }
    expect(freshTop).toBeGreaterThan(150);
    expect(famousAhead).toBeGreaterThan(150);
  });

  it('puts an old wall with no views on the first page on a fair share of visits', () => {
    const old = wall('oldoldoldo', '2025-01-01', 0);
    const all = [old, ...walls];
    const seen = Array.from({ length: 500 }, (_, s) => readerOrder(all, s + 1, NOW).slice(0, FIRST_PAGE).some((w) => w.id === 'oldoldoldo'));
    // Measured 36 % at LUCK 5 (lib/walls/order.ts); the test holds the floor at 30 %.
    expect(seen.filter(Boolean).length).toBeGreaterThan(150);
  });
});

describe('pageOf', () => {
  it('serves 26 first, then pages that follow on, and says when it is done', () => {
    const items = Array.from({ length: 60 }, (_, i) => i);
    const first = pageOf(items, 0);
    expect(first.items).toHaveLength(FIRST_PAGE);
    const second = pageOf(items, first.next ?? 0);
    expect(second.items[0]).toBe(FIRST_PAGE);
    expect(second.items).toHaveLength(Math.min(NEXT_PAGE, 60 - FIRST_PAGE));
    expect(pageOf(items, 52).next).toBeNull();
  });

  it('reads a seed only in range', () => {
    expect(parseSeed('123')).toBe(123);
    expect(parseSeed('-1')).toBeNull();
    expect(parseSeed('x')).toBeNull();
    expect(parseSeed(null)).toBeNull();
  });
});
