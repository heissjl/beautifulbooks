/**
 * The Calibre library, read and never written (lab/calibre, ROADMAP 5.16).
 *
 * Reading goes through the `sqlite3` command line in **read-only mode**: it
 * cannot change `metadata.db`, and it works while Calibre is open. Writing is
 * not in this file at all — the one write the tool knows is `calibredb
 * set_metadata … --field cover:` in `safety.ts`.
 *
 * The book folder comes from the database, never from a request; `bookDir`
 * still refuses a path that would leave the library.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { cleanIsbn, isbn10to13 } from '../../lib/normalize';

export interface CalibreBook {
  id: number;
  title: string;
  /** As Calibre shows them: "Douglas Adams", sometimes "Adams, Douglas". */
  authors: string[];
  /** ISBN-13, from the identifiers of type `isbn`. */
  isbns: string[];
  hasCover: boolean;
  /** The book's folder, relative to the library. */
  path: string;
  formats: string[];
}

/** One row of QUERY as sqlite3 -json prints it. */
export interface BookRow {
  id: number;
  title: string | null;
  path: string | null;
  has_cover: number | null;
  authors: string | null;
  isbns: string | null;
  formats: string | null;
}

const SEP = String.fromCharCode(31);

export const QUERY = `
select b.id, b.title, b.path, b.has_cover,
  (select group_concat(a.name, char(31)) from books_authors_link l join authors a on a.id = l.author where l.book = b.id) as authors,
  (select group_concat(i.val, char(31)) from identifiers i where i.book = b.id and lower(i.type) = 'isbn') as isbns,
  (select group_concat(d.format, char(31)) from data d where d.book = b.id) as formats
from books b order by b.id`;

const list = (s: string | null): string[] => (s ? s.split(SEP).map((x) => x.trim()).filter(Boolean) : []);

/** Rows to books. Calibre stores a comma inside an author's name as `|`. */
export function booksFromRows(rows: readonly BookRow[]): CalibreBook[] {
  return rows.map((r) => {
    const isbns = list(r.isbns)
      .map((v) => cleanIsbn(v))
      .filter((v): v is string => !!v)
      .map(isbn10to13);
    return {
      id: r.id,
      title: r.title ?? '',
      authors: list(r.authors).map((a) => a.replace(/\|/g, ',')),
      isbns: [...new Set(isbns)],
      hasCover: r.has_cover === 1,
      path: r.path ?? '',
      formats: list(r.formats),
    };
  });
}

/** `--library`, then CALIBRE_LIBRARY, then the library Calibre itself opens. */
export function findLibrary(given?: string): string {
  if (given) return resolve(given);
  if (process.env.CALIBRE_LIBRARY) return resolve(process.env.CALIBRE_LIBRARY);
  const prefs = join(homedir(), 'Library/Preferences/calibre/global.py.json');
  if (existsSync(prefs)) {
    const path = (JSON.parse(readFileSync(prefs, 'utf8')) as { library_path?: string }).library_path;
    if (path) return resolve(path);
  }
  throw new Error('No Calibre library found. Pass --library <folder> or set CALIBRE_LIBRARY.');
}

export function readLibrary(library: string): CalibreBook[] {
  const db = join(library, 'metadata.db');
  if (!existsSync(db)) throw new Error(`No metadata.db in ${library} — this is not a Calibre library.`);
  const out = execFileSync('/usr/bin/sqlite3', ['-readonly', '-json', db, QUERY], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  // sqlite3 prints nothing at all for an empty result.
  return booksFromRows(out.trim() ? (JSON.parse(out) as BookRow[]) : []);
}

/** The folder of a book, or an error when the database names a path outside the library. */
export function bookDir(library: string, book: Pick<CalibreBook, 'path'>): string {
  const root = resolve(library);
  const dir = resolve(root, book.path);
  if (!book.path || !dir.startsWith(root + sep)) throw new Error(`The book's folder is not inside the library: ${book.path}`);
  return dir;
}

export const coverFile = (library: string, book: Pick<CalibreBook, 'path'>): string => join(bookDir(library, book), 'cover.jpg');
