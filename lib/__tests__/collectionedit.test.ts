import { describe, expect, it } from 'vitest';
import type { CollectionRecord } from '../collections';
import { addAuthor, authorCandidates, inSeries, newCollection, removeAuthor, reorder, slugify, upsertPick } from '../collectionedit';

const base = (): CollectionRecord => ({
  slug: 'women-writers',
  title: 'Women writers',
  kind: 'authors',
  intro: '',
  published: false,
  authors: [{ name: 'Marlen Haushofer', keys: ['OL404610A'] }, { name: 'Mary Shelley', keys: ['OL25342A'] }],
  works: [
    { id: 'OL1W', title: 'A', author: 'Marlen Haushofer', coverId: 'ol:1' },
    { id: 'OL2W', title: 'B', author: 'Mary Shelley', coverId: 'ol:2' },
    { id: 'OL3W', title: 'C', author: 'Mary Shelley', coverId: 'ol:3' },
  ],
});

describe('authorCandidates', () => {
  it('keeps works whose first author is hers, under the collection’s name for her', () => {
    const out = authorCandidates(
      [
        { key: '/works/OL2756289W', title: 'Die Wand', author_key: ['OL404610A'], edition_count: 32, first_publish_year: 1963, cover_i: 5271497 },
        { key: '/works/OL9W', title: 'An anthology', author_key: ['OL1A', 'OL404610A'], edition_count: 90 },
        { key: '/works/OL8W', title: 'No authors' },
        { key: '/works/OL2756289W', title: 'Die Wand again', author_key: ['OL404610A'] },
      ],
      { name: 'Marlen Haushofer', keys: ['OL404610A'] },
    );
    expect(out).toEqual([
      { id: 'OL2756289W', title: 'Die Wand', author: 'Marlen Haushofer', editions: 32, firstPublished: 1963, coverId: 'ol:5271497' },
    ]);
  });
});

describe('inSeries', () => {
  it('matches a confirmed spelling regardless of case and punctuation', () => {
    expect(inSeries(['PENGUIN CLASSICS'], ['Penguin Classics'])).toBe(true);
    expect(inSeries(['Penguin Classics.'], ['Penguin Classics'])).toBe(true);
    expect(inSeries(['Manesse-Verlag'], ['Manesse Verlag'])).toBe(true);
  });

  it('does not let a shorter name claim a longer one', () => {
    expect(inSeries(['Penguin Modern Classics'], ['Penguin Classics'])).toBe(false);
    expect(inSeries(['Penguin'], ['Penguin Classics'])).toBe(false);
    expect(inSeries(undefined, ['Penguin Classics'])).toBe(false);
  });
});

describe('newCollection', () => {
  it('derives the slug and starts as a draft', () => {
    const c = newCollection({ title: 'Penguin Clothbound Classics', kind: 'series' }, []);
    expect(c).toMatchObject({ slug: 'penguin-clothbound-classics', published: false, publishers: [], works: [] });
    expect(slugify('Frauen, die schrieben – Teil 1')).toBe('frauen-die-schrieben-teil-1');
  });

  it('refuses a slug that exists or is not a slug', () => {
    expect(() => newCollection({ title: 'x', slug: 'women-writers', kind: 'authors' }, [base()])).toThrow();
    expect(() => newCollection({ title: 'x', slug: 'Bad Slug', kind: 'authors' }, [])).toThrow();
    expect(() => newCollection({ title: ' ', kind: 'authors' }, [])).toThrow();
  });
});

describe('upsertPick', () => {
  it('appends a new work and changes the cover of a known one in place', () => {
    let c = upsertPick(base(), { id: 'OL4W', title: 'D', author: 'Mary Shelley', coverId: 'ol:4' });
    expect(c.works.map(w => w.id)).toEqual(['OL1W', 'OL2W', 'OL3W', 'OL4W']);
    c = upsertPick(c, { id: 'OL2W', title: 'B', author: 'Mary Shelley', coverId: 'ol:22' });
    expect(c.works.map(w => w.coverId)).toEqual(['ol:1', 'ol:22', 'ol:3', 'ol:4']);
  });

  it('drops the cover credit when the cover changes, keeps it when it does not', () => {
    const credited = { ...base(), works: [{ id: 'OL2W', title: 'B', author: 'Mary Shelley', coverId: 'ol:2', coverIsbn: '1857988116', coverArtists: ['John Harris'], isfdbRecord: '7127' }] };
    const same = upsertPick(credited, { id: 'OL2W', title: 'B', author: 'Mary Shelley', coverId: 'ol:2' });
    expect(same.works[0]).toMatchObject({ coverArtists: ['John Harris'], coverIsbn: '1857988116' });
    const swapped = upsertPick(credited, { id: 'OL2W', title: 'B', author: 'Mary Shelley', coverId: 'ol:99' });
    expect(swapped.works[0].coverArtists).toBeUndefined();
    expect(swapped.works[0].coverIsbn).toBeUndefined();
    expect(swapped.works[0].isfdbRecord).toBeUndefined();
  });

  it('refuses a work by an author who is not on the list', () => {
    expect(() => upsertPick(base(), { id: 'OL5W', title: 'E', author: 'Virginia Woolf', coverId: 'ol:5' })).toThrow(/list of authors/);
  });
});

describe('reorder', () => {
  it('never drops a work a stale page left out', () => {
    const c = reorder(base(), ['OL3W', 'OL404W', 'OL1W']);
    expect(c.works.map(w => w.id)).toEqual(['OL3W', 'OL1W', 'OL2W']);
  });
});

describe('authors', () => {
  it('removing an author takes her works off the wall', () => {
    const c = removeAuthor(base(), 'Mary Shelley');
    expect(c.authors?.map(a => a.name)).toEqual(['Marlen Haushofer']);
    expect(c.works.map(w => w.id)).toEqual(['OL1W']);
  });

  it('adding a known name merges the keys', () => {
    const c = addAuthor(base(), { name: 'Mary Shelley', keys: ['OL13677969A', 'OL25342A'] });
    expect(c.authors?.find(a => a.name === 'Mary Shelley')?.keys).toEqual(['OL25342A', 'OL13677969A']);
  });
});
