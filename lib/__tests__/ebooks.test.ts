/**
 * Printed books only (E21, ROADMAP 6.35): an e-book's ISBN is never shown,
 * linked or asked about, and a search is not narrowed by an e-book's or a
 * Google band's publisher and year.
 */
import { describe, expect, it } from 'vitest';
import type { SourceEdition } from '../model';
import { assembleEditions } from '../works';
import { searchFacts } from '../buylinks';

const EBOOK = '9780748130986';
const PRINT = '9780349121086';

const ol = (over: Partial<SourceEdition>): SourceEdition =>
  ({ id: 'ol:OL1M', workId: 'OL2943602W', source: 'openlibrary', title: 'Infinite Jest', covers: [{ id: 'ol:1', url: 'https://x/1' }], ...over }) as SourceEdition;
const gb = (over: Partial<SourceEdition>): SourceEdition =>
  ({ id: 'gb:abc', workId: 'OL2943602W', source: 'googlebooks', title: 'Infinite Jest', covers: [{ id: 'gb:abc', url: 'https://x/g' }], ...over }) as SourceEdition;

describe('assembleEditions and e-books', () => {
  it('drops the ISBN of an edition Open Library files as an e-book, and keeps its cover', () => {
    const { editions, covers } = assembleEditions([ol({ format: 'ebook', isbn13: EBOOK })]);
    expect(editions[0].isbn13).toBeUndefined();
    expect(covers.map(c => c.id)).toEqual(['ol:1']);
  });

  it('drops the same number from a Google band that carries it', () => {
    const { editions, covers } = assembleEditions([ol({ format: 'ebook', isbn13: EBOOK }), gb({ isbn13: EBOOK })]);
    expect(editions.every(e => e.isbn13 === undefined)).toBe(true);
    expect(covers).toHaveLength(2);
  });

  it('keeps the ISBN of a printed edition', () => {
    const { editions } = assembleEditions([ol({ format: 'paperback', isbn13: PRINT }), gb({ isbn13: EBOOK })]);
    expect(editions.map(e => e.isbn13).sort()).toEqual([EBOOK, PRINT].sort());
  });
});

describe('searchFacts', () => {
  it('narrows by publisher and year for a printed Open Library record', () => {
    expect(searchFacts({ source: 'openlibrary', format: 'paperback', publisher: 'Little, Brown', year: 2006 }))
      .toEqual({ publisher: 'Little, Brown', year: 2006 });
  });

  it('searches by title and author alone for a Google band', () => {
    expect(searchFacts({ source: 'googlebooks', publisher: 'Hachette UK', year: 2011 })).toEqual({});
  });

  it('searches by title and author alone for an e-book record', () => {
    expect(searchFacts({ source: 'openlibrary', format: 'ebook', publisher: 'Hachette Digital', year: 2011 })).toEqual({});
  });
});
