import { describe, expect, it } from 'vitest';
import { editionLine, editionOfCoverRecord } from '../inspiration/edition';

describe('the printing a chosen cover belongs to', () => {
  it('reads the edition from a cover record, and nothing else', () => {
    // Shaped like covers.openlibrary.org/b/id/9396760.json (2026-10-06), trimmed.
    expect(editionOfCoverRecord({ id: 9396760, olid: 'OL26398085M', width: 392, height: 592 })).toBe('OL26398085M');
    expect(editionOfCoverRecord({ id: 1, olid: null })).toBeNull();
    expect(editionOfCoverRecord({ olid: '/books/OL1M' })).toBeNull();
    expect(editionOfCoverRecord(null)).toBeNull();
  });

  it('gives year and first publisher, leaving out a garbled name', () => {
    expect(editionLine({ publishers: ['Penguin Random House'], publish_date: '2016' })).toEqual({ year: 2016, publisher: 'Penguin Random House' });
    expect(editionLine({ publishers: ['Do?u Bat? Yay?nlar?'], publish_date: 'Nov 03, 2017' })).toEqual({ year: 2017 });
    expect(editionLine({ publishers: ['HarperCollins'] })).toEqual({ publisher: 'HarperCollins' });
    expect(editionLine({ publishers: [] })).toBeNull();
  });
});
