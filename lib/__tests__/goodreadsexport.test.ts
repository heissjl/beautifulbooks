import { describe, expect, it } from 'vitest';
import { cleanBook } from '../calibre/clean';
import { GoodreadsError, libraryFromGoodreadsCsv, parseCsv } from '../goodreads/export';

// The header of a real export (2026); rows written by hand, ISBNs from the recorded Open Library fixtures.
const HEADER =
  'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies';
const CSV = [
  '﻿' + HEADER,
  '4671,The Great Gatsby,F. Scott Fitzgerald,"Fitzgerald, F. Scott",,"=""""","=""9780008371814""",5,3.93,HarperCollins,Paperback,180,2020,1925,2024/01/02,2023/12/01,,,read,"Loved it, ""truly"".\nTwo lines.",,,1,0',
  '5470,1984,George Orwell,"Orwell, George","Erich Fromm, Thomas Pynchon","=""0451524934""","=""""",0,4.19,Signet,Mass Market Paperback,328,1950,1949,,2025/03/04,favourites,favourites (#1),to-read,,,,0,0',
  '1,"Harry Potter and the Sorcerer\'s Stone (Harry Potter, #1)",J.K. Rowling,"Rowling, J.K.",,"=""""","=""""",0,4.47,Scholastic,Hardcover,309,1998,1997,,2025/05/06,,,currently-reading,,,,0,0',
  '',
].join('\r\n');

describe('parseCsv', () => {
  it('keeps commas, doubled quotes and line breaks inside a quoted field', () => {
    expect(parseCsv('a,"b, c","say ""hi""\nthere"\r\nd,e,f\n')).toEqual([
      ['a', 'b, c', 'say "hi"\nthere'],
      ['d', 'e', 'f'],
    ]);
  });
});

describe('libraryFromGoodreadsCsv', () => {
  const books = libraryFromGoodreadsCsv(CSV);

  it('reads every row, multi-line review and all', () => {
    expect(books.map((b) => b.title)).toEqual(['The Great Gatsby', '1984', "Harry Potter and the Sorcerer's Stone (Harry Potter, #1)"]);
    expect(books.map((b) => b.shelf)).toEqual(['read', 'to-read', 'currently-reading']);
    expect(books[1].added).toBe('2025/03/04');
  });

  it('unwraps the ISBN formulas and turns an ISBN-10 into 13', () => {
    expect(books[0].isbns).toEqual(['9780008371814']);
    expect(books[1].isbns).toEqual(['9780451524935']);
    expect(books[2].isbns).toEqual([]);
  });

  it('puts the main author first', () => {
    expect(books[1].authors).toEqual(['George Orwell', 'Erich Fromm', 'Thomas Pynchon']);
  });

  it('gives the catalogue the bare title, without the series in brackets', () => {
    expect(cleanBook(books[2])).toEqual({ title: "Harry Potter and the Sorcerer's Stone", author: 'J.K. Rowling', isbns: [] });
  });

  it('refuses a file that is not an export', () => {
    expect(() => libraryFromGoodreadsCsv('name,email\nA,b@c')).toThrow(GoodreadsError);
    expect(() => libraryFromGoodreadsCsv('')).toThrow(GoodreadsError);
  });
});
