import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { groupByAuthor } from '../searchgroups';
import { parseSearchDocs, type OlSearchDoc } from '../sources/openlibrary-parse';
import { mergeWorks, rankWorks } from '../works';

const FIXTURES = path.join(__dirname, '..', '__fixtures__');

function search(slug: string, query: string) {
  const docs: OlSearchDoc[] = JSON.parse(readFileSync(path.join(FIXTURES, slug, 'openlibrary-search.json'), 'utf8')).docs;
  return rankWorks(mergeWorks(parseSearchDocs(docs)), query);
}

const work = (author: string | undefined, editionCount: number, authorKey?: string) => ({
  authors: author ? [author] : [],
  authorKeys: authorKey ? [authorKey] : undefined,
  editionCount,
});

describe('groupByAuthor on the acceptance searches', () => {
  it('keeps Fitzgerald on top and puts the books about Gatsby below', () => {
    const works = search('the-great-gatsby', 'the great gatsby');
    const { main, others } = groupByAuthor(works);
    expect(main[0].id).toBe(works[0].id);
    expect(main.every(w => w.authors[0] === 'F. Scott Fitzgerald')).toBe(true);
    expect(others.length).toBeGreaterThan(0);
    expect(others.every(w => w.authors[0] !== 'F. Scott Fitzgerald')).toBe(true);
    // Nothing is lost, and each part keeps the ranked order.
    expect(main.length + others.length).toBe(works.length);
    expect(others.map(w => works.indexOf(w))).toEqual([...others.map(w => works.indexOf(w))].sort((a, b) => a - b));
  });

  it('shows the other Mumbo Jumbos as books of their own, below Reed', () => {
    const { main, others } = groupByAuthor(search('mumbo-jumbo', 'mumbo jumbo'));
    expect(main[0].authors[0]).toBe('Ishmael Reed');
    expect(others.some(w => w.authors[0] === 'Kathryn Lasky')).toBe(true);
  });

  it('keeps Orwell above the study guides for 1984', () => {
    const { main, others } = groupByAuthor(search('1984', '1984'));
    expect(main[0].id).toBe('OL1168083W');
    expect(others.some(w => /sparknotes|cliffsnotes/i.test(w.title))).toBe(true);
    expect(main.some(w => /sparknotes|cliffsnotes/i.test(w.title))).toBe(false);
  });
});

describe('groupByAuthor rules', () => {
  it('matches the same author by Open Library key across spellings', () => {
    const { main } = groupByAuthor([work('Fiódor Dostoievski', 1178, 'OL22242A'), work('Fyodor Dostoevsky', 19, 'OL22242A')]);
    expect(main).toHaveLength(2);
  });

  it('keeps a large book by another author on top', () => {
    const large = work('Cesare Beccaria', 164);
    const small = work('James Forman', 6);
    const { main, others } = groupByAuthor([work('Fiódor Dostoievski', 1178), large, small]);
    expect(main).toContain(large);
    expect(others).toEqual([small]);
  });

  it('does not group without an author to anchor on, or with a single card', () => {
    expect(groupByAuthor([work(undefined, 10), work('Someone', 1)]).others).toEqual([]);
    expect(groupByAuthor([work('Unknown', 10), work('Someone', 1)]).others).toEqual([]);
    expect(groupByAuthor([work('Someone', 1)]).others).toEqual([]);
    expect(groupByAuthor([]).main).toEqual([]);
  });
});
