import { describe, expect, it } from 'vitest';
import { libraryFor, lookUpBook, printingFromEdition, sizeFor, sizeStatement } from '../walls/printings';

const DNB_XML = `<record><datafield tag="300" ind1=" " ind2=" "><subfield code="a">150 S.</subfield><subfield code="c">18 cm</subfield></datafield></record>`;
const BNF_XML = `<mxc:datafield tag="215" ind1=" " ind2=" "><mxc:subfield code="a">211 p.</mxc:subfield><mxc:subfield code="c">couv. ill.</mxc:subfield><mxc:subfield code="d">18 cm</mxc:subfield></mxc:datafield>`;

describe('printing and size of a cover (5.13f, 5.13i)', () => {
  it('reads publisher, year and ISBNs from the edition the scan belongs to', async () => {
    const urls: string[] = [];
    const get = async <T,>(url: string): Promise<T> => {
      urls.push(url);
      return (url.includes('covers.openlibrary.org')
        ? { olid: 'OL2741128M', width: 422, height: 630 }
        : { publishers: ['Knopf'], publish_date: 'September 1987', isbn_10: ['0394535979'], physical_format: 'Hardcover' }) as T;
    };
    const r = await lookUpBook('8261367', { needPrinting: true }, get, async () => { throw new Error('timeout'); });
    expect(r.printing).toEqual({ found: { isbn13: '9780394535975', isbn10: '0394535979', publisher: 'Knopf', year: 1987 } });
    // LoC silent: estimated from the format, and marked so.
    expect(r.size).toEqual({ w: 16, h: 24, source: 'format' });
    expect(urls).toEqual(['https://covers.openlibrary.org/b/id/8261367.json', 'https://openlibrary.org/books/OL2741128M.json']);
  });

  it('says none only when the catalogue answered without an edition', async () => {
    const r = await lookUpBook('1', { needPrinting: true }, async <T,>() => ({ olid: null }) as T, async () => '');
    expect(r.printing).toEqual({ none: true });
    expect(r.size.source).toBe('assumed');
  });

  it('throws when the catalogue is silent, so the tile stays "not looked up"', async () => {
    await expect(lookUpBook('1', { needPrinting: true }, async () => { throw new Error('timeout'); })).rejects.toThrow();
  });

  it('never gives an e-book printing (E21)', () => {
    expect(printingFromEdition({ physical_format: 'Ebook', isbn_13: ['9780000000002'] })).toBeNull();
  });

  it('asks the library of the ISBN group and reads its size statement', async () => {
    expect(libraryFor('9783518110065')?.name).toBe('dnb');
    expect(libraryFor('9782070302826')?.name).toBe('bnf');
    expect(libraryFor('9780743273565')?.name).toBe('loc');
    expect(libraryFor('9788433902580')).toBeNull();
    expect(sizeStatement(DNB_XML)).toBe('18 cm');
    expect(sizeStatement(BNF_XML)).toBe('18 cm');
    const s = await sizeFor({}, '9783518110065', { width: 422, height: 630 }, async () => DNB_XML);
    expect(s).toEqual({ h: 18, w: 12.1, source: 'library' });
  });

  it('prefers Open Library dimensions when the edition has them', async () => {
    const s = await sizeFor({ physical_dimensions: '7.5 x 4.2 x 1 inches' }, '9783518110065', {}, async () => { throw new Error('not asked'); });
    expect(s).toEqual({ h: 19.1, w: 10.7, t: 2.5, source: 'openlibrary' });
  });
});
