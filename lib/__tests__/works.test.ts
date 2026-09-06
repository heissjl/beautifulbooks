import { describe, expect, it } from 'vitest';
import type { Edition, WorkSummary } from '../model';
import type { EditionCandidate } from '../sources/googlebooks-parse';
import {
  attachCandidates, candidatesToEditions, dedupeEditions, editionKey, filterWorksByLanguage,
  groupEditionsByLanguage, mergeWorks, mosaicCovers, rankWorks, relevance,
} from '../works';

const work = (over: Partial<WorkSummary> & { id: string }): WorkSummary => ({
  title: 'Test Book',
  authors: ['Test Author'],
  coverUrls: [`https://covers.openlibrary.org/b/id/${over.id}-L.jpg`],
  languages: ['en'],
  ...over,
});

const edition = (over: Partial<Edition> & { id: string }): Edition => ({
  workId: 'W1',
  source: 'openlibrary',
  title: 'Test Book',
  coverUrl: `https://covers.openlibrary.org/b/id/${over.id}-L.jpg`,
  ...over,
});

describe('mergeWorks', () => {
  it('merges Open Library duplicates by title + primary author, keeping the bigger id', () => {
    const merged = mergeWorks([
      work({ id: 'A', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], editionCount: 1180, languages: ['en', 'de'] }),
      work({ id: 'B', title: 'Great Gatsby', authors: ['F. Scott Fitzgerald'], editionCount: 14, languages: ['zh'] }),
      work({ id: 'C', title: 'The Great Gatsby', authors: ['Stephen Matterson'], editionCount: 3 }),
    ]);
    expect(merged.map(w => w.id).sort()).toEqual(['A', 'C']);
    const a = merged.find(w => w.id === 'A')!;
    expect(a.editionCount).toBe(1194);
    expect(a.coverUrls).toHaveLength(2);
    expect(a.languages.sort()).toEqual(['de', 'en', 'zh']);
  });
  it('does not merge translations as separate works but keeps different authors apart', () => {
    const merged = mergeWorks([
      work({ id: 'A', title: 'Mumbo Jumbo', authors: ['Ishmael Reed'] }),
      work({ id: 'B', title: 'Mumbo jumbo', authors: ['Reed, Ishmael'] }),
      work({ id: 'C', title: 'Mumbo Jumbo', authors: ['Kathryn Lasky'] }),
    ]);
    expect(merged).toHaveLength(2);
  });
});

