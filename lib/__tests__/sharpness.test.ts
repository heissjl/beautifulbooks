import { describe, expect, it } from 'vitest';
import { BLURRED_BELOW, sharpness } from '../sharpness';

/** Vertical stripes `period` px wide whose edges are `ramp` px wide (1 = a hard edge), optionally only in the left half. */
function stripes(size: number, period: number, ramp: number, leftOnly = false) {
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inStripe = !leftOnly || x < size / 2;
      const pos = x % (2 * period);
      // 0 → 255 over `ramp` px at each stripe boundary.
      const up = Math.min(1, pos / ramp);
      const down = Math.min(1, Math.max(0, (pos - period) / ramp));
      const v = inStripe ? Math.round(255 * (up - down)) : 120;
      const i = (y * size + x) * 4;
      rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v; rgba[i + 3] = 255;
    }
  }
  return { width: size, height: size, rgba };
}

describe('sharpness (5.11a): is the photo shaken, without asking a model', () => {
  it('scores hard edges high and edges spread over eight pixels low', () => {
    expect(sharpness(stripes(240, 20, 1))).toBeGreaterThan(0.9);
    const soft = sharpness(stripes(240, 20, 8));
    expect(soft).toBeLessThan(BLURRED_BELOW);
    expect(soft).toBeGreaterThan(0.2);
  });

  it('judges a photo by its sharpest tiles: sharp in one half is sharp', () => {
    expect(sharpness(stripes(240, 20, 1, true))).toBeGreaterThan(0.9);
  });

  it('says 1 where there is no edge to judge by', () => {
    const flat = { width: 240, height: 240, rgba: new Uint8Array(240 * 240 * 4).fill(128) };
    expect(sharpness(flat)).toBe(1);
  });
});
