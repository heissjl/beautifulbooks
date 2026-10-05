import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WorkSummary } from '../model';
import { editionFromIsbnDoc, getEditionByIsbn, type OlIsbnDoc } from '../sources/openlibrary';
import { SourceUnavailableError } from '../sources/http';
import { CALIBRE_BOOKS_PER_REQUEST, matchCalibreBook, matchCalibreBooks, validQueries, type CalibreSources } from '../walls/calibre';

const work = (w: Partial<WorkSummary> & { id: string }): WorkSummary => ({ title: 'T', authors: ['A B'], coverUrls: ['https://covers.openlibrary.org/b/id/111-M.jpg'], languages: ['en'], ...w });
const RAMA = work({ id: 'OL17365W', title: 'Rendezvous with Rama', authors: ['Arthur C. Clarke'], coverUrls: ['https://covers.openlibrary.org/b/id/222-M.jpg'] });
const GUIDE = work({ id: 'OL2163649W', title: "The Hitchhiker's Guide to the Galaxy", authors: ['Douglas Adams'] });
const VIRGIN = work({ id: 'OL45804W', title: 'The Virgin Suicides', authors: ['Jeffrey Eugenides'] });

function sources(found: Record<string, WorkSummary[]>, isbns: Record<string, { workId: string; covers: number[] } | null> = {}): CalibreSources & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    isbn: async (isbn) => (asked.push(`isbn:${isbn}`), isbns[isbn] ?? null),
    find: async (query) => (asked.push(query), found[query] ?? []),
  };
}
const q = (title: string, author: string, isbns: string[] = []) => ({ title, author, isbns });

