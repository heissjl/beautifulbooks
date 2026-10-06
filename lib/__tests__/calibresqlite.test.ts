import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { libraryFromDb } from '../calibre/library';
import { columnsOf, openSqlite, readTable, SqliteError, tables, varint } from '../calibre/sqlite';

// Built from library.sql with sqlite3; page size 512, so 300 rows need interior pages and book 3 needs overflow pages.
const fixture = (name: string) => readFileSync(join(__dirname, '../__fixtures__/calibre', name));
const UTF8 = fixture('library.db');
const UTF16 = fixture('library-utf16.db');

describe('the SQLite reader', () => {
  it('reads the header', () => {
    const f = openSqlite(UTF8);
    expect(f.pageSize).toBe(512);
    expect(f.usable).toBe(512);
    expect(f.wal).toBe(false);
  });

  it('finds the tables, and leaves out indexes and tables without row ids', () => {
    const names = [...tables(openSqlite(UTF8)).values()].map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['books', 'authors', 'books_authors_link', 'identifiers', 'quoted table']));
    expect(names).not.toContain('fts_like');
    expect(names).not.toContain('books_title');
  });

  it('reads every row of a table that spans many pages, in rowid order', () => {
    const f = openSqlite(UTF8);
    const books = readTable(f, tables(f).get('books')!);
    expect(books).toHaveLength(300);
    expect(books.map((b) => b.id)).toEqual(Array.from({ length: 300 }, (_, i) => i + 1));
    expect(books[299]).toMatchObject({ id: 300, title: 'Book 300', series_index: 75, path: 'A/Book 300', last_modified: '2026-10-03' });
    expect(books[1].title).toBe('Der Schnupfen — Katar');
  });

  it('follows a long value onto its overflow pages', () => {
    const f = openSqlite(UTF8);
    const long = readTable(f, tables(f).get('books')!)[2].title as string;
    expect(long).toHaveLength(3005);
    expect(long).toBe(`Long ${'ab'.repeat(1500)}`);
  });

  it('gives a column added later as null on the older rows', () => {
    const f = openSqlite(UTF8);
    const books = readTable(f, tables(f).get('books')!);
    expect(books[0].last_modified).toBeNull();
  });

  it('reads integers of every width, signed, floats and quoted names', () => {
    const f = openSqlite(UTF8);
    const rows = readTable(f, tables(f).get('quoted table')!);
    expect(rows).toEqual([
      { 'a b': 'x', c: -1, d: 2.5 },
      { 'a b': null, c: 281474976710655, d: -0.5 },
      { 'a b': 'y', c: -9007199254740991, d: 0 },
    ]);
  });

  it('reads a UTF-16 file the same', () => {
    expect(libraryFromDb(UTF16)).toEqual(libraryFromDb(UTF8));
  });

  it('reads the column list of a table definition', () => {
    expect(columnsOf('CREATE TABLE t ( id INTEGER PRIMARY KEY, "a, b" TEXT DEFAULT (1,2), [c] INT, UNIQUE(c), CHECK (id > 0))')).toEqual([
      { name: 'id', rowid: true },
      { name: 'a, b', rowid: false },
      { name: 'c', rowid: false },
    ]);
    // Only INTEGER PRIMARY KEY is the rowid; INT PRIMARY KEY is a column of its own.
    expect(columnsOf('CREATE TABLE t (id INT PRIMARY KEY)')[0].rowid).toBe(false);
  });

  it('reads varints up to nine bytes', () => {
    expect(varint(new Uint8Array([0x7f]), 0)).toEqual([127, 1]);
    expect(varint(new Uint8Array([0x81, 0x00]), 0)).toEqual([128, 2]);
    expect(varint(new Uint8Array([0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x81, 0x01]), 0)[1]).toBe(9);
  });

  it('refuses what is not an SQLite file, and a cut-off one, with a sentence', () => {
    expect(() => openSqlite(new TextEncoder().encode('Calibre? '.repeat(20)))).toThrow(SqliteError);
    expect(() => openSqlite(new Uint8Array(10))).toThrow('not an SQLite file');
    expect(() => libraryFromDb(UTF8.subarray(0, 4096))).toThrow(SqliteError);
  });

  it('does not run forever on a page that points at itself', () => {
    const broken = new Uint8Array(UTF8);
    const f = openSqlite(broken);
    const root = tables(f).get('books')!.root;
    // Make the root an interior page whose right-most child is itself.
    const at = (root - 1) * 512;
    broken[at] = 0x05;
    broken[at + 3] = 0;
    broken[at + 4] = 0;
    new DataView(broken.buffer).setUint32(at + 8, root);
    expect(() => readTable(f, tables(f).get('books')!)).toThrow('circle');
  });
});

describe('a Calibre library', () => {
  const books = libraryFromDb(UTF8);

  it('has every book, with its authors in Calibre’s order and its ISBNs as ISBN-13', () => {
    expect(books).toHaveLength(300);
    expect(books[0]).toEqual({ id: 1, title: 'Book 1', authors: ['Douglas Adams'], isbns: ['9780345391803'], added: '2020-01-02 10:00:00+00:00' });
    // The type is matched without case; the other identifier types are not ISBNs.
    expect(books[1]).toMatchObject({ authors: ['Lem, Stanisław'], isbns: ['9788308044379'] });
    // Linked Boris first, then Arkadi: Calibre shows them in that order.
    expect(books[3].authors).toEqual(['Strugatzki, Boris', 'Strugatzki, Arkadi']);
    // Calibre keeps a comma inside a name as `|`.
    expect(books[4].authors).toEqual(['Reed, Thomas C.']);
    expect(books[5]).toMatchObject({ authors: [], isbns: [] });
  });

  it('says when an SQLite file is not a Calibre library', () => {
    const f = openSqlite(UTF8);
    expect(tables(f).has('books')).toBe(true);
    // The same file without its books table, as far as the reader can tell: rename it in sqlite_master.
    const other = new Uint8Array(UTF8);
    const i = Buffer.from(other).indexOf('CREATE TABLE books (');
    other.set(new TextEncoder().encode('CREATE TABLE bookz ('), i);
    const j = Buffer.from(other).indexOf('booksbooks');
    if (j >= 0) other.set(new TextEncoder().encode('bookzbookz'), j);
    expect(() => libraryFromDb(other)).toThrow('not a Calibre library');
  });
});
