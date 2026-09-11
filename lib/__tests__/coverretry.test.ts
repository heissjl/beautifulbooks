/**
 * The retry address of a failed cover (ROADMAP 6.31, lib/coverurl.ts).
 */
import { describe, expect, it } from 'vitest';
import { retryCoverSrc } from '../coverurl';

describe('retryCoverSrc', () => {
  it('marks our own route, so the browser asks again', () => {
    expect(retryCoverSrc('/img/M/ol-9390687')).toBe('/img/M/ol-9390687?retry=1');
  });

  it('adds to a query that is already there', () => {
    expect(retryCoverSrc('/img/L/gb-abc?x=1')).toBe('/img/L/gb-abc?x=1&retry=1');
  });

  it('leaves a foreign address untouched', () => {
    const google = 'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1';
    expect(retryCoverSrc(google)).toBe(google);
  });
});
