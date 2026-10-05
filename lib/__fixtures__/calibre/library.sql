-- A small Calibre-shaped library for lib/__tests__/calibresqlite.test.ts (ROADMAP 5.17a).
-- Rebuild:  rm -f lib/__fixtures__/calibre/library.db && sqlite3 lib/__fixtures__/calibre/library.db < lib/__fixtures__/calibre/library.sql
-- Page size 512 so that 300 books need interior pages and a long title needs overflow pages.
PRAGMA page_size = 512;
CREATE TABLE books ( id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'Unknown' COLLATE NOCASE,
  sort TEXT COLLATE NOCASE,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  series_index REAL NOT NULL DEFAULT 1.0,
  path TEXT NOT NULL DEFAULT "",
  has_cover BOOL DEFAULT 0);
CREATE TABLE authors ( id INTEGER PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE, sort TEXT COLLATE NOCASE, link TEXT NOT NULL DEFAULT "", UNIQUE(name));
CREATE TABLE books_authors_link ( id INTEGER PRIMARY KEY, book INTEGER NOT NULL, author INTEGER NOT NULL, UNIQUE(book, author));
CREATE TABLE identifiers ( id INTEGER PRIMARY KEY, book INTEGER NOT NULL, type TEXT NOT NULL DEFAULT "isbn" COLLATE NOCASE, val TEXT NOT NULL COLLATE NOCASE, UNIQUE(book, type));
CREATE TABLE "quoted table" ( "a b" TEXT, [c] INTEGER, `d` REAL, CONSTRAINT x UNIQUE (c));
CREATE TABLE fts_like (k TEXT PRIMARY KEY, v BLOB) WITHOUT ROWID;
CREATE INDEX books_title ON books (title);

INSERT INTO authors (id, name) VALUES (1, 'Douglas Adams'), (2, 'Lem, Stanisław'), (3, 'Strugatzki, Arkadi'), (4, 'Strugatzki, Boris'), (5, 'Reed| Thomas C.');
WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 300)
INSERT INTO books (id, title, timestamp, series_index, path) SELECT i, 'Book ' || i, '2020-01-' || printf('%02d', 1 + i % 28) || ' 10:00:00+00:00', i / 4.0, 'A/Book ' || i FROM n;
UPDATE books SET title = 'Der Schnupfen — Katar' WHERE id = 2;
UPDATE books SET title = 'Long ' || replace(hex(zeroblob(1500)), '00', 'ab') WHERE id = 3;
INSERT INTO books_authors_link (book, author) VALUES (1, 1), (2, 2), (4, 4), (4, 3), (5, 5);
INSERT INTO identifiers (book, type, val) VALUES (1, 'isbn', '0-345-39180-2'), (1, 'amazon', 'B000'), (2, 'ISBN', '978-83-08-04437-9'), (4, 'goodreads', '1');
INSERT INTO "quoted table" VALUES ('x', -1, 2.5), (NULL, 281474976710655, -0.5), ('y', -9007199254740991, 0);
INSERT INTO fts_like VALUES ('k', x'00');
-- A column added later: older rows are shorter than the table.
ALTER TABLE books ADD COLUMN last_modified TIMESTAMP;
UPDATE books SET last_modified = '2026-10-03' WHERE id = 300;
