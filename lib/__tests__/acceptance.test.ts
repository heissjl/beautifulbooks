/**
 * Acceptance criteria from SPEC.md §3 F1, run against recorded Open Library
 * responses in lib/__fixtures__ (see scripts/record-fixtures.ts).
 *
 * Google Books fixtures are absent because the unauthenticated API returned
 * HTTP 429 (daily quota) at recording time. The Google-dependent expectations
 * (extra mosaic covers) are therefore not covered here yet.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { authorMatchKey, normalizeTitle } from '../normalize';
import { parseEditions, parseSearchDocs, type OlEditionEntry, type OlSearchDoc } from '../sources/openlibrary-parse';
import { dedupeEditions, groupEditionsByLanguage, mergeWorks, rankWorks } from '../works';

const FIXTURES = path.join(__dirname, '..', '__fixtures__');

function loadSearch(slug: string): OlSearchDoc[] {
  return JSON.parse(readFileSync(path.join(FIXTURES, slug, 'openlibrary-search.json'), 'utf8')).docs;
}
function loadEditions(slug: string): { workId: string; size: number; entries: OlEditionEntry[] } {
  return JSON.parse(readFileSync(path.join(FIXTURES, slug, 'openlibrary-editions.json'), 'utf8'));
}

function search(slug: string, query: string) {
  return rankWorks(mergeWorks(parseSearchDocs(loadSearch(slug))), query);
}

describe('mumbo jumbo', () => {
  const works = search('mumbo-jumbo', 'mumbo jumbo');
  it('ranks Ishmael Reed first with the most editions', () => {
    expect(works[0].id).toBe('OL30751W');
    expect(works[0].authors[0]).toBe('Ishmael Reed');
    expect(works[0].editionCount).toBeGreaterThanOrEqual(10);
  });
  it('keeps other authors with the same title as separate works', () => {
    const sameTitle = works.filter(w => normalizeTitle(w.title) === 'mumbo jumbo');
    const authors = new Set(sameTitle.map(w => authorMatchKey(w.authors[0])));
    expect(sameTitle.length).toBe(authors.size);
    expect(authors.has('k lasky')).toBe(true);
  });
  it('loads at least 5 editions with covers for the primary work (8 of 23 have covers)', () => {
    const { entries } = loadEditions('mumbo-jumbo');
    const eds = dedupeEditions(parseEditions(entries, works[0]));
    expect(eds.length).toBeGreaterThanOrEqual(5);
    expect(eds.every(e => e.coverUrl.startsWith('https://covers.openlibrary.org/'))).toBe(true);
    expect(eds.every(e => e.workId === 'OL30751W')).toBe(true);
  });
});

describe('1984', () => {
  const works = search('1984', '1984');
  it('ranks Orwell first', () => {
    expect(works[0].authors[0]).toBe('George Orwell');
  });
  it('ranks SparkNotes and other secondary literature below every Orwell work', () => {
    const lastOrwell = works.map(w => w.authors[0]).lastIndexOf('George Orwell');
    const firstGuide = works.findIndex(w => /sparknotes|george orwell's 1984/i.test(w.title));
    expect(firstGuide).toBeGreaterThan(lastOrwell);
  });
  it('keeps translations as editions of the same work, grouped by language', () => {
    const { entries } = loadEditions('1984');
    const eds = dedupeEditions(parseEditions(entries, { id: 'OL1168083W', title: 'Nineteen Eighty-Four', authors: ['George Orwell'] }));
    const groups = groupEditionsByLanguage(eds);
    const codes = groups.map(g => g.language);
    expect(codes).toContain('en');
    expect(codes).toContain('es');
    expect(codes.indexOf(undefined)).toBe(codes.length - 1);
    // Sorted by size; the recorded slice has more Spanish covers than English.
    expect(groups[0].editions.length).toBeGreaterThanOrEqual(groups[1].editions.length);
    expect(groupEditionsByLanguage(eds, 'en')[0].language).toBe('en');
  });
});

describe("gravity's rainbow", () => {
  const works = search('gravitys-rainbow', "gravity's rainbow");
  it('ranks the novel above every study guide and companion', () => {
    expect(works[0].id).toBe('OL2636675W');
    expect(works[0].authors[0]).toBe('Thomas Pynchon');
    const guides = works.filter(w => /companion|guide|approaches|handbook|domination/i.test(w.title));
    expect(guides.length).toBeGreaterThan(0);
    for (const g of guides) expect(works.indexOf(g)).toBeGreaterThan(0);
  });
});

describe('the great gatsby', () => {
  const works = search('the-great-gatsby', 'the great gatsby');
  it('merges the Open Library duplicates into one Fitzgerald work with one id', () => {
    const fitz = works.filter(w => authorMatchKey(w.authors[0]) === 'f fitzgerald' && normalizeTitle(w.title) === 'great gatsby');
    expect(fitz).toHaveLength(1);
    expect(fitz[0].id).toBe('OL468431W');
    expect(fitz[0].editionCount).toBeGreaterThan(1180);
    expect(works[0]).toBe(fitz[0]);
  });
  it('keeps books about Gatsby by other authors separate and below', () => {
    const others = works.filter(w => normalizeTitle(w.title) === 'great gatsby' && authorMatchKey(w.authors[0]) !== 'f fitzgerald');
    expect(others.length).toBeGreaterThan(0);
  });
});

describe('pride and prejudice', () => {
  const works = search('pride-and-prejudice', 'pride and prejudice');
  it('merges Austen into one work at rank one', () => {
    const austen = works.filter(w => authorMatchKey(w.authors[0]) === 'j austen' && normalizeTitle(w.title) === 'pride and prejudice');
    expect(austen).toHaveLength(1);
    expect(austen[0].id).toBe('OL66554W');
    expect(works[0]).toBe(austen[0]);
  });
  it('keeps adaptations and Zombies as separate works', () => {
    expect(works.some(w => /zombies/i.test(w.title))).toBe(true);
    expect(works.some(w => /adaptation/i.test(w.title))).toBe(true);
  });
});
