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
