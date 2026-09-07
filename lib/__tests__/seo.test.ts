/** Wording and structured data for a work page (SPEC §10 D10, lib/seo.ts). */
import { describe, expect, it } from 'vitest';
import { authorLine, bookJsonLd, coverImages, workDescription, workPageTitle } from '../seo';
import type { Cover, Work } from '../model';

const ORWELL: Work = {
  id: 'OL1168083W',
  title: 'Nineteen Eighty-Four',
  authors: ['George Orwell'],
  firstPublishYear: 1949,
  editionCount: 1180,
};

const cover = (id: string): Cover => ({ id, url: `https://covers/${id}.jpg`, source: 'openlibrary', editionIds: [] });

describe('authorLine', () => {
  it('names one or two authors, and counts the rest', () => {
    expect(authorLine(['George Orwell'])).toBe('George Orwell');
    expect(authorLine(['Ann Leckie', 'Adrian Tchaikovsky'])).toBe('Ann Leckie and Adrian Tchaikovsky');
    // Open Library lists translators among the authors (SPEC §2.1), so long
    // lists are summarised rather than printed into a title tag.
    expect(authorLine(['George Orwell', 'A Translator', 'Another', 'A Third'])).toBe('George Orwell and 3 others');
    expect(authorLine([])).toBe('');
  });
});

describe('workPageTitle', () => {
  it('carries title and author, and claims nothing about completeness', () => {
    expect(workPageTitle(ORWELL)).toBe('The covers of Nineteen Eighty-Four by George Orwell');
    expect(workPageTitle({ title: 'Beowulf', authors: [] })).toBe('The covers of Beowulf');
    expect(workPageTitle(ORWELL)).not.toMatch(/\ball\b|\bevery\b|complete/i);
  });
});

describe('workDescription', () => {
  it('quotes the source count and says not every record has an image', () => {
    const text = workDescription(ORWELL);
    expect(text).toContain('Open Library lists 1,180 edition records');
    expect(text).toContain('the ones that carry a cover');
    expect(text).not.toMatch(/\ball\b|\bevery\b|complete/i);
  });

  it('copes with a record that has no edition count', () => {
    const text = workDescription({ title: 'Beowulf', authors: [], editionCount: undefined });
    expect(text.startsWith('Beowulf. ')).toBe(true);
  });
});

describe('coverImages', () => {
  it('takes distinct urls up to the limit', () => {
    const covers = [cover('a'), cover('b'), cover('a'), cover('c'), cover('d'), cover('e')];
    expect(coverImages(covers)).toEqual([
      'https://covers/a.jpg', 'https://covers/b.jpg', 'https://covers/c.jpg', 'https://covers/d.jpg',
    ]);
  });
});

describe('bookJsonLd', () => {
  it('describes the book and points back at the source', () => {
    const json = bookJsonLd(ORWELL, [cover('a')]);
    expect(json).toMatchObject({
      '@type': 'Book',
      name: 'Nineteen Eighty-Four',
      datePublished: '1949',
      sameAs: 'https://openlibrary.org/works/OL1168083W',
      author: [{ '@type': 'Person', name: 'George Orwell' }],
      image: ['https://covers/a.jpg'],
    });
  });

  it('never invents ratings or offers', () => {
    const json = bookJsonLd(ORWELL, []);
    expect(json.aggregateRating).toBeUndefined();
    expect(json.offers).toBeUndefined();
    expect(json.image).toBeUndefined();
  });
});

describe('cover images for a shared link (SPEC §3 F2.13)', () => {
  const cover = (id: string, editionIds: string[]) => ({
    id, url: `https://covers/${id}.jpg`, source: 'openlibrary' as const, editionIds,
  });
  const edition = (id: string, publisher?: string, year?: number) => ({ id, publisher, year });

  it('drops a second scan of the same printing and fills the slot from further down', () => {
    // The Wolf Hall case: the same Spanish edition sat in the catalogue twice
    // and took two of the four tiles in the shared image (2026-09-07).
    const covers = [cover('a', ['e1']), cover('b', ['e2']), cover('c', ['e3']), cover('d', ['e4']), cover('e', ['e5'])];
    const editions = [
      edition('e1', 'Destino', 2011),
      edition('e2', 'Destino', 2011),
      edition('e3', 'Fourth Estate', 2009),
      edition('e4', 'Picador', 2020),
      edition('e5', 'Henry Holt', 2009),
    ];
    expect(coverImages(covers, 4, editions)).toEqual([
      'https://covers/a.jpg', 'https://covers/c.jpg', 'https://covers/d.jpg', 'https://covers/e.jpg',
    ]);
  });

  it('shows a repeat rather than leaving a slot empty', () => {
    const covers = [cover('a', ['e1']), cover('b', ['e2'])];
    const editions = [edition('e1', 'Destino', 2011), edition('e2', 'Destino', 2011)];
    expect(coverImages(covers, 4, editions)).toEqual(['https://covers/a.jpg', 'https://covers/b.jpg']);
  });

  it('keeps covers whose editions are unknown or unpublished-looking', () => {
    const covers = [cover('a', ['e1']), cover('b', ['missing'])];
    expect(coverImages(covers, 4, [edition('e1')])).toEqual(['https://covers/a.jpg', 'https://covers/b.jpg']);
  });

  it('treats the same publisher in different years as different printings', () => {
    const covers = [cover('a', ['e1']), cover('b', ['e2'])];
    const editions = [edition('e1', 'Penguin', 1990), edition('e2', 'Penguin', 2005)];
    expect(coverImages(covers, 4, editions)).toHaveLength(2);
  });
});

describe('one cover per printing, for cards and shared links alike', () => {
  const cover = (id: string, editionIds: string[]) => ({
    id, url: `https://covers/${id}.jpg`, source: 'openlibrary' as const, editionIds,
  });

  it('falls back to the edition record when the publisher is unknown', () => {
    // Four scans of one edition would otherwise fill all four slots.
    const covers = [cover('a', ['e1']), cover('b', ['e1']), cover('c', ['e2']), cover('d', ['e3'])];
    const editions = [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }];
    expect(coverImages(covers, 4, editions)).toEqual([
      'https://covers/a.jpg', 'https://covers/c.jpg', 'https://covers/d.jpg', 'https://covers/b.jpg',
    ]);
  });

  it('without editions it only removes identical URLs, as before', () => {
    const covers = [cover('a', ['e1']), cover('b', ['e2'])];
    expect(coverImages(covers, 4)).toEqual(['https://covers/a.jpg', 'https://covers/b.jpg']);
  });
});
