import { describe, expect, it } from 'vitest';
import { TILE_RATIO, tileRatio } from '../tileratio';

describe('tileRatio', () => {
  it('keeps a paperback\'s own shape', () => {
    expect(tileRatio(1.62)).toBe(1.62);
  });
  it('falls back to 2:3 when the shape is unknown', () => {
    expect(tileRatio(undefined)).toBe(TILE_RATIO.fallback);
    expect(tileRatio(Number.NaN)).toBe(TILE_RATIO.fallback);
  });
  it('bounds a square audiobook cover and a scan with a wide margin', () => {
    expect(tileRatio(1)).toBe(TILE_RATIO.min);
    expect(tileRatio(2.4)).toBe(TILE_RATIO.max);
  });
});
