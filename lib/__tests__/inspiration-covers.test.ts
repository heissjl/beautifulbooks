import { describe, expect, it } from 'vitest';
import { coversOfEditions, garbled } from '../inspiration/covers';
import type { SourceEdition } from '../model';

const edition = (over: Partial<SourceEdition> & { coverIds: string[] }): SourceEdition => ({
  id: `e${Math.random()}`,
  workId: 'OL1W',
  title: 'T',
  authors: ['A'],
  source: 'openlibrary',
  covers: over.coverIds.map(id => ({ id, url: `https://covers.openlibrary.org/b/id/${id.slice(3)}-M.jpg` })),
  ...over,
} as SourceEdition);

describe('coversOfEditions', () => {
  it('gives one entry per image, named by its newest printing, newest first', () => {
    const covers = coversOfEditions([
      edition({ coverIds: ['ol:1'], year: 1974, publisher: 'Harcourt' }),
      edition({ coverIds: ['ol:2'], year: 1997, publisher: 'Vintage' }),
      edition({ coverIds: ['ol:1'], year: 1978, publisher: 'Harvest' }),
    ]);
    expect(covers).toEqual([
      { coverId: 'ol:2', year: 1997, publisher: 'Vintage' },
      { coverId: 'ol:1', year: 1978, publisher: 'Harvest' },
    ]);
  });

  it('leaves out e-books, and an image only an e-book carries', () => {
    const covers = coversOfEditions([
      edition({ coverIds: ['ol:9'], year: 2020, format: 'ebook' }),
      edition({ coverIds: ['ol:3'], year: 1990 }),
    ]);
    expect(covers.map(c => c.coverId)).toEqual(['ol:3']);
  });

  it('takes every cover of an edition and keeps a cover without a year, last', () => {
    const covers = coversOfEditions([
      edition({ coverIds: ['ol:4', 'ol:5'], publisher: 'Unknown Press' }),
      edition({ coverIds: ['ol:6'], year: 1950 }),
    ]);
    expect(covers.map(c => c.coverId)).toEqual(['ol:6', 'ol:4', 'ol:5']);
    expect(covers[1]).toEqual({ coverId: 'ol:4', publisher: 'Unknown Press' });
  });

  it('leaves out a publisher whose letters were lost, and keeps the year', () => {
    expect(garbled('Do?u Bat? Yay?nlar?')).toBe(true);
    expect(garbled('Can Yay\uFFFDnlar\u0131')).toBe(true);
    for (const fine of ['Can Yayınları', 'Penguin Random House', 'Who? Press', 'S. Fischer']) expect(garbled(fine)).toBe(false);
    expect(coversOfEditions([edition({ coverIds: ['ol:7'], year: 2017, publisher: 'Do?u Bat? Yay?nlar?' })])).toEqual([{ coverId: 'ol:7', year: 2017 }]);
  });

  it('ignores a cover that is not an Open Library image', () => {
    expect(coversOfEditions([edition({ coverIds: ['gb:abc'], year: 2001 })])).toEqual([]);
  });
});
