import { describe, expect, it } from 'vitest';
import type { Cover, Edition } from '../model';
import { coversNewestFirst, groupCoversByLanguage } from '../works';

const edition = (id: string, language: string | undefined, year: number | undefined): Edition =>
  ({ id, workId: 'OL1W', source: 'openlibrary', title: 'T', language, year });
const cover = (id: string, ...editionIds: string[]): Cover =>
  ({ id, url: `https://covers/${id}`, source: 'openlibrary', editionIds });

const editions = [
  edition('e1', 'en', 1990), edition('e2', 'de', 2010), edition('e3', 'fr', 1965),
  edition('e4', undefined, undefined), edition('e5', 'en', 2021),
];
const covers = [cover('c1', 'e1'), cover('c2', 'e2'), cover('c3', 'e3'), cover('c4', 'e4'), cover('c5', 'e5')];

/** ROADMAP 6.8: the "All languages" tab orders the whole wall as F2.5 orders one tab. */
describe('coversNewestFirst', () => {
  it('puts every cover in one list, newest first across languages, unknown year last', () => {
    expect(coversNewestFirst(covers, editions).map(c => c.id)).toEqual(['c5', 'c2', 'c1', 'c3', 'c4']);
  });

  it('holds exactly the covers the language tabs hold between them', () => {
    const inTabs = groupCoversByLanguage(covers, editions).flatMap(g => g.coverIds).sort();
    expect(coversNewestFirst(covers, editions).map(c => c.id).sort()).toEqual(inTabs);
  });

  it('does not reorder its input', () => {
    const input = [...covers];
    coversNewestFirst(input, editions);
    expect(input.map(c => c.id)).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });
});
