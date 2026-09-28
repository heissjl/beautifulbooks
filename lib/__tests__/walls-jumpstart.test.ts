import { describe, expect, it } from 'vitest';
import { tilesFromCurated, tilesFromWall } from '../walls/jumpstart';

describe('starting from another collection (5.13k)', () => {
  it('takes a curated collection in order, leaves out site-served images and repeats', () => {
    const r = tilesFromCurated([
      { id: 'OL1W', title: 'A', author: 'X', coverId: 11 },
      { id: 'OL2W', title: 'B', author: 'Y', coverId: 0, image: '/collection-covers/b.jpg' },
      { id: 'OL3W', title: 'C', author: 'Z', coverId: 33, coverWork: 'OL9W' },
      { id: 'OL4W', title: 'A again', author: 'X', coverId: 11 },
    ]);
    expect(r.tiles.map((t) => [t.workId, t.coverId])).toEqual([['OL1W', '11'], ['OL9W', '33']]);
    expect(r.skipped).toBe(1);
    expect(r.capped).toBe(0);
  });

  it('takes a collection of 198 whole, and says so only past the store bound', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `OL${i + 1}W`, title: `T${i}`, author: 'A', coverId: i + 1 }));
    expect(tilesFromCurated(many(198))).toMatchObject({ capped: 0 });
    expect(tilesFromCurated(many(198)).tiles).toHaveLength(198);
    expect(tilesFromCurated(many(510)).capped).toBe(10);
  });

  it('copies a reader’s collection with its printings', () => {
    const wall = { id: 'aaaaaaaaaa', title: 'W', columns: 4, createdOn: 'd', updatedAt: 't', tiles: [{ workId: 'OL1W', coverId: '5', title: 'A', printings: [{ isbn13: '9780000000002' }] }] };
    expect(tilesFromWall(wall).tiles).toEqual(wall.tiles);
  });
});

describe('options on /create (5.13k)', () => {
  it('says how many covers a collection has and how many go in', async () => {
    const { curatedOption } = await import('../walls/jumpstart');
    const works = Array.from({ length: 76 }, (_, i) => ({ id: `OL${i + 1}W`, title: `T${i}`, author: 'A', coverId: i + 1 }));
    expect(curatedOption({ slug: 'feminist-press', title: 'Feminist Press', works })).toMatchObject({ count: 76, taken: 76, covers: ['1', '2', '3', '4'] });
    expect(curatedOption({ slug: 'x', title: 'X', works: [{ id: 'OL1W', title: 'T', author: 'A', coverId: 0, image: '/c.jpg' }] })).toBeNull();
  });
});
