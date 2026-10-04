import { describe, expect, it, vi } from 'vitest';
import { PNG } from 'pngjs';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CollectionRecord, type PublicWall, type SourceEdition, type WorkSummary } from '../site';
import { pickCovers } from '../covers';
import { CoverSizes } from '../download';
import { cleanBookTitle, firstAuthor, hitFromSummary, proposal, WorkMap } from '../find';
import { checkCover, imageFacts, imageSizeFast, isSmaller } from '../image';
import { bookDir, booksFromRows, type BookRow, type CalibreBook } from '../library';
import { matchPick } from '../match';
import { pocketbookStatus } from '../pocketbook';
import { changedFiles, coverAsGiven, libraryKey, parseJournal, runningCalibre, undoStacks, unexpectedChange, type JournalEntry } from '../safety';
import { imageUrls, parseSourceArg, picksFromCurated, picksFromWall, type CoverPick } from '../source';

const SEP = String.fromCharCode(31);
const row = (r: Partial<BookRow> & { id: number }): BookRow => ({ title: 'T', path: `A/T (${r.id})`, has_cover: 1, authors: 'A', isbns: null, formats: 'EPUB', ...r });
const book = (b: Partial<CalibreBook> & { id: number }): CalibreBook => ({ title: 'T', authors: ['A'], isbns: [], hasCover: true, path: `A/T (${b.id})`, formats: ['EPUB'], languages: [], ...b });
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

  it('reads Calibre’s language codes as the site writes them', () => {
    const [b] = booksFromRows([row({ id: 3, languages: `deu${SEP}eng${SEP}deu${SEP}xxx` })]);
    expect(b.languages).toEqual(['de', 'en']);
    expect(booksFromRows([row({ id: 4 })])[0].languages).toEqual([]);
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

describe('the app: which work a book is', () => {
  it('takes the prefixes of download sites off a title, and nothing else', () => {
    expect(cleanBookTitle('[Philip K. Dick 04] • Flow My Tears, the Policeman Said')).toBe('Flow My Tears, the Policeman Said');
    expect(cleanBookTitle('1974-Rendezvous With Rama')).toBe('Rendezvous With Rama');
    expect(cleanBookTitle('1984')).toBe('1984');
    expect(cleanBookTitle('2001: A Space Odyssey')).toBe('2001: A Space Odyssey');
    expect(cleanBookTitle('Solaris:  A Novel')).toBe('Solaris: A Novel');
    expect(cleanBookTitle('[Untitled]')).toBe('[Untitled]');
  });

  it('does not search for Calibre’s "Unknown"', () => {
    expect(firstAuthor({ authors: ['Unknown'] })).toBe('');
    expect(firstAuthor({ authors: [] })).toBe('');
    expect(firstAuthor({ authors: ['Dick, Philip K.', 'x'] })).toBe('Dick, Philip K.');
  });

  const work = (w: Partial<WorkSummary> & { id: string; title: string }): WorkSummary => ({ authors: ['Philip K. Dick'], coverUrls: [], languages: [], ...w });
  it('proposes a work only when the author agrees or the title does, never the bare first result', () => {
    const works = [work({ id: 'OL1W', title: 'A study guide to Ubik', authors: ['Someone Else'] }), work({ id: 'OL2W', title: 'Ubik' })];
    expect(proposal(works, { title: 'Ubik', author: 'Dick, Philip K.' })).toEqual({ id: 'OL2W', reason: 'author+title' });
    expect(proposal(works, { title: 'Der dunkle Schirm', author: 'Philip K. Dick' })).toEqual({ id: 'OL2W', reason: 'author' });
    expect(proposal(works, { title: 'Middlemarch', author: 'George Eliot' })).toBeNull();
    expect(proposal([], { title: 'Ubik', author: 'Philip K. Dick' })).toBeNull();
  });

  it('shows a search hit with a small picture where the catalogue has one', () => {
    const hit = hitFromSummary(work({ id: 'OL2W', title: 'Ubik', firstPublishYear: 1969, editionCount: 40, coverUrls: ['https://covers.openlibrary.org/b/id/911137-L.jpg'] }));
    expect(hit).toEqual({ id: 'OL2W', title: 'Ubik', author: 'Philip K. Dick', year: 1969, editions: 40, thumb: 'https://covers.openlibrary.org/b/id/911137-M.jpg' });
    expect(hitFromSummary(work({ id: 'OL3W', title: 'X' })).thumb).toBeUndefined();
  });

  it('remembers which work a book is, across runs', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'calibre-map-')), 'deep', 'works.json');
    const map = new WorkMap(file);
    expect(map.get(7)).toBeUndefined();
    map.set(7, 'OL2W');
    map.set(8, 'OL3W');
    map.set(7, 'OL9W');
    expect(new WorkMap(file).all()).toEqual({ 7: 'OL9W', 8: 'OL3W' });
  });
});

