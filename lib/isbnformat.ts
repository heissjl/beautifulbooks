/**
 * ISBN for display (ROADMAP 6.61): hyphenated by the ISBN agency's range
 * table, so the groups — prefix, country, publisher, title, check digit —
 * are visible. Display only: links, lookups and the URL keep the bare
 * 13 digits, and the search strips hyphens again (`cleanIsbn`).
 *
 * The group lengths differ by country and publisher (978-0-14-143947-1,
 * 978-1-5131-3739-1), so they cannot be derived by rule. An ISBN the table
 * does not know is shown as it came, never split at a guessed position.
 */
import ISBN from 'isbn3';

export function hyphenateIsbn(isbn: string): string {
  return ISBN.hyphenate(isbn) || isbn;
}

/**
 * The display text in runs, marking the characters that are set in the
 * monospaced face inside a proportional number: the zero (slashed, so it
 * reads as a digit) and the hyphen (longer, so the groups separate).
 */
export function isbnRuns(isbn: string): { text: string; mono: boolean }[] {
  return hyphenateIsbn(isbn)
    .split(/([0-])/)
    .filter(Boolean)
    .map(text => ({ text, mono: text === '0' || text === '-' }));
}
