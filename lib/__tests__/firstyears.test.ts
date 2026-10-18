/**
 * A checked first-publication year beats the catalogue's (ROADMAP 6.16
 * Schritt 2): Gatsby is 1925, not 1920; a work without a row keeps Open
 * Library's year, marked as such; a row needs a source.
 */
import { describe, expect, it } from 'vitest';
import firstYears from '../../data/first-years.json';
import { checkedFirstYear, withCheckedYear } from '../firstyears';
import type { Work } from '../model';

const work = (id: string, year?: number): Work => ({ id, title: id, authors: ['A'], ...(year !== undefined ? { firstPublishYear: year } : {}) });

describe('checked first-publication years', () => {
  it('corrects the four measured cases the catalogue gets wrong', () => {
    expect(withCheckedYear(work('OL468431W', 1920)).firstPublishYear).toBe(1925); // The Great Gatsby
    expect(withCheckedYear(work('OL627084W', 1954)).firstPublishYear).toBe(1955); // Lolita
    expect(withCheckedYear(work('OL86318W', 1914)).firstPublishYear).toBe(1922); // Ulysses
    expect(withCheckedYear(work('OL62744W', 1835)).firstPublishYear).toBe(1832); // Vom Kriege
    expect(withCheckedYear(work('OL468431W', 1920)).firstPublishYearSource).toBe('checked');
  });

  it('leaves a work without a row as the catalogue said, marked as the catalogue’s', () => {
    expect(withCheckedYear(work('OL0W', 1999))).toEqual({ ...work('OL0W', 1999), firstPublishYearSource: 'openlibrary' });
    expect(withCheckedYear(work('OL0W'))).toEqual(work('OL0W'));
    expect(checkedFirstYear('OL0W')).toBeUndefined();
  });

  it('names a source and a plausible year on every row', () => {
    const rows = Object.entries(firstYears as Record<string, { year: number; source: string }>);
    expect(rows.length).toBeGreaterThan(50);
    for (const [id, row] of rows) {
      expect(id, id).toMatch(/^OL\d+W$/);
      expect(row.year, id).toBeGreaterThan(1300);
      expect(row.year, id).toBeLessThanOrEqual(new Date().getFullYear());
      expect(row.source.length, id).toBeGreaterThan(10);
    }
  });
});
