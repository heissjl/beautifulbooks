import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CalibreBook } from '../library';
import { booksByWork, loadMap, mapFile, parseMap, writeMap, type WorkMap } from '../map';
import { matchPick } from '../match';
import type { CoverPick } from '../source';

const book = (b: Partial<CalibreBook> & { id: number }): CalibreBook => ({ title: 'T', authors: ['A'], isbns: [], hasCover: true, path: `A/T (${b.id})`, formats: ['EPUB'], ...b });
const pick = (p: Partial<CoverPick>): CoverPick => ({ workId: 'OL1W', coverId: 'ol:1', title: 'T', isbns: [], ...p });
const WALL = 'abcdefghij';
const map = (books: WorkMap['books']): WorkMap => ({ wall: WALL, library: 'Calibre Library-12345678', createdAt: '2026-10-03T12:00:00.000Z', books });

describe('the import’s map (5.17)', () => {
  const guide = pick({ workId: 'OL2163649W', title: "The Hitchhiker's Guide to the Galaxy", author: 'Douglas Adams' });
  const anhalter = book({ id: 5, title: 'Per Anhalter durch die Galaxis', authors: ['Adams, Douglas'] });
  const restaurant = book({ id: 6, title: 'Das Restaurant am Ende des Universums', authors: ['Adams, Douglas'] });

  it('without a map a translated title is only one of the author’s books', () => {
    const m = matchPick(guide, [anhalter, restaurant]);
    expect(m.sure).toBeUndefined();
    expect(m.candidates.map((c) => c.kind)).toEqual(['author', 'author']);
  });

  it('with the map the tile finds the book it was made from, surely and first', () => {
    const m = matchPick(guide, [anhalter, restaurant], booksByWork(map([{ bookId: 5, workId: 'OL2163649W' }])));
    expect(m.sure).toBe(5);
    expect(m.candidates[0]).toEqual({ bookId: 5, kind: 'mapped' });
  });

  it('outranks a book that merely shares title and author', () => {
    const english = book({ id: 9, title: "The Hitchhiker's Guide to the Galaxy", authors: ['Douglas Adams'] });
    const m = matchPick(guide, [anhalter, english], booksByWork(map([{ bookId: 5, workId: 'OL2163649W' }])));
    expect(m.sure).toBe(5);
    expect(m.candidates.map((c) => c.kind)).toEqual(['mapped', 'title+author']);
  });

  it('leaves two books of one work to Julian', () => {
    const second = book({ id: 7, title: 'Per Anhalter durch die Galaxis', authors: ['Adams, Douglas'] });
    const m = matchPick(guide, [anhalter, second], booksByWork(map([{ bookId: 5, workId: 'OL2163649W' }, { bookId: 7, workId: 'OL2163649W' }])));
    expect(m.sure).toBeUndefined();
    expect(m.candidates.map((c) => c.kind)).toEqual(['mapped', 'mapped']);
  });

  it('says nothing about a tile that was added on the site later', () => {
    const other = pick({ workId: 'OL99W', title: 'Per Anhalter durch die Galaxis', author: 'Douglas Adams' });
    const m = matchPick(other, [anhalter], booksByWork(map([{ bookId: 5, workId: 'OL2163649W' }])));
    expect(m.sure).toBe(5);
    expect(m.candidates[0].kind).toBe('title+author');
  });

  it('ignores a mapped book that is no longer in the library', () => {
    const m = matchPick(guide, [restaurant], booksByWork(map([{ bookId: 5, workId: 'OL2163649W' }])));
    expect(m.sure).toBeUndefined();
  });
});

describe('the map file', () => {
  it('goes to disk and comes back, for its collection and its library only', () => {
    const root = mkdtempSync(join(tmpdir(), 'calibre-map-'));
    const written = map([{ bookId: 5, workId: 'OL2163649W' }]);
    const file = writeMap(root, written);
    expect(file).toBe(mapFile(root, WALL));
    expect(loadMap(file, WALL, written.library)).toEqual({ map: written });
    // A rehearsal copy has another key and the same numbers: named by hand, the library is not compared.
    expect(loadMap(file, WALL, null)).toEqual({ map: written });
    expect(loadMap(file, WALL, 'Another-87654321')).toEqual({ none: 'the map was made for another library (Calibre Library-12345678)' });
    expect(loadMap(file, 'zzzzzzzzzz', written.library)).toEqual({ none: `the map is for another collection (${WALL})` });
    expect(loadMap(mapFile(root, 'zzzzzzzzzz'), 'zzzzzzzzzz', written.library)).toEqual({ none: 'no map for this collection' });
  });

  it('refuses a file that is not a map instead of matching by it', () => {
    expect(() => parseMap({ wall: WALL, library: 'L', books: [{ bookId: 5, workId: '../etc' }] })).toThrow();
    expect(() => parseMap({ wall: '../x', library: 'L', books: [] })).toThrow();
    expect(() => parseMap({ wall: WALL, library: 'L', books: [{ bookId: 0, workId: 'OL1W' }] })).toThrow();
    const root = mkdtempSync(join(tmpdir(), 'calibre-map-'));
    const file = join(root, 'broken.json');
    writeFileSync(file, '{ not json');
    expect('none' in loadMap(file, WALL, 'L')).toBe(true);
  });
});
