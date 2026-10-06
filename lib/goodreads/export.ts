/**
 * A Goodreads library export's books (ROADMAP 5.19), out of
 * `goodreads_library_export.csv` (My Books → Import and export → Export Library).
 *
 * Pure and client-safe: it runs in the reader's browser on the file they
 * chose, like `lib/calibre/library.ts` for a Calibre library, and nothing of
 * the file leaves the device here. The site never asks Goodreads anything
 * (ROADMAP 6.11): the reader brings the file, and only title, first author
 * and ISBNs go on to be looked up at Open Library.
 *
 * The file is CSV with a header row; fields with a comma, a quote or a line
 * break are quoted, and a review may span lines. The ISBN columns are written
 * as spreadsheet formulas, `="0743273567"`, and empty as `=""`.
 */
import { cleanIsbn, isbn10to13 } from '../normalize';
import type { LibraryBook } from '../calibre/library';

export interface GoodreadsBook extends LibraryBook {
  /** "read", "currently-reading", "to-read" — every book is on exactly one. */
  shelf: string;
}

export class GoodreadsError extends Error {}

/** Rows of an RFC 4180 CSV; a quoted field may hold commas, doubled quotes and line breaks. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** `="0743273567"` → `0743273567`. */
const unformula = (v: string): string => v.replace(/^=\s*"?/, '').replace(/"$/, '').trim();

/** Every book of the export, in the file's order. Throws `GoodreadsError` when the file is not one. */
export function libraryFromGoodreadsCsv(text: string): GoodreadsBook[] {
  const [header, ...rows] = parseCsv(text);
  const col = new Map((header ?? []).map((name, i) => [name.trim(), i]));
  if (!col.has('Title') || !col.has('Author') || !col.has('Exclusive Shelf')) throw new GoodreadsError('not a Goodreads export');
  const get = (row: string[], name: string): string => {
    const i = col.get(name);
    return i === undefined ? '' : (row[i] ?? '').trim();
  };
  return rows.map((row, i) => {
    const isbns: string[] = [];
    for (const name of ['ISBN13', 'ISBN']) {
      const clean = cleanIsbn(unformula(get(row, name)));
      if (!clean) continue;
      const isbn = isbn10to13(clean);
      if (!isbns.includes(isbn)) isbns.push(isbn);
    }
    const additional = get(row, 'Additional Authors')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    return {
      id: Number(get(row, 'Book Id')) || i + 1,
      title: get(row, 'Title'),
      authors: [get(row, 'Author'), ...additional].filter(Boolean),
      isbns,
      added: get(row, 'Date Added'),
      shelf: get(row, 'Exclusive Shelf') || 'read',
    };
  });
}
