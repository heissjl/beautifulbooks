import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WorkSummary } from '../../../lib/model';
import { SourceUnavailableError } from '../../../lib/sources/http';
import type { CalibreBook } from '../../calibre/library';
import type { Tile } from '../../../lib/walls/model';
import { assignAll, assignBook, report, sample, tally, tilesOf, type Assignment, type AssignSources } from '../assign';
import { included, rowsOf } from '../review';
import { Catalogue, DiskCache, editionFromDoc, type CatalogueSources, type OlEditionDoc } from '../lookup';

const book = (b: Partial<CalibreBook> & { id: number }): CalibreBook => ({ title: 'T', authors: ['A B'], isbns: [], hasCover: true, path: `A/T (${b.id})`, formats: ['EPUB'], ...b });
const work = (w: Partial<WorkSummary> & { id: string }): WorkSummary => ({ title: 'T', authors: ['A B'], coverUrls: ['https://covers.openlibrary.org/b/id/111-M.jpg'], languages: ['en'], ...w });

const RAMA = work({ id: 'OL17365W', title: 'Rendezvous with Rama', authors: ['Arthur C. Clarke'], coverUrls: ['https://covers.openlibrary.org/b/id/222-M.jpg'] });
const GUIDE = work({ id: 'OL2163649W', title: "The Hitchhiker's Guide to the Galaxy", authors: ['Douglas Adams'] });
const VIRGIN = work({ id: 'OL45804W', title: 'The Virgin Suicides', authors: ['Jeffrey Eugenides'] });

/** A catalogue that knows a few searches and ISBNs; anything else is an empty answer. */
function sources(found: Record<string, WorkSummary[]>, isbns: Record<string, { workId: string; covers: number[] } | null> = {}): AssignSources & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    isbn: async (isbn) => {
      asked.push(`isbn:${isbn}`);
      return isbns[isbn] ?? null;
    },
    find: async (query) => {
      asked.push(query);
      return found[query] ?? [];
    },
  };
}

describe('assignBook', () => {
  it('takes the ISBN first, with the cover of that very printing and the ISBN as its printing', async () => {
    const s = sources({ 'key:/works/OL17365W': [RAMA] }, { '9780553287899': { workId: 'OL17365W', covers: [333, 444] } });
    const a = await assignBook(book({ id: 340, title: '1974-Rendezvous With Rama', authors: ['Arthur C. Clarke'], isbns: ['9780553287899'] }), s);
    expect(a).toMatchObject({ status: 'match', reason: 'isbn' });
    expect(a.tile).toEqual({ workId: 'OL17365W', coverId: '333', title: 'Rendezvous with Rama', author: 'Arthur C. Clarke', printings: [{ isbn13: '9780553287899' }] });
    // No title search was needed.
    expect(s.asked).toEqual(['isbn:9780553287899', 'key:/works/OL17365W']);
  });

  it('gives an ISBN without a cover the usual cover of the work and no printing', async () => {
    const s = sources({ 'key:/works/OL17365W': [RAMA] }, { '9780553287899': { workId: 'OL17365W', covers: [] } });
    const a = await assignBook(book({ id: 1, title: 'Rendezvous With Rama', authors: ['Arthur C. Clarke'], isbns: ['9780553287899'] }), s);
    expect(a.tile).toMatchObject({ workId: 'OL17365W', coverId: '222', printings: [] });
  });

  it('matches a translated title through its ISBN, because the author agrees', async () => {
    const s = sources({ 'key:/works/OL2163649W': [GUIDE] }, { '9783453146976': { workId: 'OL2163649W', covers: [555] } });
    const a = await assignBook(book({ id: 2, title: 'Per Anhalter durch die Galaxis', authors: ['Adams, Douglas'], isbns: ['9783453146976'] }), s);
    expect(a).toMatchObject({ status: 'match', reason: 'isbn' });
  });

  it('only suggests an ISBN whose work shares neither author nor title with the book', async () => {
    const s = sources({ 'key:/works/OL45804W': [VIRGIN] }, { '9780000000002': { workId: 'OL45804W', covers: [1] } });
    const a = await assignBook(book({ id: 3, title: 'Dune', authors: ['Frank Herbert'], isbns: ['9780000000002'] }), s);
    expect(a).toMatchObject({ status: 'suggestion', reason: 'isbn-only' });
  });

  it('falls back to title and author when the ISBN is unknown', async () => {
    const s = sources({ 'Rendezvous With Rama Arthur C. Clarke': [RAMA] }, { '9780553287899': null });
    const a = await assignBook(book({ id: 4, title: 'Rendezvous With Rama', authors: ['Arthur C. Clarke'], isbns: ['9780553287899'] }), s);
    expect(a).toMatchObject({ status: 'match', reason: 'author+title' });
    expect(a.tile?.printings).toEqual([]);
  });

  it('only suggests the same author under another title', async () => {
    const s = sources({ 'Per Anhalter durch die Galaxis Douglas Adams': [GUIDE] });
    const a = await assignBook(book({ id: 5, title: 'Per Anhalter durch die Galaxis', authors: ['Adams, Douglas'] }), s);
    expect(a).toMatchObject({ status: 'suggestion', reason: 'author' });
  });

  it('only suggests a work whose title merely contains the book’s, and keeps the other way round', async () => {
    const box = work({ id: 'OL20513408W', title: 'MADDADDAM TRILOGY BOX', authors: ['Margaret Atwood'] });
    const a = await assignBook(book({ id: 11, title: 'MaddAddam', authors: ['Margaret Atwood'] }), sources({ 'MaddAddam Margaret Atwood': [box] }));
    expect(a).toMatchObject({ status: 'suggestion', reason: 'author+part' });
    const winnetou = work({ id: 'OL83012W', title: 'Winnetou', authors: ['Karl May'] });
    const b = await assignBook(book({ id: 12, title: 'Winnetou 1', authors: ['Karl May'] }), sources({ 'Winnetou 1 Karl May': [winnetou] }));
    expect(b).toMatchObject({ status: 'match', reason: 'author+title' });
  });

  it('only suggests a title that agrees without its author', async () => {
    const s = sources({ 'The Virgin Suicides': [VIRGIN] });
    const a = await assignBook(book({ id: 6, title: 'The Virgin Suicides', authors: ['Somebody Else'] }), s);
    expect(a).toMatchObject({ status: 'suggestion', reason: 'title-only' });
  });

  it('says not found when the catalogue answers with nothing like it', async () => {
    const a = await assignBook(book({ id: 7, title: 'Ille mihi', authors: ['Elisabeth von Heyking'] }), sources({ 'Ille mihi Elisabeth von Heyking': [VIRGIN] }));
    expect(a.status).toBe('none');
    expect(a.tile).toBeUndefined();
  });

  it('skips a book without an author and asks nothing', async () => {
    const s = sources({});
    expect((await assignBook(book({ id: 8, title: 'README', authors: ['Unknown'] }), s)).status).toBe('skipped');
    expect(s.asked).toEqual([]);
  });

  it('reports silence as no answer, never as not found', async () => {
    const silent: AssignSources = {
      isbn: async () => {
        throw new SourceUnavailableError('openlibrary', new Error('timeout'));
      },
      find: async () => {
        throw new SourceUnavailableError('openlibrary', new Error('timeout'));
      },
    };
    expect((await assignBook(book({ id: 9, title: 'Dune', authors: ['Frank Herbert'] }), silent)).status).toBe('failed');
    expect((await assignBook(book({ id: 10, title: 'Dune', authors: ['Frank Herbert'], isbns: ['9780441172719'] }), silent)).status).toBe('failed');
  });
});

