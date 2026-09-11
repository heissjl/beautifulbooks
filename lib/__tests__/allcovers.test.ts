/**
 * The "All languages" list of a wall (ROADMAP 6.8, lib/works.ts).
 */
import { describe, expect, it } from 'vitest';
import type { Cover, Edition } from '../model';
import { coversNewestFirst, groupCoversByLanguage } from '../works';

const edition = (id: string, language: string | undefined, year: number | undefined) =>
  ({ id, language, year }) as unknown as Edition;
const cover = (id: string, editionId: string): Cover =>
  ({ id, url: `https://x/${id}`, source: 'openlibrary', editionIds: [editionId] });

const editions = [edition('e-en-1996', 'en', 1996), edition('e-de-2011', 'de', 2011), edition('e-it-2006', 'it', 2006), edition('e-none', undefined, undefined)];
const covers = [cover('en', 'e-en-1996'), cover('de', 'e-de-2011'), cover('it', 'e-it-2006'), cover('none', 'e-none')];

describe('coversNewestFirst', () => {
  it('puts every language in one list, newest printing first', () => {
    expect(coversNewestFirst(covers, editions).map(c => c.id)).toEqual(['de', 'it', 'en', 'none']);
  });

  it('holds exactly the covers the language tabs hold', () => {
    const inTabs = groupCoversByLanguage(covers, editions).flatMap(g => g.coverIds).sort();
    expect(coversNewestFirst(covers, editions).map(c => c.id).sort()).toEqual(inTabs);
  });

  it('leaves the input untouched', () => {
    const before = covers.map(c => c.id);
    coversNewestFirst(covers, editions);
    expect(covers.map(c => c.id)).toEqual(before);
  });
});
