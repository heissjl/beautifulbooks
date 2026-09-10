/**
 * What kind of thing was typed into the search box (ROADMAP 6.29).
 *
 * Measured 2026-09-10 ([docs/suche-isbn-und-stichwort.md](../docs/suche-isbn-und-stichwort.md)):
 * Open Library's ordinary search already answers an ISBN by itself, in every
 * spelling, with exactly one hit. **So this does not route the search
 * anywhere else** — the query still goes to the same place and costs the same
 * one request. It only recognises the *shape* of the input, so that what
 * comes back can be used properly: an ISBN names one edition, and that
 * edition's cover is what the reader came for.
 *
 * Not query parsing (F1.8, deferred): nothing here splits a query into title
 * and author. It answers one question — is this a number that identifies a
 * book, or is it words.
 *
 * Pure, no I/O.
 */
import { cleanIsbn, isbn10to13 } from './normalize';

export type QueryShape =
  /** A valid ISBN-10 or ISBN-13, carried on as an ISBN-13. */
  | { kind: 'isbn'; isbn13: string }
  /** An Open Library work id, pasted straight into the box. */
  | { kind: 'work'; workId: string }
  /** Words. The ordinary case. */
  | { kind: 'text' };

const WORK_ID = /^OL\d+W$/i;

/**
 * Is the check digit right?
 *
 * The check digit is the whole point of recognising an ISBN rather than "a
 * long number": without it a typo is indistinguishable from a book the
 * catalogue does not hold, and the reader is told the wrong thing. Measured:
 * `9780451524936` — one digit off *Nineteen Eighty-Four* — returns nothing
 * from Open Library and reads as "No books found".
 */
export function isValidIsbn(raw: string): boolean {
  const s = cleanIsbn(raw);
  if (!s) return false;

  if (s.length === 13) {
    if (s.includes('X')) return false;
    let sum = 0;
    for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
    return sum % 10 === 0;
  }

  // ISBN-10: the last digit may be X, standing for ten.
  if (s.slice(0, 9).includes('X')) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i);
  sum += s[9] === 'X' ? 10 : Number(s[9]);
  return sum % 11 === 0;
}

/**
 * Reads the shape of a query. Anything not recognised with certainty is
 * `text`, which is what the site did with everything until now — an unsure
 * guess must never send a reader somewhere they did not ask to go.
 */
export function shapeOf(query: string): QueryShape {
  const trimmed = query.trim();
  if (!trimmed) return { kind: 'text' };

  if (WORK_ID.test(trimmed)) return { kind: 'work', workId: trimmed.toUpperCase() };

  // Only if it is *nothing but* an ISBN: "gatsby 9780743273565" is a search.
  if (/^[0-9Xx\s-]+$/.test(trimmed) && isValidIsbn(trimmed)) {
    return { kind: 'isbn', isbn13: isbn10to13(cleanIsbn(trimmed)!) };
  }

  return { kind: 'text' };
}
