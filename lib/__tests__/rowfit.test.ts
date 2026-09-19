/**
 * Packing pills into a limited number of rows (ROADMAP 6.8, lib/rowfit.ts).
 */
import { describe, expect, it } from 'vitest';
import { fitCount, rowsNeeded } from '../rowfit';

describe('rowsNeeded', () => {
  it('wraps like a flex row: a new row when the next item does not fit', () => {
    // 100 wide, gap 10: [40, 40] fits (90), the third wraps.
    expect(rowsNeeded([40, 40, 40], 100, 10)).toBe(2);
    expect(rowsNeeded([40, 40], 100, 10)).toBe(1);
  });

  it('counts a heading that takes the start of the first row', () => {
    expect(rowsNeeded([40, 40], 100, 10, 30)).toBe(2);
  });

  it('never breaks before the first item of a row, however wide', () => {
    expect(rowsNeeded([150, 40], 100, 10)).toBe(2);
  });

  it('takes half a pixel of rounding', () => {
    expect(rowsNeeded([45.3, 45.2], 100, 10)).toBe(1);
  });
});

describe('fitCount', () => {
  const base = { rowWidth: 100, gap: 10, maxRows: 2 };

  it('shows everything when everything fits', () => {
    expect(fitCount({ ...base, lead: [40, 40], tail: [30, 40], tailIfAll: [40] })).toBe(2);
  });

  it('keeps as many as fit together with "+n more" and the pills that never go', () => {
    // Six pills of 40 and a tail of "+n" 30 and "All" 40: two rows hold
    // 40 40 | 40 30 — so one pill of the lead stays... plus the tail:
    // [40, 40, 30, 40] -> rows: 40 40 | 30 40 -> 2 rows, k = 2.
    expect(fitCount({ ...base, lead: [40, 40, 40, 40, 40, 40], tail: [30, 40], tailIfAll: [40] })).toBe(2);
  });

  it('can end with nothing of the lead when the tail alone fills the rows', () => {
    expect(fitCount({ ...base, maxRows: 1, lead: [40, 40], tail: [50, 50], tailIfAll: [50] })).toBe(0);
  });
});
