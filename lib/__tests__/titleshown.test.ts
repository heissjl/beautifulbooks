/**
 * The title a reader sees (ROADMAP 6.2): the edition the search matched, else
 * an edition carrying the query's words, else — for a title not in Latin
 * script — an edition in the reader's language or English, else a
 * transliteration; the catalogue's title kept beside it.
 */
import { describe, expect, it } from 'vitest';
import { isLatinScript, readableAuthor, shownTitle, transliterateCyrillic } from '../titleshown';
import { parseSearchDocs } from '../sources/openlibrary-parse';

describe('shownTitle', () => {
  it('takes the edition the search matched, in the search’s language', () => {
    expect(shownTitle('Преступление и наказание', { matched: 'Crime and Punishment' }))
      .toEqual({ title: 'Crime and Punishment', catalogueTitle: 'Преступление и наказание' });
    expect(shownTitle('Metamorphosis', { matched: 'Die Verwandlung', matchedLanguage: 'de' }))
      .toEqual({ title: 'Die Verwandlung', catalogueTitle: 'Metamorphosis' });
  });

  it('without a language on the match, lets the query’s words decide', () => {
    expect(shownTitle('Metamorphosis', { matched: 'Die Verwandlung', query: 'die verwandlung' }).title).toBe('Die Verwandlung');
    expect(shownTitle('1985', { matched: '1984-85', query: '1984' }).title).toBe('1985');
  });

  it('never takes a match in another script', () => {
    expect(shownTitle("'1984' i esse raznykh let", { matched: '1984 / Скотный двор', matchedLanguage: 'ru', query: '1984' }).title).toBe("'1984' i esse raznykh let");
  });

  it('keeps a Latin title against an English match, often a stray record', () => {
    expect(shownTitle('1985', { matched: '1984-85', matchedLanguage: 'en' })).toEqual({ title: '1985' });
    expect(shownTitle('Animal Farm / Nineteen Eighty-Four', { matched: 'Animal Farm and 1984', matchedLanguage: 'en' }).title).toBe('Animal Farm / Nineteen Eighty-Four');
  });

  it('keeps the catalogue’s title when the match says the same, subtitle or article aside', () => {
    expect(shownTitle('The Great Gatsby', { matched: 'The great Gatsby: a novel' })).toEqual({ title: 'The Great Gatsby' });
  });

  it('on a page reached from a search, takes an edition carrying every word of the query', () => {
    const editions = [
      { title: 'Мастер и Маргарита', language: 'ru' },
      { title: 'Le Maître et Marguerite', language: 'fr' },
      { title: 'Der Meister und Margarita', language: 'de' },
      { title: 'Der Meister und Margarita', language: 'de' },
    ];
    expect(shownTitle('Мастер и Маргарита', { query: 'der meister und margarita', editions, languages: ['en'] }).title).toBe('Der Meister und Margarita');
  });

  it('for a title not in Latin script, takes the reader’s language, then English', () => {
    const editions = [
      { title: 'The Master and Margarita', language: 'en' },
      { title: 'The Master & Margarita', language: 'en' },
      { title: 'The Master and Margarita', language: 'en' },
      { title: 'Der Meister und Margarita', language: 'de' },
    ];
    expect(shownTitle('Мастер и Маргарита', { editions, languages: ['de'] }).title).toBe('Der Meister und Margarita');
    expect(shownTitle('Мастер и Маргарита', { editions, languages: ['en'] }).title).toBe('The Master and Margarita');
    expect(shownTitle('Ὀδύσσεια', { editions: [{ title: 'The Odyssey', language: 'en' }], languages: ['de'] }).title).toBe('The Odyssey');
  });

  it('on a page reached from a search, gives a Latin title up only for another language', () => {
    const editions = [{ title: '1984-85', language: 'en' }, { title: 'Die Verwandlung', language: 'de' }];
    expect(shownTitle('1985', { query: '1984', editions }).title).toBe('1985');
    expect(shownTitle('Metamorphosis', { query: 'die verwandlung', editions }).title).toBe('Die Verwandlung');
  });

  it('leaves a Latin title alone on a page reached from outside', () => {
    expect(shownTitle('Der Proceß', { editions: [{ title: 'The Trial', language: 'en' }], languages: ['en'] })).toEqual({ title: 'Der Proceß' });
  });

  it('transliterates Cyrillic when no edition offers a Latin title', () => {
    expect(shownTitle('Собачье сердце', { editions: [] })).toEqual({ title: 'Sobache serdtse', catalogueTitle: 'Собачье сердце' });
  });

  it('leaves another script as it is when nothing else is there', () => {
    expect(shownTitle('雪国')).toEqual({ title: '雪国' });
  });
});

describe('the search card’s matched edition', () => {
  it('is read from Open Library’s `editions` field', () => {
    const [work] = parseSearchDocs([{
      key: '/works/OL166894W', title: 'Преступление и наказание', author_name: ['Fiódor Dostoievski'], author_key: ['OL1A'], cover_i: 1,
      editions: { docs: [{ title: 'Crime and Punishment', language: ['eng'] }] },
    }]);
    expect(work.matchedTitle).toBe('Crime and Punishment');
    expect(shownTitle(work.title, { matched: work.matchedTitle }).title).toBe('Crime and Punishment');
  });
});

describe('scripts and names', () => {
  it('tells Latin script from the rest, accents and digits included', () => {
    expect(isLatinScript('Fiódor Dostoievski')).toBe(true);
    expect(isLatinScript('1984')).toBe(true);
    expect(isLatinScript('Михаил Булгаков')).toBe(false);
  });

  it('makes a Cyrillic name readable and leaves others alone', () => {
    expect(readableAuthor('Михаил Афанасьевич Булгаков')).toBe('Mikhail Afanasevich Bulgakov');
    expect(readableAuthor('Fiódor Dostoievski')).toBe('Fiódor Dostoievski');
    expect(readableAuthor('村上春樹')).toBe('村上春樹');
    expect(transliterateCyrillic('Щедрин')).toBe('Shchedrin');
  });
});
