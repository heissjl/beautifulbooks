import { describe, expect, it } from 'vitest';
import type { SourceEdition, WorkSummary } from '../model';
import type { EditionCandidate } from '../sources/googlebooks-parse';
import {
  assembleEditions, attachCandidates, candidatesToSourceEditions, editionKey, filterWorksByLanguage,
  foldDuplicateCovers, groupCoversByLanguage, mergeWorks, mosaicCovers, rankWorks, relevance, withoutTranslators,
} from '../works';
import type { Cover } from '../model';

const work = (over: Partial<WorkSummary> & { id: string }): WorkSummary => ({
  title: 'Test Book',
  authors: ['Test Author'],
  coverUrls: [`https://covers.openlibrary.org/b/id/${over.id}-L.jpg`],
  languages: ['en'],
  ...over,
});

/** Source edition with one Open Library cover whose id equals the edition id unless overridden. */
const edition = (over: Partial<SourceEdition> & { id: string }, coverIds: string[] = [over.id]): SourceEdition => ({
  workId: 'W1',
  source: 'openlibrary',
  title: 'Test Book',
  covers: coverIds.map(c => ({ id: `ol:${c}`, url: `https://covers.openlibrary.org/b/id/${c}-L.jpg` })),
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
    covers: [{ id: `gb:${over.id}`, url: `https://books.google.com/${over.id}` }],
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

  it('converts matching candidates to source editions of a known work', () => {
    const eds = candidatesToSourceEditions({ id: 'W', title: '1984', authors: ['George Orwell'] }, [
      gb({ id: 'a' }),
      gb({ id: 'b', authors: ['Aldous Huxley'] }),
    ]);
    expect(eds).toHaveLength(1);
    expect(eds[0].workId).toBe('W');
    expect('authors' in eds[0]).toBe(false);
    expect(eds[0].covers.map(c => c.id)).toEqual(['gb:a']);
  });
});

