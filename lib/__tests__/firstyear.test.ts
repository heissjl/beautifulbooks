import { describe, expect, it } from 'vitest';
import { robustFirstPublishYear } from '../firstyear';

/**
 * The cases are the measurement from ROADMAP 6.16: twelve works whose true
 * first publication is known, with the year lists Open Library returned on
 * 2026-09-08. The test states what the rule may and may not do.
 */
describe('robustFirstPublishYear', () => {
  it('drops the absurd outlier that made Lolita a book from 1777', () => {
    expect(robustFirstPublishYear(1777, [1777, 1954, 1955, 1956, 1958, 1959])).toBe(1954);
  });

  it('keeps a genuinely old first edition that stands alone', () => {
    // Moby Dick: 1851, then nothing until 1892. A 30-year rule ate this one.
    expect(robustFirstPublishYear(1851, [1851, 1892, 1900, 1901])).toBe(1851);
    // Vom Kriege: 1835, next 1873 — 38 years, under the threshold.
    expect(robustFirstPublishYear(1835, [1835, 1873, 1883, 1905])).toBe(1835);
  });

  it('leaves the eight works Open Library already had right untouched', () => {
    expect(robustFirstPublishYear(1949, [1949, 1950, 1951, 1954])).toBe(1949);
    expect(robustFirstPublishYear(1984, [1984, 1985, 1986, 1988])).toBe(1984);
    expect(robustFirstPublishYear(1929, [1929, 1930, 1931, 1958])).toBe(1929);
    expect(robustFirstPublishYear(1960, [1960, 1970, 1979])).toBe(1960);
  });

  it('does not pretend to fix ordinary wrong data', () => {
    // Ulysses is dated 1914 by a record that is simply wrong; no local rule
    // can see that, and the function must not invent 1922.
    expect(robustFirstPublishYear(1914, [1914, 1920, 1922, 1924])).toBe(1914);
  });

  it('falls back to the reported year when no list came, and survives junk', () => {
    expect(robustFirstPublishYear(1925, undefined)).toBe(1925);
    expect(robustFirstPublishYear(undefined, [])).toBeUndefined();
    expect(robustFirstPublishYear(1955, [12, 800, 1955, 1956])).toBe(1955);
  });

  it('discards a reported year that lies an era before every edition', () => {
    expect(robustFirstPublishYear(1777, [1954, 1955])).toBe(1954);
  });
});
