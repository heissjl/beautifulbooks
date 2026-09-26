import { describe, expect, it } from 'vitest';
import { chooseVaried, foreignCandidates, foreignWorkLanguage, matchSeparateWork, pickLanguageEdition, sameTitle, sortCandidates, stripNote, surnameOf, translationCandidates, yearOf, type ForeignCandidate, type OlEdition } from '../pick';
import { isbnLanguage, publisherLanguage } from '../evidence';

const rus = [{ key: '/languages/rus' }];
const eng = [{ key: '/languages/eng' }];

describe('yearOf', () => {
  it('reads the latest four-digit year from a free-form date', () => {
    expect(yearOf('1967')).toBe(1967);
    expect(yearOf('May 12, 2003')).toBe(2003);
    expect(yearOf('2003 [i.e. 2004]')).toBe(2004);
    expect(yearOf('n.d.')).toBeNull();
    expect(yearOf(undefined)).toBeNull();
  });
});

describe('pickLanguageEdition', () => {
  it('takes the most recent edition in the language that has a cover, and keeps every candidate', () => {
    const editions: OlEdition[] = [
      { key: '/books/A', languages: rus, covers: [10], publish_date: '1990' },
      { key: '/books/B', languages: rus, covers: [-1, 20, 21], publish_date: '2005' },
      { key: '/books/C', languages: eng, covers: [99], publish_date: '2020' },
      { key: '/books/D', languages: rus, publish_date: '2021' },
      { key: '/books/E', languages: rus, covers: [30] },
    ];
    const pick = pickLanguageEdition(editions, 'rus');
    expect(pick?.edition.key).toBe('/books/B');
    expect(pick?.cover).toBe(20);
    expect(pick?.candidates).toEqual([20, 21, 10, 30]);
  });

  it('answers null when no edition in the language has a positive cover id', () => {
    expect(pickLanguageEdition([{ key: '/books/A', languages: rus, covers: [-1] }, { key: '/books/B', languages: eng, covers: [5] }], 'rus')).toBeNull();
  });

  it('breaks a tie in year by the larger cover id', () => {
    const pick = pickLanguageEdition([
      { key: '/books/A', languages: rus, covers: [10], publish_date: '2001' },
      { key: '/books/B', languages: rus, covers: [50], publish_date: '2001' },
    ], 'rus');
    expect(pick?.edition.key).toBe('/books/B');
  });
});

describe('foreignCandidates', () => {
  it('keeps covers of editions tagged with a named language other than English, with edition and ISBN', () => {
    const got = foreignCandidates([
      { key: '/books/F', languages: [{ key: '/languages/fre' }], covers: [1, -1, 1], publish_date: '1993', isbn_10: ['2207500991'], isbn_13: ['9782207500996'] },
      { key: '/books/E', languages: eng, covers: [2] },
      { key: '/books/N', covers: [3], isbn_13: ['9780575094208'] },
      { key: '/books/B', languages: [{ key: '/languages/ger' }, { key: '/languages/eng' }], covers: [4] },
      { key: '/books/U', languages: [{ key: '/languages/und' }], covers: [5] },
      { key: '/books/R', languages: rus, covers: [6] },
    ]);
    expect(got).toEqual([
      { cover: 1, language: 'fre', edition: '/books/F', publishDate: '1993', isbn: '9782207500996', via: 'tag' },
      { cover: 6, language: 'rus', edition: '/books/R', publishDate: null, isbn: null, via: 'tag' },
    ]);
  });
});

describe('chooseVaried', () => {
  const c = (cover: number, language: string, publishDate: string | null = null, extra: Partial<ForeignCandidate> = {}): ForeignCandidate => ({ cover, language, edition: `/books/${cover}`, publishDate, isbn: null, via: 'tag', ...extra });
  it('prefers a language not yet on the wall, then the most recent, and skips works without candidates', () => {
    const got = chooseVaried([
      [c(1, 'fre', '1990'), c(2, 'ger', '2020')],
      [c(3, 'ger', '2021'), c(4, 'fre', '2022')],
      [],
      [c(5, 'fre', '2000'), c(6, 'ger', '1999')],
    ]);
    expect(got.map(x => x?.cover ?? null)).toEqual([2, 4, null, 5]);
  });

  it('takes a tagged edition whenever there is one, and never one that needs a check', () => {
    const got = chooseVaried([
      [c(1, 'fre')],
      [c(2, 'fre', '1990'), c(3, 'jpn', '2020', { via: 'isbn-group' })],
      [c(4, 'ita', '2020', { via: 'separate-work', needsCheck: true }), c(5, 'ger', '1980', { via: 'publisher' })],
      [c(6, 'spa', null, { via: 'separate-work', needsCheck: true })],
      [c(7, 'tur', null, { via: 'isbn-group', rejected: 'English text' })],
    ]);
    expect(got.map(x => x?.cover ?? null)).toEqual([1, 2, 5, null, null]);
  });

  it('sorts candidates most recent first', () => {
    expect(sortCandidates([c(1, 'fre', '1990'), c(2, 'fre', null), c(3, 'fre', '2001')]).map(x => x.cover)).toEqual([3, 1, 2]);
  });
});

