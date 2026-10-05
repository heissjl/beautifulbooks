/**
 * A Calibre library's books, out of its `metadata.db` (ROADMAP 5.17a).
 *
 * Pure and client-safe: it runs in the reader's browser, on the file they
 * chose, and nothing of the file leaves the device here. Four tables, the
 * same join as the lab tool's `sqlite3` query (lab/calibre/library.ts):
 * `books`, the authors in the order Calibre linked them, and the identifiers
 * of type `isbn`.
 */
import { cleanIsbn, isbn10to13 } from '../normalize';
import { openSqlite, readTable, SqliteError, tables, type Row } from './sqlite';

export interface LibraryBook {
  /** Calibre's book number. */
  id: number;
  title: string;
  /** As Calibre shows them: "Douglas Adams", sometimes "Adams, Douglas". */
  authors: string[];
  /** ISBN-13, from the identifiers of type `isbn`. */
  isbns: string[];
  /** When the book came into the library, as Calibre wrote it; for "the most recently added". */
  added: string;
}

const NEEDED = ['books', 'authors', 'books_authors_link', 'identifiers'] as const;

const num = (v: Row[string]): number => (typeof v === 'number' ? v : Number.NaN);
const str = (v: Row[string]): string => (typeof v === 'string' ? v : '');

/** Every book of the library, in Calibre's order. Throws `SqliteError` with a sentence a reader can act on. */
export function libraryFromDb(input: ArrayBuffer | Uint8Array): LibraryBook[] {
  const file = openSqlite(input);
  const all = tables(file);
  if (NEEDED.some((name) => !all.has(name))) throw new SqliteError('This is an SQLite file, but not a Calibre library — choose metadata.db from the library folder.');
  const get = (name: (typeof NEEDED)[number]) => readTable(file, all.get(name)!);

  const authorName = new Map(get('authors').map((a) => [num(a.id), str(a.name).replace(/\|/g, ',')]));
  const authorsOf = new Map<number, string[]>();
  // Link rows come in rowid order, the order Calibre added them — the order it shows the authors.
  for (const link of get('books_authors_link')) {
    const name = authorName.get(num(link.author));
    if (!name) continue;
    const book = num(link.book);
    authorsOf.set(book, [...(authorsOf.get(book) ?? []), name]);
  }
  const isbnsOf = new Map<number, string[]>();
  for (const id of get('identifiers')) {
    if (str(id.type).toLowerCase() !== 'isbn') continue;
    const clean = cleanIsbn(str(id.val));
    if (!clean) continue;
    const book = num(id.book);
    const list = isbnsOf.get(book) ?? [];
    const isbn = isbn10to13(clean);
    if (!list.includes(isbn)) isbnsOf.set(book, [...list, isbn]);
  }
  return get('books')
    .filter((b) => Number.isInteger(num(b.id)))
    .map((b) => ({
      id: num(b.id),
      title: str(b.title),
      authors: authorsOf.get(num(b.id)) ?? [],
      isbns: isbnsOf.get(num(b.id)) ?? [],
      added: str(b.timestamp),
    }));
}
