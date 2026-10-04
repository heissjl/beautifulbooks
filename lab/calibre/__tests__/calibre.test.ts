import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import type { CollectionRecord } from '../../../lib/collections';
import type { PublicWall } from '../../../lib/walls/model';
import { checkCover, imageFacts, isSmaller } from '../image';
import { bookDir, booksFromRows, type BookRow, type CalibreBook } from '../library';
import { matchPick } from '../match';
import { changedFiles, coverAsGiven, libraryKey, parseJournal, runningCalibre, undoStacks, unexpectedChange, type JournalEntry } from '../safety';
import { imageUrls, parseSourceArg, picksFromCurated, picksFromWall, type CoverPick } from '../source';

const SEP = String.fromCharCode(31);
const row = (r: Partial<BookRow> & { id: number }): BookRow => ({ title: 'T', path: `A/T (${r.id})`, has_cover: 1, authors: 'A', isbns: null, formats: 'EPUB', ...r });
const book = (b: Partial<CalibreBook> & { id: number }): CalibreBook => ({ title: 'T', authors: ['A'], isbns: [], hasCover: true, path: `A/T (${b.id})`, formats: ['EPUB'], ...b });
const pick = (p: Partial<CoverPick>): CoverPick => ({ workId: 'OL1W', coverId: 'ol:1', title: 'T', isbns: [], ...p });

function png(width: number, height: number): Buffer {
  const img = new PNG({ width, height });
  img.data.fill(200);
  return PNG.sync.write(img);
}

describe('reading the library', () => {
  it('turns rows into books: authors with commas, ISBN-10 as ISBN-13, no duplicates', () => {
    const [b] = booksFromRows([row({ id: 7, title: 'Dune', authors: `Herbert| Frank${SEP}Kevin J. Anderson`, isbns: `0441172717${SEP}978-0-441-17271-9${SEP}junk`, formats: `EPUB${SEP}MOBI` })]);
    expect(b.authors).toEqual(['Herbert, Frank', 'Kevin J. Anderson']);
    expect(b.isbns).toEqual(['9780441172719']);
    expect(b.formats).toEqual(['EPUB', 'MOBI']);
    expect(b.hasCover).toBe(true);
  });

  it('survives a book without authors, identifiers or formats', () => {
    const [b] = booksFromRows([row({ id: 2, authors: null, isbns: null, formats: null, has_cover: 0 })]);
    expect(b).toMatchObject({ authors: [], isbns: [], formats: [], hasCover: false });
  });

  it('refuses a book folder outside the library', () => {
    expect(() => bookDir('/lib', { path: '../elsewhere' })).toThrow();
    expect(() => bookDir('/lib', { path: '' })).toThrow();
    expect(bookDir('/lib', { path: 'A/T (1)' })).toBe('/lib/A/T (1)');
  });
});

describe('matching a cover to a book', () => {
  const books = [
    book({ id: 1, title: 'Dune', authors: ['Herbert, Frank'], isbns: ['9780441172719'] }),
    book({ id: 2, title: 'Per Anhalter durch die Galaxis', authors: ['Douglas Adams'] }),
    book({ id: 3, title: 'The Restaurant at the End of the Universe', authors: ['Adams, Douglas'] }),
    book({ id: 4, title: 'Emma', authors: ['Charlotte Brontë'] }),
    book({ id: 5, title: 'Solaris: A Novel', authors: ['Stanisław Lem'] }),
  ];

  it('is sure by a shared ISBN, whatever the title says', () => {
    const m = matchPick(pick({ title: 'Der Wüstenplanet', author: 'Frank Herbert', isbns: ['9780441172719'] }), books);
    expect(m.sure).toBe(1);
    expect(m.candidates[0]).toEqual({ bookId: 1, kind: 'isbn' });
  });

  it('is sure by the same title and author, with the name in either order', () => {
    expect(matchPick(pick({ title: 'Dune', author: 'Frank Herbert' }), books).sure).toBe(1);
    expect(matchPick(pick({ title: 'The Restaurant at the End of the Universe', author: 'Douglas Adams' }), books).sure).toBe(3);
  });

  it('only suggests the same title under another author', () => {
    const m = matchPick(pick({ title: 'Emma', author: 'Jane Austen' }), books);
    expect(m.sure).toBeUndefined();
    expect(m.candidates).toEqual([{ bookId: 4, kind: 'maybe' }]);
  });

  it('offers the author’s books for a translated title, and writes none by itself', () => {
    const m = matchPick(pick({ title: "The Hitchhiker's Guide to the Galaxy", author: 'Douglas Adams' }), books);
    expect(m.sure).toBeUndefined();
    expect(m.candidates.map((c) => c.kind)).toEqual(['author', 'author']);
  });

  it('is not sure when two copies of the book are in the library', () => {
    const twice = [...books, book({ id: 9, title: 'Dune', authors: ['Frank Herbert'] })];
    const m = matchPick(pick({ title: 'Dune', author: 'Frank Herbert' }), twice);
    expect(m.sure).toBeUndefined();
    expect(m.candidates.map((c) => c.bookId)).toEqual([1, 9]);
  });

  it('finds nothing for a book that is not there', () => {
    expect(matchPick(pick({ title: 'Ulysses', author: 'James Joyce' }), books).candidates).toEqual([]);
  });
});