describe('language evidence for an edition without a language field', () => {
  it('reads the ISBN registration group, ISBN-10 included, and skips English and mixed groups', () => {
    expect(isbnLanguage('9783453317673')).toBe('ger');
    expect(isbnLanguage('2207500991')).toBe('fre');
    expect(isbnLanguage('978-84-450-7247-9')).toBe('spa');
    expect(isbnLanguage('9789753427913')).toBe('tur');
    expect(isbnLanguage('9786055555555')).toBe('tur');
    expect(isbnLanguage('9780575094208')).toBeNull();
    expect(isbnLanguage('9798000000000')).toBeNull();
    expect(isbnLanguage('9788170000000')).toBeNull();
    expect(isbnLanguage(undefined)).toBeNull();
  });

  it('knows single-language houses and not English imprints of the same name', () => {
    expect(publisherLanguage(['Wilhelm Heyne Verlag'])).toBe('ger');
    expect(publisherLanguage(["J'ai lu"])).toBe('fre');
    expect(publisherLanguage(['Ediciones Minotauro'])).toBe('spa');
    expect(publisherLanguage(['Эксмо'])).toBe('rus');
    expect(publisherLanguage(['Pocket Books'])).toBeNull();
    expect(publisherLanguage(['Folio Society'])).toBeNull();
  });

  it('uses the ISBN first, then the publisher, only where no language is tagged', () => {
    const got = foreignCandidates([
      { key: '/books/I', covers: [1], isbn_13: ['9783453317673'], publishers: ["J'ai lu"] },
      { key: '/books/P', covers: [2], publishers: ['Denoël'] },
      { key: '/books/T', covers: [3], languages: eng, isbn_13: ['9783453317673'] },
      { key: '/books/X', covers: [4], isbn_13: ['9780575094208'], publishers: ['Gollancz'] },
    ]);
    expect(got.map(g => [g.cover, g.language, g.via])).toEqual([[1, 'ger', 'isbn-group'], [2, 'fre', 'publisher']]);
  });
});

describe('separate translation works', () => {
  const targets = [{ id: 'OL1W', title: 'Do Androids Dream of Electric Sheep?' }, { id: 'OL2W', title: 'Ubik' }];
  it('matches by an untranslated title or by translation_of, and otherwise not at all', () => {
    expect(matchSeparateWork({ key: '/works/A', title: 'Ubik' }, [], targets)).toBe('OL2W');
    expect(matchSeparateWork({ key: '/works/B', title: 'Cacciatore di androidi' }, [{ key: '/books/X', translation_of: 'Do Androids Dream of Electric Sheep?' }], targets)).toBe('OL1W');
    expect(matchSeparateWork({ key: '/works/C', title: 'Blade Runner' }, [{ key: '/books/Y' }], targets)).toBeNull();
  });
  it('counts a work as a translation only when it is tagged and not English', () => {
    expect(foreignWorkLanguage({ key: 'k', title: 't', language: ['ita'] })).toBe('ita');
    expect(foreignWorkLanguage({ key: 'k', title: 't', language: ['ita', 'eng'] })).toBeNull();
    expect(foreignWorkLanguage({ key: 'k', title: 't' })).toBeNull();
  });
});

describe('translated titles', () => {
  it('strips trailing notes, finds the surname, and compares titles strictly', () => {
    expect(stripNote('Blood Music (novel)')).toBe('Blood Music');
    expect(stripNote('Pavane (S.F. Masterworks)')).toBe('Pavane');
    expect(surnameOf('Walter M. Miller, Jr.')).toBe('Miller');
    expect(surnameOf('R. A. Lafferty')).toBe('Lafferty');
    expect(sameTitle('Blutmusik', 'Blutmusik')).toBe(true);
    expect(sameTitle('Licht und Schatten', 'Licht')).toBe(false);
    expect(sameTitle('Le Dieu Baleine : roman', 'Le Dieu Baleine')).toBe(true);
    expect(sameTitle('Die Zeit ist das Feuer. Roman', 'Die Zeit ist das Feuer')).toBe(true);
  });

  it('takes a translation work’s covers but not its English printings', () => {
    const got = translationCandidates([
      { key: '/books/A', covers: [1], languages: [{ key: '/languages/ger' }] },
      { key: '/books/B', covers: [2], languages: eng },
      { key: '/books/C', covers: [3], isbn_13: ['9780575094208'] },
      { key: '/books/D', covers: [4], isbn_13: ['9783453317673'] },
    ], 'ger', 'OL9W', 'wikipedia-langlink');
    expect(got.map(c => [c.cover, c.language, c.match])).toEqual([[1, 'ger', 'wikipedia-langlink'], [4, 'ger', 'wikipedia-langlink']]);
  });
});