describe('assembleEditions (E8)', () => {
  it('merges same-ISBN editions across sources but keeps every cover', () => {
    const { editions, covers } = assembleEditions([
      edition({ id: 'ol:1', isbn13: '9780141187761', publisher: 'Penguin' }),
      { ...edition({ id: 'gb:x', isbn13: '9780141187761', source: 'googlebooks', description: 'richer' }), covers: [{ id: 'gb:x', url: 'https://g/x' }] },
      edition({ id: 'ol:3' }),
      edition({ id: 'ol:4', publisher: 'P' }, ['4a', '4b']),
    ]);
    expect(editions.map(e => e.id).sort()).toEqual(['ol:1', 'ol:3', 'ol:4']);
    const merged = editions.find(e => e.id === 'ol:1')!;
    expect(merged.description).toBe('richer');
    expect(merged.publisher).toBe('Penguin');
    expect(covers.map(c => c.id).sort()).toEqual(['gb:x', 'ol:4a', 'ol:4b', 'ol:ol:1', 'ol:ol:3']);
    expect(covers.find(c => c.id === 'gb:x')!.editionIds).toEqual(['ol:1']);
    expect(covers.find(c => c.id === 'ol:ol:1')!.editionIds).toEqual(['ol:1']);
    expect(covers.filter(c => c.editionIds.includes('ol:4'))).toHaveLength(2);
  });
  it('lets one cover carry several editions', () => {
    const { covers } = assembleEditions([
      edition({ id: 'ol:h', isbn13: '9780000000001' }, ['same']),
      edition({ id: 'ol:p', isbn13: '9780000000002' }, ['same']),
    ]);
    expect(covers).toHaveLength(1);
    expect(covers[0].editionIds).toEqual(['ol:h', 'ol:p']);
  });
  it('keys by ISBN, else by source id', () => {
    expect(editionKey({ id: 'x', isbn13: '9780000000002' })).toBe('isbn:9780000000002');
    expect(editionKey({ id: 'x' })).toBe('id:x');
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

describe('groupCoversByLanguage', () => {
  const src = [
    edition({ id: '1', language: 'en', year: 1990 }),
    edition({ id: '2', language: 'en', year: 2020 }),
    edition({ id: '3', language: 'de', year: 2000 }),
    edition({ id: '4' }),
    edition({ id: '5', language: 'fr', year: 2010 }),
    edition({ id: '6', language: 'fr' }),
    edition({ id: '7', language: 'fr', year: 2015 }),
  ];
  const { editions, covers } = assembleEditions(src);
  it('orders by size, unknown last, newest first inside a group', () => {
    const groups = groupCoversByLanguage(covers, editions);
    expect(groups.map(g => g.language)).toEqual(['fr', 'en', 'de', undefined]);
    expect(groups[1].coverIds).toEqual(['ol:2', 'ol:1']);
    expect(groups[0].coverIds).toEqual(['ol:7', 'ol:5', 'ol:6']);
  });
  it('puts the preferred language first', () => {
    expect(groupCoversByLanguage(covers, editions, 'de').map(g => g.language)).toEqual(['de', 'fr', 'en', undefined]);
  });
  it('takes the majority language of a shared cover', () => {
    const shared = assembleEditions([
      edition({ id: 'a', language: 'de' }, ['s']),
      edition({ id: 'b', language: 'en' }, ['s']),
      edition({ id: 'c', language: 'en' }, ['s']),
    ]);
    expect(groupCoversByLanguage(shared.covers, shared.editions)[0].language).toBe('en');
  });
});

describe('withoutTranslators', () => {
  const work = { id: 'W', title: 'Mumbo Jumbo', authors: ['Ishmael Reed', 'Inga Pellisa Díaz', 'Co Author'], authorKeys: ['A', 'T', 'C'] };
  it('drops authors that only occur on editions in another language', () => {
    const eds = [
      edition({ id: '1', language: 'en', authorKeys: ['A'] }),
      edition({ id: '2', language: 'en', authorKeys: ['A', 'C'] }),
      edition({ id: '3', language: 'es', authorKeys: ['A', 'T'] }),
    ];
    expect(withoutTranslators(work, eds).authors).toEqual(['Ishmael Reed', 'Co Author']);
  });
  it('treats editions without language data as no evidence (La Fuga case)', () => {
    const eds = [
      edition({ id: '1', language: 'en', authorKeys: ['A'] }),
      edition({ id: '2', authorKeys: ['A2', 'T', 'C'] }),
    ];
    expect(withoutTranslators(work, eds).authors).toEqual(['Ishmael Reed']);
  });
  it('never drops the first author and keeps authors with no edition evidence', () => {
    const eds = [edition({ id: '1', language: 'en', authorKeys: ['X'] })];
    expect(withoutTranslators({ ...work, authors: ['Only One'], authorKeys: ['A'] }, eds).authors).toEqual(['Only One']);
    expect(withoutTranslators(work, eds).authors).toEqual(work.authors);
  });
  it('returns the work unchanged without keys or without language data', () => {
    expect(withoutTranslators({ ...work, authorKeys: undefined }, [edition({ id: '1', authorKeys: ['A'] })]).authors).toEqual(work.authors);
    expect(withoutTranslators(work, [edition({ id: '1', authorKeys: ['A'] })]).authors).toEqual(work.authors);
  });
});

describe('foldDuplicateCovers (E8 phase 2)', () => {
  const cover = (id: string, editionIds: string[], source: Cover['source'] = 'openlibrary'): Cover =>
    ({ id, url: `https://x/${id}`, source, editionIds });
  const sig = (hash: string, contrast = 40) => ({ hash, contrast });

  it('folds covers within the hamming threshold, unions editions, keeps folded ids', () => {
    const covers = [cover('gb:a', ['e1'], 'googlebooks'), cover('ol:b', ['e2']), cover('ol:c', ['e3']), cover('ol:d', ['e1'])];
    const sigs = new Map([
      ['gb:a', sig('ffff000000000000')],
      ['ol:b', sig('ffff000000000001')], // 1 bit away from a
      ['ol:c', sig('0000ffff00000000')], // far
      ['ol:d', sig('ffff00000000000f')], // 4 bits from a
    ]);
    const out = foldDuplicateCovers(covers, sigs);
    expect(out.map(c => c.id)).toEqual(['ol:b', 'ol:c']);
    const rep = out[0];
    expect(rep.editionIds.sort()).toEqual(['e1', 'e2']);
    expect(rep.similarIds!.sort()).toEqual(['gb:a', 'ol:d']);
    expect(out[1].similarIds).toBeUndefined();
  });

  it('leaves covers without a signature untouched', () => {
    const covers = [cover('ol:a', ['e1']), cover('ol:b', ['e2'])];
    const out = foldDuplicateCovers(covers, new Map([['ol:a', sig('0000000000000000')]]));
    expect(out).toHaveLength(2);
  });

  it('drops blank scans unless they are an edition\'s only cover', () => {
    const covers = [cover('ol:a', ['e1']), cover('ol:blank', ['e1']), cover('ol:only', ['e2'])];
    const sigs = new Map([
      ['ol:a', sig('1111111111111111')],
      ['ol:blank', sig('0000000000000000', 1)],
      ['ol:only', sig('0000000000000000', 1)],
    ]);
    expect(foldDuplicateCovers(covers, sigs).map(c => c.id)).toEqual(['ol:a', 'ol:only']);
  });
});
