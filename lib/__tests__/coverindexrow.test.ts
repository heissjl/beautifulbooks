/**
 * The aspect column of the cover index (ROADMAP 6.70b): an optional eighth
 * field that older readers never see and older rows never have.
 */
import { describe, expect, it } from 'vitest';
import { ROW_ASPECT, aspectOf, fillAspects, rowAspect, type CoverRow } from '../coverindexrow';
import { looksMisshapen } from '../imagesig';

const row = (id: string, aspect?: number): CoverRow => {
  const r: CoverRow = [0, id, 'aad48eda9696ccaa', 41, 49, 175, '/9dQCwAAAAAAAAAAAAIZhA=='];
  if (aspect !== undefined) r.push(aspect);
  return r;
};

describe('aspectOf', () => {
  it('rounds width over height to two decimals, as the live signature does', () => {
    expect(aspectOf(2105, 3278)).toBe(0.64);
    expect(aspectOf(100, 100)).toBe(1);
  });

  it('answers null for a size that is no size', () => {
    expect(aspectOf(0, 500)).toBeNull();
    expect(aspectOf(500, 0)).toBeNull();
    expect(aspectOf(NaN, 500)).toBeNull();
  });
});

describe('the eighth column', () => {
  it('is absent on a row from before it, and readers of seven fields do not notice it', () => {
    expect(rowAspect(row('ol:1'))).toBeUndefined();
    const [work, id, hash, contrast, mean, saturation, hues] = row('ol:2', 0.44);
    expect([work, id, hash, contrast, mean, saturation, hues]).toEqual(row('ol:2').slice(0, 7));
    expect(rowAspect(row('ol:2', 0.44))).toBe(0.44);
  });

  it('fills only rows without it, and only where the lookup knows the size', () => {
    const rows = [row('ol:1'), row('ol:2', 0.66), row('ol:3')];
    const filled = fillAspects(rows, id => (id === 'ol:3' ? null : 0.5));
    expect(filled).toBe(1);
    expect(rows[0][ROW_ASPECT]).toBe(0.5);
    expect(rows[1][ROW_ASPECT]).toBe(0.66); // measured from its own image: kept
    expect(rows[2]).toHaveLength(7); // unknown stays absent, never 0
  });

  it('feeds the shape check: a playing card is misshapen, an unmeasured cover passes', () => {
    expect(looksMisshapen({ hash: '', contrast: 0, aspect: rowAspect(row('ol:1', 1)) })).toBe(true);
    expect(looksMisshapen({ hash: '', contrast: 0, aspect: rowAspect(row('ol:1')) })).toBe(false);
  });
});
