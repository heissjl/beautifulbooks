import { describe, expect, it } from 'vitest';
import type { SourceEdition, WorkSummary } from '../model';
import type { EditionCandidate } from '../sources/googlebooks-parse';
import {
  assembleEditions, blurbFor, candidatesToSourceEditions, editionKey, editionSpan, filterWorksByLanguage,
  derivativeIds, foldDuplicateCovers, groupCoversByLanguage, mergeWorks, mosaicCovers, rankWorks,
  relevance, rankContext, samePublisher, verifyIsbnCover, withoutTranslators,
} from '../works';
import type { Cover, Edition } from '../model';

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
  it('joins by Open Library author key as well as by name, and never splits on a key alone (6.15 step 2)', () => {
    const merged = mergeWorks([
      // Reed under two keys (OL27626A, OL11412010A): the names agree, so the
      // works still merge. A key mismatch must not split what the name joins.
      work({ id: 'D', title: 'Mumbo Jumbo', authors: ['Ishmael Reed'], authorKeys: ['OL27626A'], editionCount: 30 }),
      work({ id: 'E', title: 'Mumbo Jumbo', authors: ['Reed, Ishmael'], authorKeys: ['OL11412010A'], editionCount: 1 }),
      // A spelling the loose name key would not join, but the key does.
      work({ id: 'F', title: 'Clown', authors: ['Heinrich Böll'], authorKeys: ['OL2633288A'], editionCount: 8 }),
      work({ id: 'G', title: 'Der Clown', authors: ['H. T. Boll'], authorKeys: ['OL2633288A'], editionCount: 2 }),
      // Different people, different keys, different names: apart.
      work({ id: 'H', title: 'Clown', authors: ['Ann Miller'], authorKeys: ['OL9A'], editionCount: 1 }),
    ]);
    expect(merged.map(w => w.id).sort()).toEqual(['D', 'F', 'H']);
    expect(merged.find(w => w.id === 'D')!.editionCount).toBe(31);
    expect(merged.find(w => w.id === 'F')).toMatchObject({ editionCount: 10, authorKeys: ['OL2633288A'] });
  });
  it('folds a bracketed edition note into the plain title (6.15 step 1)', () => {
    const merged = mergeWorks([
      work({ id: 'A', title: 'Ansichten eines Clowns', authors: ['Heinrich Böll'], editionCount: 8 }),
      work({ id: 'B', title: "Ansichten eines Clowns (Methuen's Twentieth Century German Texts)", authors: ['Heinrich Böll'], editionCount: 2 }),
    ]);
    expect(merged.map(w => w.id)).toEqual(['A']);
    expect(merged[0].editionCount).toBe(10);
  });
});