describe('the app: the covers of a work', () => {
  const edition = ({ covers, ...e }: Partial<Omit<SourceEdition, 'covers'>> & { id: string; covers: string[] }): SourceEdition => ({
    workId: 'OL1W', source: 'openlibrary', title: 'T', ...e,
    covers: covers.map((id) => ({ id, url: `https://covers.openlibrary.org/b/id/${id.slice(3)}-L.jpg`, urlSmall: `https://covers.openlibrary.org/b/id/${id.slice(3)}-M.jpg` })),
  });

  it('lists each image once, with the languages, years and ISBNs of its printings — e-books included', () => {
    const covers = pickCovers([
      edition({ id: 'ol:OL1M', covers: ['ol:10'], language: 'de', year: 1999, publisher: 'Heyne', isbn13: '9783453000001' }),
      edition({ id: 'ol:OL2M', covers: ['ol:10', 'ol:11'], language: 'en', year: 2005, publisher: 'Gollancz', format: 'ebook' }),
      edition({ id: 'ol:OL3M', covers: ['ol:10'], language: 'de', year: 1987, publisher: 'Heyne' }),
      edition({ id: 'gb:x', covers: ['gb:abc'] }),
    ]);
    expect(covers).toEqual([
      { coverId: 'ol:10', thumb: 'https://covers.openlibrary.org/b/id/10-M.jpg', languages: ['de', 'en'], publishers: ['Heyne', 'Gollancz'], isbns: ['9783453000001'], year: 2005 },
      { coverId: 'ol:11', thumb: 'https://covers.openlibrary.org/b/id/11-M.jpg', languages: ['en'], publishers: ['Gollancz'], isbns: [], year: 2005 },
    ]);
  });
});

describe('the size of a cover from its header', () => {
  it('reads a PNG and a JPEG without decoding them', () => {
    expect(imageSizeFast(png(300, 450))).toEqual({ width: 300, height: 450 });
    // A minimal JPEG: SOI, an APP0 segment to skip, then a baseline frame header saying 475 high, 309 wide.
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xdb, 0x01, 0x35, 0x03, 0x01, 0x22, 0x00]);
    expect(imageSizeFast(jpeg)).toEqual({ width: 309, height: 475 });
  });
  it('says nothing about a file that is neither, or cut off before the frame', () => {
    expect(imageSizeFast(Buffer.from('<html>'))).toBeNull();
    expect(imageSizeFast(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]))).toBeNull();
  });
});

describe('the sizes of the catalogue’s covers', () => {
  it('keeps what was measured across runs, and never asks for it again', async () => {
    vi.useFakeTimers();
    const file = join(mkdtempSync(join(tmpdir(), 'calibre-sizes-')), 'deep', 'cover-sizes.json');
    const sizes = new CoverSizes(file, 'http://localhost');
    expect(sizes.peek('ol:1')).toBeUndefined();
    sizes.remember('ol:1', { width: 754, height: 1200 });
    sizes.remember('ol:2', { width: 128, height: 195 });
    // A second answer for the same cover changes nothing: an id never changes its image.
    sizes.remember('ol:1', { width: 1, height: 1 });
    vi.advanceTimersByTime(2000);
    vi.useRealTimers();
    const again = new CoverSizes(file, 'http://localhost');
    expect(again.peek('ol:1')).toEqual({ width: 754, height: 1200 });
    // Known sizes are answered without a request (there is no network in a test).
    expect(await again.get('ol:2')).toEqual({ width: 128, height: 195 });
    expect(await again.get('not a cover id')).toBeNull();
  });
});

describe('the tool as an area of its own', () => {
  it('reaches the rest of the repository through site.ts and nowhere else', () => {
    const dir = join(__dirname, '..');
    const files = [...readdirSync(dir), ...readdirSync(__dirname).map((f) => `__tests__/${f}`)].filter((f) => f.endsWith('.ts') && f !== 'site.ts');
    const outside = files.filter((f) => /from '(\.\.\/)+(lib|scripts|app|components|data)\//.test(readFileSync(join(dir, f), 'utf8')));
    expect(outside).toEqual([]);
  });
});

describe('the PocketBook sync, offered only when it can run', () => {
  const config = { pocketbook_path: '/Volumes/PB626', obsidian_vault_path: '/notes' };
  const there = (...paths: string[]) => (p: string) => paths.includes(p);

  it('is ready when the script, the reader’s database and the notes folder are there', () => {
    const s = pocketbookStatus('/p/sync_highlights.py', config, there('/Volumes/PB626/system/config/books.db', '/notes'));
    expect(s).toEqual({ script: '/p/sync_highlights.py', reader: '/Volumes/PB626', connected: true, notes: '/notes', problems: [] });
  });

  it('says the reader is not connected — a mounted volume without its database is not enough', () => {
    const s = pocketbookStatus('/p/sync_highlights.py', config, there('/Volumes/PB626', '/notes'));
    expect(s.connected).toBe(false);
    expect(s.problems).toHaveLength(1);
    expect(s.problems[0]).toMatch(/not connected/);
  });

  it('names a missing script, a missing setup and a missing notes folder, each as itself', () => {
    expect(pocketbookStatus(undefined, config, () => true).problems[0]).toMatch(/script was not found/);
    expect(pocketbookStatus('/p/s.py', null, () => true).problems[0]).toMatch(/not set up/);
    expect(pocketbookStatus('/p/s.py', { pocketbook_path: '/r' }, () => true).problems[0]).toMatch(/no notes folder/);
    expect(pocketbookStatus('/p/s.py', config, there('/Volumes/PB626/system/config/books.db')).problems[0]).toMatch(/notes folder is not there/);
    // The newer key of the sync's setup wins over the older one.
    expect(pocketbookStatus('/p/s.py', { ...config, notes_vault_path: '/vault' }, () => true).notes).toBe('/vault');
  });
});