describe('the collection as a list of covers', () => {
  it('reads a reader’s collection: site cover ids, ISBNs of the printings', () => {
    const wall: PublicWall = {
      id: 'abcdefghij', title: 'Mine', columns: 4, createdOn: '2026-10-01', updatedAt: '2026-10-01',
      tiles: [
        { workId: 'OL1W', coverId: '8231856', title: 'Dune', author: 'Frank Herbert', printings: [{ isbn10: '0441172717' }, { isbn13: '9780441172719' }, {}] },
        { workId: 'OL2W', coverId: 'gb:abc_DEF', title: 'Emma', printings: [] },
      ],
    };
    const s = picksFromWall(wall);
    expect(s.picks[0]).toEqual({ workId: 'OL1W', coverId: 'ol:8231856', title: 'Dune', author: 'Frank Herbert', isbns: ['9780441172719'] });
    expect(s.picks[1].coverId).toBe('gb:abc_DEF');
  });

  it('reads a curated collection and leaves out the site’s own images', () => {
    const record = {
      slug: 'x', title: 'X', kind: 'series', intro: '', published: true,
      works: [
        { id: 'OL1W', title: 'A', author: 'An Author', coverId: 'ol:12', coverIsbn: '9780886775926', coverWork: 'OL9W' },
        { id: 'OL2W', title: 'B', author: 'B Author', coverId: 'local:verne-1', image: '/collection-covers/x/verne-1.jpg' },
      ],
    } as unknown as CollectionRecord;
    const s = picksFromCurated(record);
    expect(s.picks).toEqual([{ workId: 'OL9W', coverId: 'ol:12', title: 'A', author: 'An Author', isbns: ['9780886775926'] }]);
    expect(s.skipped).toHaveLength(1);
  });

  it('tells an address, an id and a slug apart', () => {
    const slugs = ['sf-masterworks', 'abcdefghij'];
    expect(parseSourceArg('https://buyitscovers.com/c/k3j9x0aa1b', slugs)).toEqual({ kind: 'wall', id: 'k3j9x0aa1b' });
    expect(parseSourceArg('https://buyitscovers.com/c/k3j9x0aa1b/edit', slugs)).toEqual({ kind: 'wall', id: 'k3j9x0aa1b' });
    expect(parseSourceArg('k3j9x0aa1b', slugs)).toEqual({ kind: 'wall', id: 'k3j9x0aa1b' });
    expect(parseSourceArg('https://buyitscovers.com/collections/sf-masterworks', slugs)).toEqual({ kind: 'curated', slug: 'sf-masterworks' });
    // A curated slug wins over the shape of an id.
    expect(parseSourceArg('abcdefghij', slugs)).toEqual({ kind: 'curated', slug: 'abcdefghij' });
    expect(parseSourceArg('no such thing', slugs)).toBeNull();
  });

  it('builds image addresses from the id alone', () => {
    expect(imageUrls('ol:123')).toEqual(['https://covers.openlibrary.org/b/id/123.jpg?default=false', 'https://covers.openlibrary.org/b/id/123-L.jpg?default=false']);
    expect(imageUrls('gb:abc')[0]).toContain('books.google.com/books/content?id=abc');
    expect(imageUrls('ol:../../etc')).toEqual([]);
    expect(imageUrls('gb:')).toEqual([]);
    expect(imageUrls('gb:a b&id=x')).toEqual([]);
    expect(imageUrls('https://evil.example/x.jpg')).toEqual([]);
  });
});

describe('the image check', () => {
  it('accepts a cover-sized picture and says what it is', () => {
    expect(checkCover(png(300, 450))).toMatchObject({ ok: true, format: 'png', width: 300, height: 450 });
  });
  it('refuses an error page, a thumbnail and half a file', () => {
    expect(checkCover(Buffer.from('<html>503</html>')).ok).toBe(false);
    expect(checkCover(png(40, 60)).ok).toBe(false);
    const whole = png(300, 450);
    expect(checkCover(whole.subarray(0, Math.floor(whole.length / 2))).ok).toBe(false);
  });
  it('describes any picture, and compares by pixels', () => {
    expect(imageFacts(png(40, 60))).toMatchObject({ width: 40, height: 60 });
    expect(isSmaller({ width: 300, height: 450 }, { width: 600, height: 800 })).toBe(true);
    expect(isSmaller({ width: 600, height: 900 }, { width: 600, height: 800 })).toBe(false);
    // The same scan cropped by a hair is not a loss.
    expect(isSmaller({ width: 322, height: 500 }, { width: 325, height: 500 })).toBe(false);
  });
});

