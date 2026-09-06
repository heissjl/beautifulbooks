import { describe, expect, it } from 'vitest';
import {
  authorMatchKey, cleanAuthors, cleanIsbn, isbn10to13, languageName, looksLikeNonBook,
  looksLikeSecondaryLiterature, normalizeAuthor, normalizeTitle, parseYear, stripHtml,
  titleAuthorKey, toIsoLanguage,
} from '../normalize';

describe('normalizeTitle', () => {
  it('lowercases, strips punctuation and leading article, cuts subtitle', () => {
    expect(normalizeTitle('The Great Gatsby: A Novel')).toBe('great gatsby');
    expect(normalizeTitle("Gravity's Rainbow")).toBe('gravitys rainbow');
    expect(normalizeTitle('Mumbo-Jumbo')).toBe('mumbo jumbo');
    expect(normalizeTitle('Der Zauberberg')).toBe('zauberberg');
  });
  it('strips diacritics', () => {
    expect(normalizeTitle('Les Misérables')).toBe('miserables');
  });
  it('keeps a title that is only an article', () => {
    expect(normalizeTitle('The')).toBe('the');
  });
});

describe('normalizeAuthor / authorMatchKey', () => {
  it('inverts "Surname, Given"', () => {
    expect(normalizeAuthor('Roberts, Michael')).toBe('michael roberts');
  });
  it('matches initials-heavy spellings', () => {
    expect(authorMatchKey('J. R. R. Tolkien')).toBe(authorMatchKey('J.R.R. Tolkien'));
    expect(authorMatchKey('F. Scott Fitzgerald')).toBe('f fitzgerald');
    expect(authorMatchKey('Orwell, George')).toBe('g orwell');
    expect(authorMatchKey('Plato')).toBe('plato');
  });
  it('separates different authors with the same title', () => {
    expect(titleAuthorKey('Mumbo Jumbo', 'Ishmael Reed')).not.toBe(titleAuthorKey('Mumbo Jumbo', 'Kathryn Lasky'));
    expect(titleAuthorKey('Mumbo jumbo', 'Ishmael Reed')).toBe(titleAuthorKey('MUMBO JUMBO', 'Reed, Ishmael'));
  });
});

describe('cleanAuthors', () => {
  it('dedupes and drops translators', () => {
    expect(cleanAuthors(['Ishmael Reed', 'Ishmael Reed', 'Inga Pellisa Díaz (translator)'])).toEqual(['Ishmael Reed']);
    expect(cleanAuthors(undefined)).toEqual([]);
    expect(cleanAuthors(['', '  '])).toEqual([]);
  });
});

describe('isbn', () => {
  it('cleans and converts', () => {
    expect(cleanIsbn('0-14-118776-3')).toBe('0141187763');
    expect(cleanIsbn('978 0 14 118776 1')).toBe('9780141187761');
    expect(cleanIsbn('12345')).toBeUndefined();
    expect(isbn10to13('0141187763')).toBe('9780141187761');
    expect(isbn10to13('9780141187761')).toBe('9780141187761');
    expect(isbn10to13('080442957X')).toBe('9780804429573');
  });
});

describe('parseYear', () => {
  it('finds a plausible year in free-form dates', () => {
    expect(parseYear('2017')).toBe(2017);
    expect(parseYear('June 1, 1961')).toBe(1961);
    expect(parseYear('c1925')).toBe(1925);
    expect(parseYear('n.d.')).toBeUndefined();
    expect(parseYear(undefined)).toBeUndefined();
  });
});

describe('languages', () => {
  it('maps Open Library codes and keys to ISO 639-1', () => {
    expect(toIsoLanguage('eng')).toBe('en');
    expect(toIsoLanguage('/languages/ger')).toBe('de');
    expect(toIsoLanguage('de')).toBe('de');
    expect(toIsoLanguage('und')).toBeUndefined();
    expect(toIsoLanguage('xyz')).toBeUndefined();
    expect(toIsoLanguage(undefined)).toBeUndefined();
  });
  it('names languages', () => {
    expect(languageName('en')).toBe('English');
    expect(languageName(undefined)).toBe('Unknown');
    expect(languageName('xx')).toBe('XX');
  });
});

describe('filters', () => {
  it('detects non-books and secondary literature', () => {
    expect(looksLikeNonBook('1984 (Audiobook)')).toBe(true);
    expect(looksLikeNonBook('Journal of Irreproducible Results')).toBe(true);
    expect(looksLikeNonBook('1984')).toBe(false);
    expect(looksLikeSecondaryLiterature("A Reader's Guide to Gravity's Rainbow")).toBe(true);
    expect(looksLikeSecondaryLiterature('SparkNotes for 1984 by George Orwell')).toBe(true);
    expect(looksLikeSecondaryLiterature("A Gravity's rainbow companion")).toBe(true);
    expect(looksLikeSecondaryLiterature("Gravity's Rainbow")).toBe(false);
  });
  it('strips html', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(stripHtml('')).toBeUndefined();
  });
});