describe('the whole library', () => {
  const books = [
    book({ id: 1, title: 'Rendezvous With Rama', authors: ['Arthur C. Clarke'] }),
    book({ id: 2, title: '1974-Rendezvous With Rama', authors: ['Arthur C. Clarke'] }),
    book({ id: 3, title: 'Per Anhalter durch die Galaxis', authors: ['Douglas Adams'] }),
    book({ id: 4, title: 'README', authors: [] }),
    book({ id: 5, title: 'Ille mihi', authors: ['Elisabeth von Heyking'] }),
  ];
  const s = () => sources({ 'Rendezvous With Rama Arthur C. Clarke': [RAMA], 'Per Anhalter durch die Galaxis Douglas Adams': [GUIDE] });

  it('keeps the order of the library and counts by status and reason', async () => {
    const seen: number[] = [];
    const all = await assignAll(books, s(), (_, done) => seen.push(done));
    expect(all.map((a) => a.bookId)).toEqual([1, 2, 3, 4, 5]);
    expect(seen).toEqual([1, 2, 3, 4, 5]);
    const t = tally(all);
    expect(t).toMatchObject({ books: 5, askable: 4, match: 2, suggestion: 1, none: 1, skipped: 1, failed: 0 });
    expect(t.byReason).toMatchObject({ 'author+title': 2, author: 1 });
    expect(report(all)).toContain('match        2  (50 % of those asked about)');
  });

  it('makes one tile of two copies and keeps both books for the way back', async () => {
    const all = await assignAll(books, s());
    const { tiles, bookWorks } = tilesOf(all.filter((a) => a.status === 'match'));
    expect(tiles.map((t) => t.workId)).toEqual(['OL17365W']);
    expect(bookWorks).toEqual([
      { bookId: 1, workId: 'OL17365W' },
      { bookId: 2, workId: 'OL17365W' },
    ]);
  });

  it('draws the same sample for the same seed', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    expect(sample(items, 10)).toEqual(sample(items, 10));
    expect(new Set(sample(items, 40)).size).toBe(40);
    expect(sample(items, 10, 1)).not.toEqual(sample(items, 10, 2));
  });
});

