import { describe, expect, it } from 'vitest';
import {
  authorMatchKey, cleanAuthorEntries, cleanAuthors, cleanIsbn, isbn10to13, languageName, looksLikeNonBook,
  looksLikeSecondaryLiterature, MARKED_DERIVATIVE, normalizeAuthor, normalizeTitle, parseYear, stripHtml,
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
  it('keeps Open Library keys aligned through dedupe', () => {
    expect(cleanAuthorEntries(['Ishmael Reed', 'Ishmael Reed', 'Inga Pellisa Díaz'], ['/authors/OL27626A', '/authors/OL27626A', '/authors/OL6284880A']))
      .toEqual([{ name: 'Ishmael Reed', key: 'OL27626A' }, { name: 'Inga Pellisa Díaz', key: 'OL6284880A' }]);
    expect(cleanAuthorEntries(['A'])).toEqual([{ name: 'A' }]);
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

  // ROADMAP 6.1: "Crime and Punishment Notes" stood at position 3 of its own
  // search, and "Things Fall Apart, notes" at position 3 of its own.
  it('reads a title ending in "notes" as being about a book, but not one that merely contains the word', () => {
    expect(looksLikeSecondaryLiterature('Crime and Punishment Notes')).toBe(true);
    expect(looksLikeSecondaryLiterature('Things Fall Apart, notes')).toBe(true);
    // Two real novels that must not be swept up with the study aids. Measured
    // 2026-09-08: `notes on a scandal` put Heller's novel at position 4,
    // behind Sheridan and The Brothers Karamazov, because of the old rule.
    expect(looksLikeSecondaryLiterature('Notes from Underground')).toBe(false);
    expect(looksLikeSecondaryLiterature('Notes on a Scandal')).toBe(false);
    // A study guide still reads as one when something precedes "notes on".
    expect(looksLikeSecondaryLiterature("Barron's Notes on Macbeth")).toBe(true);
    expect(looksLikeSecondaryLiterature('CliffsNotes on Hamlet')).toBe(true);
  });

  it('reads a theatre version as a derivative', () => {
    expect(MARKED_DERIVATIVE.test('Alice in Wonderland in Five Acts')).toBe(true);
    expect(MARKED_DERIVATIVE.test('Hamlet: a play in 5 acts')).toBe(true);
    expect(MARKED_DERIVATIVE.test('Wozzeck, an opera')).toBe(true);
    expect(MARKED_DERIVATIVE.test("Alice's Adventures in Wonderland")).toBe(false);
    expect(MARKED_DERIVATIVE.test('Things Fall Apart')).toBe(false);
  });
  it('strips html', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
    expect(stripHtml('')).toBeUndefined();
  });
});
