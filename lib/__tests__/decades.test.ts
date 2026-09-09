import { describe, expect, it } from 'vitest';
import { decadeLine, groupByDecade, worthAPage } from '../decades';
import type { Cover, Edition } from '../model';

const ed = (over: Partial<Edition> & { id: string }): Edition => ({
  workId: 'OL1W', source: 'openlibrary', title: 'A book', ...over,
});
const cov = (id: string, editionIds: string[]): Cover => ({
  id, url: `u/${id}`, source: 'openlibrary', editionIds,
});

describe('groupByDecade (ROADMAP 5.4a)', () => {
  const editions = [
    ed({ id: 'a', year: 1949, publisher: 'Secker', format: 'hardcover', language: 'en' }),
    ed({ id: 'b', year: 1951, publisher: 'Signet', format: 'paperback', language: 'en' }),
    ed({ id: 'c', year: 1955, publisher: 'Signet', format: 'paperback', language: 'en' }),
    ed({ id: 'd', year: 1984, publisher: 'Penguin', format: 'paperback', language: 'de' }),
    ed({ id: 'e', publisher: 'Unknown' }),
  ];
  const covers = [cov('c1', ['a']), cov('c2', ['b']), cov('c3', ['c']), cov('c4', ['d']), cov('c5', ['e'])];

  it('puts each cover in the decade of its earliest printing', () => {
    const d = groupByDecade(covers, editions);
    expect(d.groups.map(g => g.decade)).toEqual([1940, 1950, 1980]);
    expect(d.groups[1].covers.map(c => c.id)).toEqual(['c2', 'c3']);
    expect(d.from).toBe(1940);
    expect(d.to).toBe(1980);
  });

  it('dates a folded cover by its earliest edition, not its latest reprint', () => {
    const folded = [cov('c', ['b', 'd'])];
    expect(groupByDecade(folded, editions).groups[0].decade).toBe(1950);
  });

  it('keeps a cover without a year instead of dropping it', () => {
    const d = groupByDecade(covers, editions);
    expect(d.undated.map(c => c.id)).toEqual(['c5']);
    expect(d.coverCount).toBe(5);
  });

  it('refuses a page when the data is thin (R6)', () => {
    expect(worthAPage(groupByDecade(covers, editions))).toBe(false);
    const many = Array.from({ length: 20 }, (_, i) => cov(`x${i}`, [`e${i}`]));
    const manyEds = Array.from({ length: 20 }, (_, i) => ed({ id: `e${i}`, year: 1950 + i * 10 }));
    expect(worthAPage(groupByDecade(many, manyEds))).toBe(true);
  });
});

describe('decadeLine', () => {
  const line = (over: Partial<Parameters<typeof decadeLine>[0]>) =>
    decadeLine({ decade: 1950, covers: [], publishers: [], formats: {}, languages: [], editionCount: 0, ...over });

  it('counts and never characterises (R4)', () => {
    const text = line({
      covers: [cov('a', []), cov('b', [])],
      publishers: ['Signet', 'Penguin'],
      formats: { paperback: 3 },
      languages: ['en', 'de'],
      editionCount: 4,
    });
    expect(text).toBe('2 covers · 3 of 4 printings say paperback · 2 publishers, Signet and Penguin among them · 2 languages');
    expect(text).not.toMatch(/iconic|timeless|classic|beloved/i);
  });

  it('says only what it can count when a decade holds little', () => {
    expect(line({ covers: [cov('a', [])], editionCount: 1 })).toBe('1 cover');
  });

  it('never claims completeness (R7)', () => {
    const text = line({ covers: [cov('a', [])], publishers: ['Signet'], editionCount: 1 });
    expect(text).toContain('1 publisher, Signet');
    expect(text).not.toMatch(/\ball\b/i);
    expect(text).not.toMatch(/\bevery\b|\bcomplete\b/i);
  });
});