describe('the catalogue and its cache', () => {
  it('reads an answer as Open Library gave it (recorded 2026-10-03)', () => {
    const doc = JSON.parse(readFileSync(join(__dirname, '../__fixtures__/isbn-9780553287899.json'), 'utf8')) as OlEditionDoc;
    expect(editionFromDoc(doc)).toEqual({ workId: 'OL17417W', covers: [369135] });
  });

  it('reads the work and the covers of an edition, and drops the deleted image', () => {
    expect(editionFromDoc({ works: [{ key: '/works/OL17365W' }], covers: [-1, 333] })).toEqual({ workId: 'OL17365W', covers: [333] });
    expect(editionFromDoc({ works: [{ key: '/works/OL17365W' }] })).toEqual({ workId: 'OL17365W', covers: [] });
    expect(editionFromDoc({ covers: [1] })).toBeNull();
  });

  it('asks each question once, also across runs, and remembers "no such ISBN"', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'calibre-import-')), 'cache.json');
    let calls = 0;
    const live: CatalogueSources = {
      edition: async (isbn) => {
        calls++;
        return isbn === '9780553287899' ? { works: [{ key: '/works/OL17365W' }], covers: [333] } : null;
      },
      works: async () => {
        calls++;
        return [RAMA];
      },
    };
    const first = new Catalogue(new DiskCache(file), live);
    expect(await first.isbn('9780553287899')).toEqual({ workId: 'OL17365W', covers: [333] });
    expect(await first.isbn('9780553287899')).toEqual({ workId: 'OL17365W', covers: [333] });
    expect(await first.isbn('9780000000002')).toBeNull();
    expect(await first.find('Rendezvous With Rama')).toEqual([RAMA]);
    expect(await first.find('rendezvous with rama')).toEqual([RAMA]);
    expect(first.asked).toBe(3);
    // Below ten answers nothing is on disk until the run flushes.
    expect(new DiskCache(file).has('isbn:9780553287899')).toBe(false);

    const second = new DiskCache(file);
    const again = new Catalogue(second, live);
    await again.isbn('9780553287899');
    second.flush();
    expect(Object.keys(JSON.parse(readFileSync(file, 'utf8')) as object)).toEqual(['isbn:9780553287899']);
    const third = new Catalogue(new DiskCache(file), live);
    const before = calls;
    await third.isbn('9780553287899');
    expect(calls).toBe(before);
    expect(third.asked).toBe(0);
  });

  it('keeps nothing when the catalogue is silent, so the next run asks again', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'calibre-import-')), 'cache.json');
    const cache = new DiskCache(file);
    let silent = true;
    const live: CatalogueSources = {
      edition: async () => null,
      works: async () => {
        if (silent) throw new SourceUnavailableError('openlibrary', new Error('timeout'));
        return [RAMA];
      },
    };
    const catalogue = new Catalogue(cache, live);
    await expect(catalogue.find('Dune')).rejects.toThrow();
    expect(cache.has('search:dune')).toBe(false);
    silent = false;
    expect(await catalogue.find('Dune')).toEqual([RAMA]);
  });
});

describe('the review', () => {
  const tileOf = (workId: string): Tile => ({ workId, coverId: '1', title: 'T', printings: [] });
  const books = [book({ id: 1 }), book({ id: 2 }), book({ id: 3 }), book({ id: 4 })];
  const assignments: Assignment[] = [
    { bookId: 1, status: 'match', reason: 'author+title', tile: tileOf('OL1W') },
    { bookId: 2, status: 'suggestion', reason: 'author', tile: tileOf('OL2W') },
    { bookId: 3, status: 'none' },
  ];

  it('ticks matches, leaves suggestions unticked, and knows a book that was never asked about', () => {
    const rows = rowsOf(books, assignments, {});
    expect(rows.map((r) => [r.status, r.include])).toEqual([
      ['match', true],
      ['suggestion', false],
      ['none', false],
      ['unasked', false],
    ]);
    expect(included(rows)).toEqual([{ bookId: 1, tile: tileOf('OL1W') }]);
  });

  it('lets a decision override, and a work chosen by hand replace the catalogue’s', () => {
    const rows = rowsOf(books, assignments, { 1: { include: false }, 2: { include: true }, 3: { tile: tileOf('OL9W') } });
    expect(included(rows).map((r) => [r.bookId, r.tile.workId])).toEqual([
      [2, 'OL2W'],
      [3, 'OL9W'],
    ]);
    expect(rows[2].byHand).toBe(true);
  });

  it('never includes a book without a work, even when it was ticked', () => {
    expect(rowsOf(books, assignments, { 3: { include: true } })[2].include).toBe(false);
  });
});