describe('the guards around a write', () => {
  it('sees Calibre by program name, not by a path that contains the word', () => {
    const ps = ['/sbin/launchd', '/Applications/calibre.app/Contents/MacOS/calibre', '/usr/local/bin/node', '/Applications/calibre.app/Contents/MacOS/ebook-viewer'].join('\n');
    expect(runningCalibre(ps)).toEqual(['calibre']);
    // This tool's own process: node running …/lab/calibre/serve.ts.
    expect(runningCalibre('/usr/local/bin/node\n/Users/j/lab/calibre/node')).toEqual([]);
    expect(runningCalibre('calibre-server\ncalibre-server')).toEqual(['calibre-server']);
  });

  it('keeps a journal per library, even for a copy with the same name', () => {
    expect(libraryKey('/a/Calibre Library')).not.toBe(libraryKey('/b/Calibre Library'));
    expect(libraryKey('/a/Calibre Library')).toMatch(/^Calibre Library-[0-9a-f]{8}$/);
  });

  const before = [book({ id: 1 }), book({ id: 2, hasCover: false })];
  it('accepts a write that changed one cover flag and nothing else', () => {
    expect(unexpectedChange(before, [book({ id: 1 }), book({ id: 2, hasCover: true })], 2)).toBeNull();
    expect(unexpectedChange(before, before, 1)).toBeNull();
  });
  it('names a lost book, a changed title, a touched bystander and a missing cover', () => {
    expect(unexpectedChange(before, [book({ id: 1 })], 1)).toMatch(/2 books and now has 1/);
    expect(unexpectedChange(before, [book({ id: 1 }), book({ id: 3 })], 1)).toMatch(/book 2/);
    expect(unexpectedChange(before, [book({ id: 1, title: 'Other' }), before[1]], 1)).toMatch(/more than its cover/);
    expect(unexpectedChange(before, [book({ id: 1, formats: [] }), before[1]], 1)).toMatch(/more than its cover/);
    expect(unexpectedChange(before, [book({ id: 1 }), book({ id: 2, hasCover: true })], 1)).toMatch(/another book/);
    expect(unexpectedChange(before, before, 2)).toMatch(/no cover after/);
  });

  it('notices a touched e-book file, and not a file iCloud moved in or out', () => {
    const f = { name: 'x.epub', local: true, size: 10, mtimeMs: 1 };
    expect(changedFiles([f], [f])).toBeNull();
    expect(changedFiles([f], [{ ...f, size: 11 }])).toMatch(/modified/);
    expect(changedFiles([f], [])).toMatch(/gone/);
    expect(changedFiles([], [f])).toMatch(/appeared/);
    expect(changedFiles([{ ...f, local: false, size: 1 }], [f])).toBeNull();
  });

  it('accepts the cover Calibre wrote when it is the picture it was given', () => {
    expect(coverAsGiven({ width: 400, height: 600 }, { width: 400, height: 600 })).toBe(true);
    // Calibre shrinks a cover above its maximum; the proportions stay.
    expect(coverAsGiven({ width: 1467, height: 2200 }, { width: 2000, height: 3000 })).toBe(true);
    expect(coverAsGiven({ width: 600, height: 800 }, { width: 400, height: 600 })).toBe(false);
    expect(coverAsGiven({ width: 800, height: 1200 }, { width: 400, height: 600 })).toBe(false);
  });

  it('walks back through the journal one finished write at a time', () => {
    const e = (action: 'apply' | 'undo', state: JournalEntry['state'], bookId: number, coverId: string): JournalEntry => ({ at: 't', action, state, bookId, title: 'T', coverId, backup: `/b/${coverId}` });
    const journal = [e('apply', 'start', 1, 'ol:1'), e('apply', 'done', 1, 'ol:1'), e('apply', 'done', 1, 'ol:2'), e('apply', 'failed', 1, 'ol:3'), e('apply', 'done', 2, 'ol:9'), e('undo', 'done', 2, 'backup')];
    const stacks = undoStacks(journal);
    expect(stacks.get(1)?.map((x) => x.coverId)).toEqual(['ol:1', 'ol:2']);
    expect(stacks.has(2)).toBe(false);
    expect(undoStacks([...journal, e('undo', 'done', 1, 'backup')]).get(1)?.map((x) => x.coverId)).toEqual(['ol:1']);
  });

  it('reads a journal whose last line was cut off', () => {
    expect(parseJournal('{"bookId":1,"state":"done","action":"apply"}\n{"bookId":2,"sta')).toHaveLength(1);
  });
});
