import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEditions, type OlEditionEntry } from '../../../lib/sources/openlibrary-parse';
import { coversFromEditions } from '../covers';

const fixture = JSON.parse(
  readFileSync(join(__dirname, '../../../lib/__fixtures__/the-great-gatsby/openlibrary-editions.json'), 'utf8'),
) as { entries: OlEditionEntry[] };
const work = { id: 'OL468431W', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'] };

describe('coversFromEditions', () => {
  it('gives one entry per image, newest first, each with at least one printing', () => {
    const covers = coversFromEditions(parseEditions(fixture.entries, work));
    expect(covers.length).toBeGreaterThan(5);
    expect(new Set(covers.map((c) => c.coverId)).size).toBe(covers.length);
    for (const c of covers) expect(c.printings.length).toBeGreaterThan(0);
    const years = covers.map((c) => c.year ?? 0);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });

  it('leaves out an image carried only by an e-book (E21)', () => {
    const covers = coversFromEditions([
      { id: 'ol:1', workId: 'OL1W', source: 'openlibrary', title: 't', format: 'ebook', isbn13: '9780000000002', covers: [{ id: 'ol:11', url: '' }] },
      { id: 'ol:2', workId: 'OL1W', source: 'openlibrary', title: 't', format: 'paperback', year: 1999, covers: [{ id: 'ol:22', url: '' }] },
    ]);
    expect(covers).toEqual([{ coverId: '22', printings: [{ year: 1999 }], year: 1999 }]);
  });
});
