/**
 * Reading the shape of a query (ROADMAP 6.29). The real ISBNs below are the
 * ones measured against the catalogue on 2026-09-10.
 */
import { describe, expect, it } from 'vitest';
import { isValidIsbn, shapeOf } from '../queryshape';

const NINETEEN_EIGHTY_FOUR_13 = '9780451524935';
const NINETEEN_EIGHTY_FOUR_10 = '0451524934';

describe('the check digit', () => {
  it('accepts a real ISBN-13 and a real ISBN-10', () => {
    expect(isValidIsbn(NINETEEN_EIGHTY_FOUR_13)).toBe(true);
    expect(isValidIsbn(NINETEEN_EIGHTY_FOUR_10)).toBe(true);
  });

  it('rejects one digit off, which is the whole reason it is checked', () => {
    // Without this, a typo and a book the catalogue lacks look the same.
    expect(isValidIsbn('9780451524936')).toBe(false);
    expect(isValidIsbn('9780000000000')).toBe(false);
  });

  it('accepts an X only where it may stand', () => {
    expect(isValidIsbn('080442957X')).toBe(true);
    expect(isValidIsbn('X451524934')).toBe(false);
    expect(isValidIsbn('978045152493X')).toBe(false);
  });

  it('says no to anything that is not an ISBN at all', () => {
    expect(isValidIsbn('gatsby')).toBe(false);
    expect(isValidIsbn('')).toBe(false);
    expect(isValidIsbn('123')).toBe(false);
  });
});

describe('the shape of a query', () => {
  it('reads an ISBN in every spelling and carries it on as ISBN-13', () => {
    for (const written of [
      NINETEEN_EIGHTY_FOUR_13,
      '978-0-451-52493-5',
      '978 0451 524935',
      ` ${NINETEEN_EIGHTY_FOUR_13} `,
    ]) {
      expect(shapeOf(written)).toEqual({ kind: 'isbn', isbn13: NINETEEN_EIGHTY_FOUR_13 });
    }
    // An ISBN-10 names the same book, so it arrives as the same number.
    expect(shapeOf(NINETEEN_EIGHTY_FOUR_10)).toEqual({ kind: 'isbn', isbn13: NINETEEN_EIGHTY_FOUR_13 });
  });

  it('reads a pasted work id', () => {
    expect(shapeOf('OL1168083W')).toEqual({ kind: 'work', workId: 'OL1168083W' });
    expect(shapeOf(' ol1168083w ')).toEqual({ kind: 'work', workId: 'OL1168083W' });
  });

  it('leaves words alone', () => {
    expect(shapeOf('gatsby').kind).toBe('text');
    expect(shapeOf('1984').kind).toBe('text');
    expect(shapeOf('').kind).toBe('text');
  });

  it('treats an ISBN inside a sentence as a search, not as an ISBN', () => {
    // "gatsby 9780743273565" is somebody searching, not somebody with a book
    // in their hand; sending them to one edition would answer a question they
    // did not ask.
    expect(shapeOf('gatsby 9780743273565').kind).toBe('text');
    expect(shapeOf('isbn 9780451524935').kind).toBe('text');
  });

  it('treats a number that is not a valid ISBN as words', () => {
    expect(shapeOf('9780451524936').kind).toBe('text');
    expect(shapeOf('1234567890123').kind).toBe('text');
  });
});
