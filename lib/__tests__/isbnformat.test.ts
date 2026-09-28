import { describe, expect, it } from 'vitest';
import { hyphenateIsbn, isbnRuns } from '../isbnformat';

describe('hyphenateIsbn', () => {
  it('splits by the range table, not by a fixed pattern', () => {
    expect(hyphenateIsbn('9780141439471')).toBe('978-0-14-143947-1');
    expect(hyphenateIsbn('9783596904860')).toBe('978-3-596-90486-0');
    expect(hyphenateIsbn('9781513137391')).toBe('978-1-5131-3739-1');
  });

  it('leaves an ISBN the table cannot place as it came', () => {
    expect(hyphenateIsbn('9780000000001')).toBe('9780000000001');
    expect(hyphenateIsbn('not an isbn')).toBe('not an isbn');
  });
});

describe('isbnRuns', () => {
  it('marks every zero and hyphen, and only those', () => {
    const runs = isbnRuns('9780141439471');
    expect(runs.map(r => r.text).join('')).toBe('978-0-14-143947-1');
    expect(runs.filter(r => r.mono).map(r => r.text).join('')).toBe('-0---');
    expect(runs.filter(r => !r.mono).every(r => !/[0-]/.test(r.text))).toBe(true);
  });
});
