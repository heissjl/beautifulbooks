import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEditions, type OlEditionEntry } from '../sources/openlibrary-parse';
import type { Work } from '../model';

const FIXTURES = path.join(__dirname, '..', '__fixtures__', 'the-great-gatsby');
const gatsby: Work = { id: 'OL468431W', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'] };

describe('audiobooks on the wall (ROADMAP 6.80)', () => {
  const entries = (['openlibrary-editions.json', 'openlibrary-editions-100.json', 'openlibrary-editions-200.json'] as const)
    .flatMap(f => (JSON.parse(readFileSync(path.join(FIXTURES, f), 'utf8')) as { entries: OlEditionEntry[] }).entries);
  const editions = parseEditions(entries, gatsby);

  it('drops the Audible recording whose format says only "Digital"', () => {
    expect(entries.some(e => e.key === '/books/OL40233722M')).toBe(true);
    expect(editions.some(e => e.id === 'ol:OL40233722M')).toBe(false);
    expect(editions.flatMap(e => e.covers.map(c => c.id))).not.toContain('ol:12991845');
  });

  it('keeps no edition from a publisher that only makes recordings', () => {
    expect(editions.filter(e => /audible|audio|h(ö|o)r(buch|verlag)/i.test(e.publisher ?? ''))).toEqual([]);
  });

  it('keeps the printed editions', () => {
    expect(editions.some(e => /scribner/i.test(e.publisher ?? ''))).toBe(true);
  });
});
