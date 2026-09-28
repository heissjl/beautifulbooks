import { describe, expect, it } from 'vitest';
import { lookUpPrinting, printingFromEdition } from '../walls/printings';

describe('printing of a cover (5.13f)', () => {
  it('reads publisher, year and ISBNs from the edition the scan belongs to', async () => {
    const urls: string[] = [];
    const get = async <T,>(url: string): Promise<T> => {
      urls.push(url);
      return (url.includes('covers.openlibrary.org')
        ? { olid: 'OL2741128M' }
        : { publishers: ['Knopf'], publish_date: 'September 1987', isbn_10: ['0394535979'] }) as T;
    };
    expect(await lookUpPrinting('8261367', get)).toEqual({ found: { isbn13: '9780394535975', isbn10: '0394535979', publisher: 'Knopf', year: 1987 } });
    expect(urls).toEqual(['https://covers.openlibrary.org/b/id/8261367.json', 'https://openlibrary.org/books/OL2741128M.json']);
  });

  it('says none only when the catalogue answered without an edition', async () => {
    expect(await lookUpPrinting('1', async <T,>() => ({ olid: null }) as T)).toEqual({ none: true });
  });

  it('throws when the catalogue is silent, so the tile stays "not looked up"', async () => {
    await expect(lookUpPrinting('1', async () => { throw new Error('timeout'); })).rejects.toThrow();
  });

  it('never gives an e-book printing (E21)', () => {
    expect(printingFromEdition({ physical_format: 'Ebook', isbn_13: ['9780000000002'] })).toBeNull();
  });
});
