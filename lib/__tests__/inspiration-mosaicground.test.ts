import { describe, expect, it } from 'vitest';
import { arrangement, seeded, shade } from '../inspiration/mosaicground';

describe('the mosaic ground', () => {
  it('gives one board the same field every time, and another board another', () => {
    expect(arrangement('ol:1,ol:2', 40, 34, 28760)).toEqual(arrangement('ol:1,ol:2', 40, 34, 28760));
    expect(arrangement('ol:1,ol:2', 40, 34, 28760)).not.toEqual(arrangement('ol:1,ol:3', 40, 34, 28760));
  });

  it('only names cells the library has', () => {
    const cells = arrangement('x', 40, 48, 7);
    expect(cells).toHaveLength(40 * 48);
    expect(cells.every((i) => Number.isInteger(i) && i >= 0 && i < 7)).toBe(true);
    const next = seeded('');
    for (let k = 0; k < 1000; k++) { const v = next(); expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1); }
  });

  it('is darker behind the words than in the open, and darker at the edge than in the middle', () => {
    const words = [{ x: 60, y: 0, width: 960, height: 140 }];
    const behind = shade(540, 70, 1080, 1350, words);
    const middle = shade(540, 675, 1080, 1350, words);
    const corner = shade(1079, 1349, 1080, 1350, words);
    expect(middle).toBeCloseTo(0.5, 2);
    expect(behind).toBeGreaterThan(middle);
    expect(corner).toBeGreaterThan(middle);
    expect(corner).toBeLessThanOrEqual(1);
  });
});