describe('candidatesToSourceEditions', () => {
  const gb = (over: Partial<EditionCandidate> & { id: string }): EditionCandidate => ({
    source: 'googlebooks',
    title: '1984',
    authors: ['George Orwell'],
    coverUrl: `https://books.google.com/${over.id}`,
    covers: [{ id: `gb:${over.id}`, url: `https://books.google.com/${over.id}` }],
    ...over,
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
  /** As Open Library returns them: rank 0 first, with reading-list counts. */
  const ranked = (list: Array<Partial<WorkSummary> & { id: string }>) =>
    list.map((w, i) => work({ sourceRank: i, ...w }));

  it('keeps the source order unless something argues against it', () => {
    const list = ranked([
      { id: 'N', title: "Gravity's Rainbow", authors: ['Thomas Pynchon'], editionCount: 44, popularity: { readinglog: 353 } },
      { id: 'I', title: "Gravity's rainbow illustrated", authors: ['Zak Smith'], editionCount: 4, popularity: { readinglog: 13 } },
      { id: 'G', title: "A Reader's Guide to Gravity's Rainbow", authors: ['Douglas Fowler'], editionCount: 2, popularity: { readinglog: 3 } },
    ]);
    expect(rankWorks(list, "gravity's rainbow").map(w => w.id)).toEqual(['N', 'I', 'G']);
  });

  it('does not let an exact title beat a far more read work (SPEC 9.1 C)', () => {
    // The real 1984 case: Open Library ranks the novel first, but its title is
    // "Nineteen Eighty-Four", while an eight-edition record is called "1984".
    const list = ranked([
      { id: 'novel', title: 'Nineteen Eighty-Four', authors: ['George Orwell'], editionCount: 537, popularity: { readinglog: 8491 } },
      { id: 'omnibus', title: 'Animal Farm / Nineteen Eighty-Four', authors: ['George Orwell'], editionCount: 37, popularity: { readinglog: 484 } },
      { id: 'adaptation', title: '1984 (adaptation)', authors: ['Michael Dean', 'George Orwell'], editionCount: 4, popularity: { readinglog: 481 } },
      { id: 'translation', title: '1984', authors: ['George Orwell', 'Amélie Audiberti'], editionCount: 8, popularity: { readinglog: 73 } },
      { id: 'sparknotes', title: 'SparkNotes for 1984 by George Orwell', authors: ['Spark Publishing'], editionCount: 4, popularity: { readinglog: 55 } },
    ]);
    const order = rankWorks(list, '1984').map(w => w.id);
    expect(order[0]).toBe('novel');
    expect(order.indexOf('adaptation')).toBeGreaterThan(order.indexOf('translation'));
    expect(order.at(-1)).toBe('sparknotes');
  });

  it('still rewards the exact title when nothing else separates two works', () => {
    const [exact, contains] = ranked([
      { id: 'exact', title: 'Beloved', authors: ['Toni Morrison'], popularity: { readinglog: 100 } },
      { id: 'contains', title: 'Beloved Stranger', authors: ['Elizabeth Oldfield'], popularity: { readinglog: 100 } },
    ]).map(w => ({ ...w, sourceRank: 0 }));
    const ctx = rankContext([exact, contains]);
    expect(relevance(exact, 'beloved', ctx)).toBeGreaterThan(relevance(contains, 'beloved', ctx));
  });

  it('falls back to edition count when no work has reader data', () => {
    const list = ranked([
      { id: 'small', title: 'X', editionCount: 1 },
      { id: 'big', title: 'X', editionCount: 500 },
    ]).map(w => ({ ...w, sourceRank: 0 }));
    const ctx = rankContext(list);
    expect(relevance(list[1], 'x', ctx)).toBeGreaterThan(relevance(list[0], 'x', ctx));
  });
});

describe('derivativeIds', () => {
  it('marks a work whose later author is the primary author of a much larger work', () => {
    const list = [
      work({ id: 'orwell', title: 'Nineteen Eighty-Four', authors: ['George Orwell'], editionCount: 537 }),
      work({ id: 'dean', title: '1984', authors: ['Michael Dean', 'George Orwell'], editionCount: 4 }),
    ];
    expect([...derivativeIds(list)]).toEqual(['dean']);
  });

  it('leaves a co-authored work of comparable size alone', () => {
    const list = [
      work({ id: 'a', title: 'A', authors: ['Ann Author'], editionCount: 40 }),
      work({ id: 'b', title: 'B', authors: ['Bob Writer', 'Ann Author'], editionCount: 30 }),
    ];
    expect(derivativeIds(list).size).toBe(0);
  });

  it('marks titles that announce themselves as an adaptation', () => {
    const list = [
      work({ id: 'austen', title: 'Pride and Prejudice', authors: ['Jane Austen'], editionCount: 4041 }),
      work({ id: 'adapt', title: 'Pride and Prejudice [adaptation]', authors: ['Fern Siegel'], editionCount: 4 }),
      work({ id: 'graphic', title: 'Pride and Prejudice: The Graphic Novel', authors: ['Nancy Butler'], editionCount: 3 }),
    ];
    expect([...derivativeIds(list)].sort()).toEqual(['adapt', 'graphic']);
  });

  // ROADMAP 6.1, all five with the edition counts measured on 2026-09-08.
  it('marks a study that carries the title of a far larger work', () => {
    const list = [
      work({ id: 'novel', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'], editionCount: 1199 }),
      work({ id: 'study', title: 'The Great Gatsby', authors: ['Stephen Matterson'], editionCount: 3 }),
      work({ id: 'about', title: "F. Scott Fitzgerald's the great Gatsby", authors: ['John W. Campbell'], editionCount: 2 }),
    ];
    expect([...derivativeIds(list)].sort()).toEqual(['about', 'study']);
  });

  it('spares a book of its own that happens to share a title', () => {
    // Lars Mytting's Norwegian Wood is about firewood, not about Murakami:
    // five editions against sixty is a twelfth, far under the ratio.
    const list = [
      work({ id: 'murakami', title: 'Norwegian Wood', authors: ['Haruki Murakami'], editionCount: 60 }),
      work({ id: 'mytting', title: 'Norwegian Wood', authors: ['Lars Mytting'], editionCount: 5 }),
      work({ id: 'kennedy', title: 'Sellout', authors: ['Randall Kennedy'], editionCount: 2 }),
      work({ id: 'beatty', title: 'The Sellout', authors: ['Paul Beatty'], editionCount: 10 }),
    ];
    expect(derivativeIds(list).size).toBe(0);
  });

  it('spares the same author writing under another title, however small the record', () => {
    // Kafka's German original has nine editions against 955 for the English
    // Metamorphosis. Only the matching author name keeps it off the pile.
    const list = [
      work({ id: 'en', title: 'Metamorphosis', authors: ['Franz Kafka'], editionCount: 955 }),
      work({ id: 'de', title: 'Die Verwandlung', authors: ['Franz Kafka'], editionCount: 9 }),
      work({ id: 'about', title: 'Franz Kafka, Die Verwandlung', authors: ['Peter U. Beicken'], editionCount: 2 }),
    ];
    expect(derivativeIds(list).has('de')).toBe(false);
  });

  it('recognises the same author under a different transliteration by key', () => {
    // The translator record of Crime and Punishment lists Dostoevsky second
    // and spells him differently from the work it derives from; only the
    // Open Library key ties the two together.
    const list = [
      work({
        id: 'work', title: 'Преступление и наказание', authors: ['Fiódor Dostoievski'],
        authorKeys: ['OL22242A'], editionCount: 1179,
      }),
      work({
        id: 'translator', title: 'Crime and Punishment', authors: ['Michael R. Katz', 'Fyodor Dostoevsky'],
        authorKeys: ['OL1350915A', 'OL22242A'], editionCount: 18,
      }),
      work({
        id: 'english', title: 'Crime and Punishment', authors: ['Fyodor Dostoevsky'],
        authorKeys: ['OL16224933A'], editionCount: 19,
      }),
    ];
    const ids = derivativeIds(list);
    expect(ids.has('translator')).toBe(true);
    // The author's own English record has one key and no second author: it
    // must survive, or the fix would bury the edition it was meant to raise.
    expect(ids.has('english')).toBe(false);
  });

  it('marks a stage version filed under the novelist himself', () => {
    // Alice in Wonderland in Five Acts, one edition, stood first for
    // `alice in wonderland` above Carroll's own 3,547.
    const list = [
      work({ id: 'novel', title: "Alice's Adventures in Wonderland", authors: ['Lewis Carroll'], editionCount: 3547 }),
      work({ id: 'play', title: 'Alice in Wonderland in Five Acts', authors: ['Lewis Carroll'], editionCount: 1 }),
    ];
    expect([...derivativeIds(list)]).toEqual(['play']);
  });
});

describe('rankWorks stability', () => {
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

describe('foldDuplicateCovers (E8 phase 2, three tiers in SPEC 9.3 step 12)', () => {
  const cover = (id: string, editionIds: string[], source: Cover['source'] = 'openlibrary'): Cover =>
    ({ id, url: `https://x/${id}`, source, editionIds });
  const sig = (hash: string, contrast = 40, mean = 120) => ({ hash, contrast, mean });
  const ed = (over: Partial<SourceEdition> & { id: string }) => {
    const { covers, ...rest } = edition(over);
    void covers;
    return rest;
  };

  /** Hashes 12 bits apart: too far for tier 1, close enough for tiers 2 and 3. */
  const NEAR_A = 'ffffff0000000000';
  const NEAR_B = 'ffffff0000000fff';
  /** 24 bits apart: beyond every tier. */
  const FAR = '0000000fffffff00';

  it('folds near-identical images and unions their editions (tier 1)', () => {
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

  it('folds two images of one ISBN that tier 1 would keep apart (tier 2)', () => {
    // Beloved 9788497932653: the catalogue scan and Google's image of the same
    // Debolsillo printing measured 12-14 bits apart.
    const covers = [cover('ol:scan', ['e1']), cover('gb:shop', ['e2'], 'googlebooks')];
    const sigs = new Map([['ol:scan', sig(NEAR_A)], ['gb:shop', sig(NEAR_B)]]);
    const editions = [
      ed({ id: 'e1', isbn13: '9788497932653', publisher: 'Debolsillo', year: 2011, language: 'es' }),
      ed({ id: 'e2', isbn13: '9788497932653', publisher: 'Debolsillo', year: 2011, language: 'es', source: 'googlebooks' }),
    ];
    expect(foldDuplicateCovers(covers, sigs, editions).map(c => c.id)).toEqual(['ol:scan']);
    // Without the edition data the same pair stays apart.
    expect(foldDuplicateCovers(covers, sigs)).toHaveLength(2);
  });

  it('folds scans of one printing by publisher and year (tier 3)', () => {
    // Three Knopf 1987 scans of Beloved, measured 5, 9 and 12 bits apart.
    const covers = [cover('ol:1', ['e1']), cover('ol:2', ['e2']), cover('ol:3', ['e3'])];
    const sigs = new Map([['ol:1', sig(NEAR_A)], ['ol:2', sig(NEAR_B)], ['ol:3', sig('ffffff00000000ff')]]);
    const editions = [
      ed({ id: 'e1', publisher: 'Alfred A. Knopf', year: 1987, language: 'en' }),
      ed({ id: 'e2', publisher: 'Knopf, New York', year: 1987, language: 'en' }),
      ed({ id: 'e3', publisher: 'Alfred A. Knopf', year: 1988, language: 'en' }),
    ];
    expect(foldDuplicateCovers(covers, sigs, editions)).toHaveLength(1);
  });

  it('never folds across publishers beyond tier 1, however alike the artwork', () => {
    // Scribner 2003 and Lulu 2021 both print the public-domain Celestial Eyes
    // jacket of Gatsby; measured 19 bits apart, and they are different books.
    const covers = [cover('ol:scribner', ['e1']), cover('ol:lulu', ['e2'])];
    const sigs = new Map([['ol:scribner', sig(NEAR_A)], ['ol:lulu', sig(NEAR_B)]]);
    const editions = [
      ed({ id: 'e1', publisher: 'Scribner', year: 2003, language: 'en' }),
      ed({ id: 'e2', publisher: 'Lulu.com', year: 2021, language: 'en' }),
    ];
    expect(foldDuplicateCovers(covers, sigs, editions)).toHaveLength(2);
  });

  it('never folds two known languages together', () => {
    const covers = [cover('ol:en', ['e1']), cover('ol:tr', ['e2'])];
    const sigs = new Map([['ol:en', sig(NEAR_A)], ['ol:tr', sig(NEAR_B)]]);
    const editions = [
      ed({ id: 'e1', isbn13: '9780000000001', publisher: 'Same House', year: 2016, language: 'en' }),
      ed({ id: 'e2', isbn13: '9780000000001', publisher: 'Same House', year: 2016, language: 'tr' }),
    ];
    expect(foldDuplicateCovers(covers, sigs, editions)).toHaveLength(2);
  });

  it('keeps genuinely different designs of one printing apart', () => {
    const covers = [cover('ol:1', ['e1']), cover('ol:2', ['e2'])];
    const sigs = new Map([['ol:1', sig(NEAR_A)], ['ol:2', sig(FAR)]]);
    const editions = [
      ed({ id: 'e1', publisher: 'Penguin', year: 2001, language: 'en' }),
      ed({ id: 'e2', publisher: 'Penguin', year: 2001, language: 'en' }),
    ];
    expect(foldDuplicateCovers(covers, sigs, editions)).toHaveLength(2);
  });

  it('leaves covers without a signature untouched', () => {
    const covers = [cover('ol:a', ['e1']), cover('ol:b', ['e2'])];
    const out = foldDuplicateCovers(covers, new Map([['ol:a', sig('0000000000000000')]]));
    expect(out).toHaveLength(2);
  });

  it('keeps every cover, including the ones that look like scanned pages', () => {
    // Measured on two Plume 1998 records of Beloved: mean 249, contrast 12-13.
    // They are shown last rather than dropped, because the same numbers also
    // describe a plain white Greek 1984 that is a real cover.
    const covers = [cover('ol:a', ['e1']), cover('ol:blurb', ['e2'])];
    const sigs = new Map([
      ['ol:a', sig('1111111111111111')],
      ['ol:blurb', sig('e0c0c0c0c0000000', 12.5, 249)],
    ]);
    const editions = [ed({ id: 'e1', publisher: 'Plume', year: 1998 }), ed({ id: 'e2', publisher: 'Plume', year: 1998 })];
    expect(foldDuplicateCovers(covers, sigs, editions).map(c => c.id)).toEqual(['ol:a', 'ol:blurb']);
  });
});

describe('groupCoversByLanguage sorting', () => {
  const cover = (id: string, editionIds: string[]): Cover => ({ id, url: `https://x/${id}`, source: 'openlibrary', editionIds });
  const ed = (over: Partial<SourceEdition> & { id: string }) => {
    const { covers, ...rest } = edition(over);
    void covers;
    return rest;
  };

  it('sorts newest first', () => {
    const covers = [cover('ol:old', ['e1']), cover('ol:new', ['e2'])];
    const editions = [ed({ id: 'e1', year: 1990, language: 'en' }), ed({ id: 'e2', year: 2020, language: 'en' })];
    expect(groupCoversByLanguage(covers, editions)[0].coverIds).toEqual(['ol:new', 'ol:old']);
  });

  it('sends images that look like scanned pages to the end, however new', () => {
    const covers = [cover('ol:page', ['e1']), cover('ol:cover', ['e2'])];
    const editions = [ed({ id: 'e1', year: 2020, language: 'en' }), ed({ id: 'e2', year: 1990, language: 'en' })];
    const sigs = new Map([
      ['ol:page', { hash: 'e0c0c0c0c0000000', contrast: 12.5, mean: 249 }],
      ['ol:cover', { hash: '11d457b5e85d7934', contrast: 25.5, mean: 120 }],
    ]);
    expect(groupCoversByLanguage(covers, editions, undefined, sigs)[0].coverIds).toEqual(['ol:cover', 'ol:page']);
  });
});

describe('samePublisher', () => {
  it('ignores case, place of publication, legal form, initials and the usual nouns', () => {
    expect(samePublisher('Alfred A. Knopf', 'Knopf, New York')).toBe(true);
    expect(samePublisher('Rowohlt Verlag', 'Rowohlt')).toBe(true);
    expect(samePublisher('Vintage Books', 'vintage')).toBe(true);
    expect(samePublisher('Penguin Books Ltd', 'Penguin')).toBe(true);
    expect(samePublisher('Vintage International', 'Vintage')).toBe(true);
  });
  it('keeps different houses apart', () => {
    expect(samePublisher('Scribner', 'Lulu.com')).toBe(false);
    expect(samePublisher('Diogenes', 'Reclam')).toBe(false);
    expect(samePublisher('Debolsillo', 'Alfaguara')).toBe(false);
  });
  it('matches nothing when the publisher is unknown or only noise words', () => {
    expect(samePublisher(undefined, 'Knopf')).toBe(false);
    expect(samePublisher('Books', 'Books')).toBe(false);
  });
});

describe('verifyIsbnCover', () => {
  const cover = (id: string, similarIds?: string[]): Cover =>
    ({ id, url: `https://x/${id}`, source: 'openlibrary', editionIds: ['e1'], ...(similarIds ? { similarIds } : {}) });

  it('waits while the shop has not been asked yet', () => {
    expect(verifyIsbnCover(cover('ol:a'), [], [cover('ol:a')], false)).toEqual({ status: 'pending' });
  });

  it('says nothing is known when the shop has no image for the ISBN', () => {
    expect(verifyIsbnCover(cover('ol:a'), [], [cover('ol:a')], true)).toEqual({ status: 'unknown' });
  });

  it('confirms the cover when the shop image folded into it', () => {
    const selected = cover('ol:a', ['gb:shop']);
    expect(verifyIsbnCover(selected, ['gb:shop'], [selected], true)).toEqual({ status: 'verified' });
  });

  it('confirms it when the shop image is the selected cover itself', () => {
    const selected = cover('gb:shop');
    expect(verifyIsbnCover(selected, ['gb:shop'], [selected], true)).toEqual({ status: 'verified' });
  });

  const sig = {} as unknown as import('../imagesig').ImageSignature;
  const signed = (...ids: string[]) => new Map(ids.map(id => [id, sig]));

  it('reports the other design when the shop image stayed its own tile', () => {
    const selected = cover('ol:scan');
    const shop = cover('gb:shop');
    const verdict = verifyIsbnCover(selected, ['gb:shop'], [selected, shop], true, false, signed('ol:scan', 'gb:shop'));
    expect(verdict).toMatchObject({ status: 'differs' });
    expect((verdict as { cover: Cover }).cover.id).toBe('gb:shop');
  });

  it('follows the shop image into whatever tile it folded into', () => {
    const selected = cover('ol:scan');
    const other = cover('ol:other', ['gb:shop']);
    const verdict = verifyIsbnCover(selected, ['gb:shop'], [selected, other], true, false, signed('ol:scan', 'gb:shop'));
    expect((verdict as { cover: Cover }).cover.id).toBe('ol:other');
  });

  /*
    ROADMAP 6.32, Rowohlt 2011 on 2026-09-10: "a different cover" beside a
    picture that was plainly the same one. Nothing folded because a picture
    could not be fetched — and an unfolded tile read as a different design.
  */
  it('does not call it a different cover when the selected cover has no signature', () => {
    const selected = cover('ol:scan');
    const shop = cover('gb:shop');
    const verdict = verifyIsbnCover(selected, ['gb:shop'], [selected, shop], true, false, signed('gb:shop'));
    expect(verdict).toMatchObject({ status: 'uncompared' });
    expect((verdict as { cover: Cover }).cover.id).toBe('gb:shop');
  });

  it('does not call it a different cover when the shop image has no signature', () => {
    const selected = cover('ol:scan');
    const shop = cover('gb:shop');
    expect(verifyIsbnCover(selected, ['gb:shop'], [selected, shop], true, false, signed('ol:scan')))
      .toMatchObject({ status: 'uncompared' });
  });

  it('compares nothing when no signatures are passed at all', () => {
    const selected = cover('ol:scan');
    const shop = cover('gb:shop');
    expect(verifyIsbnCover(selected, ['gb:shop'], [selected, shop], true)).toMatchObject({ status: 'uncompared' });
  });

  it('counts a signature of any scan folded into the selected cover', () => {
    const selected = cover('ol:scan', ['ol:twin']);
    const shop = cover('gb:shop');
    expect(verifyIsbnCover(selected, ['gb:shop'], [selected, shop], true, false, signed('ol:twin', 'gb:shop')))
      .toMatchObject({ status: 'differs' });
  });

  it('falls back to unknown when the shop image is nowhere on the wall', () => {
    expect(verifyIsbnCover(cover('ol:a'), ['gb:gone'], [cover('ol:a')], true)).toEqual({ status: 'unknown' });
  });
});

describe('blurbFor', () => {
  const ed = (id: string, language: string | undefined, description?: string): Edition => ({
    id, workId: 'OL1W', source: 'openlibrary', title: 'Wolf Hall', language, description,
  });

  it('prefers the wanted language over a longer blurb in another', () => {
    // The measured Wolf Hall case: the longest description is Portuguese.
    const eds = [ed('a', 'pt', 'x'.repeat(927)), ed('b', 'en', 'Thomas Cromwell rises.')];
    expect(blurbFor(eds, 'en')?.edition.id).toBe('b');
  });

  it('falls back to any language when the wanted one has no blurb', () => {
    const eds = [ed('a', 'pt', 'Uma história.'), ed('b', 'en', undefined)];
    const found = blurbFor(eds, 'en');
    expect(found?.edition.id).toBe('a');
    // The caller needs the language to say whose words these are.
    expect(found?.edition.language).toBe('pt');
  });

  it('uses the most common language of the work when none was asked for', () => {
    const eds = [ed('a', 'de', 'Die Geschichte.'), ed('b', 'en', 'The story.'), ed('c', 'en')];
    expect(blurbFor(eds, undefined)?.edition.id).toBe('b');
  });

  it('takes the longest among editions of the same language', () => {
    const eds = [ed('a', 'en', 'Short.'), ed('b', 'en', 'A good deal longer than the other one.')];
    expect(blurbFor(eds, 'en')?.text).toContain('longer');
  });

  it('answers null when no edition carries a description', () => {
    expect(blurbFor([ed('a', 'en'), ed('b', 'de', '   ')], 'en')).toBeNull();
  });
});

describe('editionSpan', () => {
  const ed = (id: string, year?: number, publisher?: string): Edition => ({
    id, workId: 'OL1W', source: 'openlibrary', title: 'Beloved', year, publisher,
  });

  it('names the years and the number of publishers', () => {
    const eds = [ed('a', 1987, 'Knopf'), ed('b', 2025, 'Vintage'), ed('c', 1998, 'Vintage')];
    expect(editionSpan(eds)).toBe('Editions here run from 1987 to 2025, from 2 publishers.');
  });

  it('counts a publisher once however it is spelled around the edges', () => {
    expect(editionSpan([ed('a', 1990, 'Knopf'), ed('b', 1991, ' knopf ')])).toContain('1 publisher.');
  });

  it('does not claim a range when there is only one year', () => {
    // "all from 1987" would be a completeness claim about editions (N12).
    const line = editionSpan([ed('a', 1987, 'Knopf')]);
    expect(line).toBe('Editions here are from 1987, from 1 publisher.');
    expect(line).not.toMatch(/\ball\b|\bevery\b|\bcomplete\b/i);
  });

  it('works with publishers but no years, and with neither', () => {
    expect(editionSpan([ed('a', undefined, 'Knopf')])).toBe('Editions here come from 1 publisher.');
    expect(editionSpan([ed('a')])).toBeNull();
  });

  it('ignores a year that cannot be one', () => {
    expect(editionSpan([ed('a', 12, 'Knopf'), ed('b', 1999, 'Knopf')])).toContain('from 1999');
  });
});