describe('attachCandidates', () => {
  const gb = (over: Partial<EditionCandidate> & { id: string }): EditionCandidate => ({
    source: 'googlebooks',
    title: '1984',
    authors: ['George Orwell'],
    coverUrl: `https://books.google.com/${over.id}`,
    ...over,
  });

  it('adds covers and languages to a matching work and drops the rest (E5)', () => {
    const works = [work({ id: 'W', title: '1984', authors: ['George Orwell'], languages: ['en'] })];
    const out = attachCandidates(works, [
      gb({ id: 'a', language: 'de' }),
      gb({ id: 'b' }),
      gb({ id: 'c', title: 'Animal Farm' }),
      gb({ id: 'd', authors: ['Someone Else'] }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].coverUrls).toHaveLength(3);
    expect(out[0].languages).toEqual(['en', 'de']);
    expect(works[0].coverUrls).toHaveLength(1); // input untouched
  });

  it('converts matching candidates to editions of a known work', () => {
    const eds = candidatesToEditions({ id: 'W', title: '1984', authors: ['George Orwell'] }, [
      gb({ id: 'a' }),
      gb({ id: 'b', authors: ['Aldous Huxley'] }),
    ]);
    expect(eds).toHaveLength(1);
    expect(eds[0].workId).toBe('W');
    expect('authors' in eds[0]).toBe(false);
  });
});

describe('dedupeEditions', () => {
  it('dedupes by ISBN-13, then cover id, then title+publisher+year, keeping the more complete one', () => {
    const eds = dedupeEditions([
      edition({ id: '1', isbn13: '9780141187761' }),
      edition({ id: '2', isbn13: '9780141187761', description: 'richer', source: 'googlebooks', coverUrl: 'https://books.google.com/x' }),
      edition({ id: '3' }),
      edition({ id: '4', coverUrl: 'https://covers.openlibrary.org/b/id/3-L.jpg', publisher: 'P' }),
      edition({ id: '5', source: 'googlebooks', coverUrl: 'https://books.google.com/y', publisher: 'Penguin', year: 2000 }),
      edition({ id: '6', source: 'googlebooks', coverUrl: 'https://books.google.com/y', publisher: 'Penguin', year: 2000 }),
    ]);
    expect(eds.map(e => e.id).sort()).toEqual(['2', '4', '5']);
  });
  it('builds keys in the documented order', () => {
    expect(editionKey(edition({ id: '9', isbn13: '9780000000002' }))).toBe('isbn:9780000000002');
    expect(editionKey(edition({ id: '9' }))).toBe('cover:9');
    expect(editionKey(edition({ id: '9', source: 'googlebooks', coverUrl: 'https://g/x' }))).toBe('cover:https://g/x');
  });
});

describe('relevance / rankWorks', () => {
  it('orders exact > prefix > substring and penalizes secondary literature', () => {
    const novel = work({ id: 'N', title: "Gravity's Rainbow", authors: ['Thomas Pynchon'], editionCount: 44 });
    const illustrated = work({ id: 'I', title: "Gravity's rainbow illustrated", authors: ['Zak Smith'], editionCount: 4 });
    const guide = work({ id: 'G', title: "A Reader's Guide to Gravity's Rainbow", authors: ['Douglas Fowler'], editionCount: 2 });
    const unrelated = work({ id: 'U', title: 'Maximalist Novel', authors: ['Stefano Ercolino'], editionCount: 400 });
    const q = "gravity's rainbow";
    expect(relevance(novel, q)).toBeGreaterThan(relevance(illustrated, q));
    expect(relevance(illustrated, q)).toBeGreaterThan(relevance(unrelated, q));
    expect(relevance(unrelated, q)).toBeGreaterThan(relevance(guide, q));
    expect(rankWorks([guide, unrelated, illustrated, novel], q).map(w => w.id)).toEqual(['N', 'I', 'U', 'G']);
  });
  it('is stable for equal scores', () => {
    const a = work({ id: 'a', title: 'X' });
    const b = work({ id: 'b', title: 'X' });
    expect(rankWorks([a, b], 'x').map(w => w.id)).toEqual(['a', 'b']);
  });
});

describe('filterWorksByLanguage', () => {
  const works = [
    work({ id: 'en', languages: ['en'] }),
    work({ id: 'de', languages: ['de', 'fr'] }),
    work({ id: 'none', languages: [] }),
  ];
  it('keeps everything for all/undefined', () => {
    expect(filterWorksByLanguage(works, 'all')).toHaveLength(3);
    expect(filterWorksByLanguage(works, undefined)).toHaveLength(3);
  });
  it('keeps works with the language or with no language data', () => {
    expect(filterWorksByLanguage(works, 'de').map(w => w.id)).toEqual(['de', 'none']);
  });
});

describe('mosaicCovers', () => {
  it('returns at most four distinct covers', () => {
    const w = work({ id: 'W', coverUrls: ['a', 'b', 'a', 'c', 'd', 'e'] });
    expect(mosaicCovers(w)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('groupEditionsByLanguage', () => {
  const eds = [
    edition({ id: '1', language: 'en', year: 1990 }),
    edition({ id: '2', language: 'en', year: 2020 }),
    edition({ id: '3', language: 'de', year: 2000 }),
    edition({ id: '4' }),
    edition({ id: '5', language: 'fr', year: 2010 }),
    edition({ id: '6', language: 'fr' }),
    edition({ id: '7', language: 'fr', year: 2015 }),
  ];
  it('orders by size, unknown last, newest first inside a group', () => {
    const groups = groupEditionsByLanguage(eds);
    expect(groups.map(g => g.language)).toEqual(['fr', 'en', 'de', undefined]);
    expect(groups[1].editions.map(e => e.id)).toEqual(['2', '1']);
    expect(groups[0].editions.map(e => e.id)).toEqual(['7', '5', '6']);
  });
  it('puts the preferred language first', () => {
    expect(groupEditionsByLanguage(eds, 'de').map(g => g.language)).toEqual(['de', 'fr', 'en', undefined]);
  });
});