describe('matchCalibreBook', () => {
  it('takes the ISBN first, with the cover of that printing and the ISBN as its printing', async () => {
    const s = sources({ 'key:/works/OL17365W': [RAMA] }, { '9780553287899': { workId: 'OL17365W', covers: [333, 444] } });
    const m = await matchCalibreBook(q('Rendezvous With Rama', 'Arthur C. Clarke', ['9780553287899']), s);
    expect(m).toEqual({ status: 'match', reason: 'isbn', tile: { workId: 'OL17365W', coverId: '333', title: 'Rendezvous with Rama', author: 'Arthur C. Clarke', printings: [{ isbn13: '9780553287899' }] } });
    expect(s.asked).toEqual(['isbn:9780553287899', 'key:/works/OL17365W']);
  });

  it('matches a translated title through its ISBN, because the author agrees', async () => {
    const s = sources({ 'key:/works/OL2163649W': [GUIDE] }, { '9783453146976': { workId: 'OL2163649W', covers: [555] } });
    expect(await matchCalibreBook(q('Per Anhalter durch die Galaxis', 'Douglas Adams', ['9783453146976']), s)).toMatchObject({ status: 'match', reason: 'isbn' });
  });

  it('only suggests an ISBN whose work shares neither author nor title', async () => {
    const s = sources({ 'key:/works/OL45804W': [VIRGIN] }, { '9780000000002': { workId: 'OL45804W', covers: [1] } });
    expect(await matchCalibreBook(q('Dune', 'Frank Herbert', ['9780000000002']), s)).toMatchObject({ status: 'suggestion', reason: 'isbn-only' });
  });

  it('matches by author and title, and only suggests the rest', async () => {
    expect(await matchCalibreBook(q('Rendezvous With Rama', 'Arthur C. Clarke'), sources({ 'Rendezvous With Rama Arthur C. Clarke': [RAMA] }))).toMatchObject({ status: 'match', reason: 'author+title' });
    expect(await matchCalibreBook(q('Per Anhalter durch die Galaxis', 'Douglas Adams'), sources({ 'Per Anhalter durch die Galaxis Douglas Adams': [GUIDE] }))).toMatchObject({ status: 'suggestion', reason: 'author' });
    expect(await matchCalibreBook(q('The Virgin Suicides', 'Somebody Else'), sources({ 'The Virgin Suicides': [VIRGIN] }))).toMatchObject({ status: 'suggestion', reason: 'title-only' });
    const box = work({ id: 'OL20513408W', title: 'MADDADDAM TRILOGY BOX', authors: ['Margaret Atwood'] });
    expect(await matchCalibreBook(q('MaddAddam', 'Margaret Atwood'), sources({ 'MaddAddam Margaret Atwood': [box] }))).toMatchObject({ status: 'suggestion', reason: 'author+part' });
  });

  it('says not found only when the catalogue answered, and failed when it did not', async () => {
    expect(await matchCalibreBook(q('Ille mihi', 'Elisabeth von Heyking'), sources({ 'Ille mihi Elisabeth von Heyking': [VIRGIN] }))).toEqual({ status: 'none' });
    const silent: CalibreSources = {
      isbn: async () => {
        throw new SourceUnavailableError('openlibrary', new Error('timeout'));
      },
      find: async () => {
        throw new SourceUnavailableError('openlibrary', new Error('timeout'));
      },
    };
    expect(await matchCalibreBook(q('Dune', 'Frank Herbert'), silent)).toEqual({ status: 'failed' });
    expect(await matchCalibreBook(q('Dune', 'Frank Herbert', ['9780441172719']), silent)).toEqual({ status: 'failed' });
  });

  it('answers a request in the order it was asked, a few at a time', async () => {
    let inFlight = 0;
    let most = 0;
    const slow: CalibreSources = {
      isbn: async () => null,
      find: async (query) => {
        inFlight++;
        most = Math.max(most, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return query.startsWith('Rendezvous') ? [RAMA] : [];
      },
    };
    const out = await matchCalibreBooks([q('Nothing', 'Nobody'), q('Rendezvous With Rama', 'Arthur C. Clarke'), q('Nada', 'Nadie'), q('Rien', 'Personne')], slow);
    expect(out.map((m) => m.status)).toEqual(['none', 'match', 'none', 'none']);
    expect(most).toBeLessThanOrEqual(3);
  });
});

describe('validQueries', () => {
  it('takes books in the shape the page builds them, and drops what is not an ISBN-13', () => {
    expect(validQueries([{ title: ' Dune ', author: 'Frank Herbert', isbns: ['9780441172719', '0441172717', 7], extra: 'x' }])).toEqual([{ title: 'Dune', author: 'Frank Herbert', isbns: ['9780441172719'] }]);
  });

  it('refuses an empty request, too many books, and a book without title or author', () => {
    expect(() => validQueries([])).toThrow();
    expect(() => validQueries('Dune')).toThrow();
    expect(() => validQueries(Array.from({ length: CALIBRE_BOOKS_PER_REQUEST + 1 }, () => ({ title: 'T', author: 'A' })))).toThrow();
    expect(() => validQueries([{ title: '', author: 'A' }])).toThrow();
    expect(() => validQueries([{ title: 'T' }])).toThrow();
    expect(() => validQueries([{ title: 'T'.repeat(301), author: 'A' }])).toThrow();
  });
});

describe('the edition behind an ISBN', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads an answer as Open Library gave it (recorded 2026-10-03)', () => {
    const doc = JSON.parse(readFileSync(join(__dirname, '../__fixtures__/calibre/isbn-9780553287899.json'), 'utf8')) as OlIsbnDoc;
    expect(editionFromIsbnDoc(doc)).toEqual({ workId: 'OL17417W', covers: [369135] });
    expect(editionFromIsbnDoc({ works: [{ key: '/works/OL1W' }], covers: [-1, 5] })).toEqual({ workId: 'OL1W', covers: [5] });
    expect(editionFromIsbnDoc({ covers: [5] })).toBeNull();
  });

  it('is null for an ISBN Open Library does not have, and never asks for one that is not an ISBN-13', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetch);
    expect(await getEditionByIsbn('9780553287899')).toBeNull();
    expect(await getEditionByIsbn('../etc')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('asks silence once more and then says so, never "no such book"', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetch);
    await expect(getEditionByIsbn('9780553287899')).rejects.toBeInstanceOf(SourceUnavailableError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
