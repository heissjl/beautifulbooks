import { describe, expect, it } from 'vitest';
import { drawSample, topShare } from '../walls/sample';

const c = (n: number, workId = `OL${n}W`) => ({ coverId: `ol:${n}`, workId, title: `T${n}`, author: 'A' });

describe('drawSample', () => {
  it('draws six from both lists, one cover per work, curated winning a shared work', () => {
    const curated = [1, 2, 3, 4].map((n) => c(n));
    const versus = [c(50, 'OL1W'), c(6), c(7), c(8)];
    const tiles = drawSample(curated, versus, () => 0.5);
    expect(tiles).toHaveLength(6);
    expect(new Set(tiles.map((t) => t.workId)).size).toBe(6);
    expect(tiles.some((t) => t.coverId === '50')).toBe(false);
    expect(tiles.every((t) => t.printings.length === 0)).toBe(true);
  });

  it('is random across draws and never offers a site-served image', () => {
    const curated = Array.from({ length: 30 }, (_, i) => c(i + 1));
    const a = drawSample(curated, [], () => 0.1).map((t) => t.coverId);
    const b = drawSample(curated, [], () => 0.9).map((t) => t.coverId);
    expect(a).not.toEqual(b);
    expect(drawSample([{ ...c(1), image: '/collection-covers/x.jpg' }], [])).toEqual([]);
  });

  it('keeps the source of each tile', () => {
    expect(drawSample([], [c(9)])[0].from).toBe('versus');
  });
});

describe('topShare', () => {
  it('takes the top tenth of the covers that have played, at least one', () => {
    const table = Array.from({ length: 50 }, (_, i) => ({ id: i, games: i < 30 ? 3 : 0 }));
    expect(topShare(table).map((e) => e.id)).toEqual([0, 1, 2]);
    expect(topShare([{ id: 0, games: 1 }])).toHaveLength(1);
  });
});
