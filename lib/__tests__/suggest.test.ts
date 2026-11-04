/**
 * Suggestions while typing (ROADMAP 6.69): every typed word begins a word of
 * the title or the author, accents aside; title start before title before
 * author; the built list is small and complete.
 */
import { describe, expect, it } from 'vitest';
import suggestFile from '../../data/suggest-works.json';
import { PUBLISHED_WORKS } from '../published';
import { parseSuggestRows, suggestWorks, type SuggestedWork } from '../suggest';

const w = (id: string, title: string, author: string): SuggestedWork => ({ id, title, author, coverId: 'ol:1' });
const LIST = [
  w('A', 'Tender Is the Night', 'F. Scott Fitzgerald'),
  w('B', 'The Great Gatsby', 'F. Scott Fitzgerald'),
  w('C', 'Cien años de soledad', 'Gabriel García Márquez'),
  w('D', 'Gatsby’s Girl', 'Caroline Preston'),
];

describe('suggestWorks', () => {
  it('matches word beginnings in title or author, accents and case aside', () => {
    expect(suggestWorks('gatsb', LIST).map(s => s.id)).toEqual(['D', 'B']);
    expect(suggestWorks('garcia marq', LIST).map(s => s.id)).toEqual(['C']);
    expect(suggestWorks('anos', LIST).map(s => s.id)).toEqual(['C']);
  });

  it('puts a title that begins with the words first, then titles, then authors', () => {
    expect(suggestWorks('the great', LIST).map(s => s.id)).toEqual(['B']);
    expect(suggestWorks('fitz', LIST).map(s => s.id)).toEqual(['A', 'B']);
    expect(suggestWorks('t', LIST)).toEqual([]);
  });

  it('needs every word to match', () => {
    expect(suggestWorks('gatsby preston', LIST).map(s => s.id)).toEqual(['D']);
    expect(suggestWorks('gatsby tolkien', LIST)).toEqual([]);
  });
});

describe('the built list', () => {
  const rows = parseSuggestRows(suggestFile.works);

  it('carries every published work with a cover id the image route understands', () => {
    expect(rows.length).toBe(PUBLISHED_WORKS.length);
    for (const r of rows) expect(r.coverId, r.id).toMatch(/^ol:\d+$/);
  });

  it('finds the classics people search for', () => {
    expect(suggestWorks('gravity', rows)[0]?.title).toMatch(/Gravity/);
    expect(suggestWorks('pride and', rows)[0]?.title).toMatch(/Pride and Prejudice/);
  });
});
