import { describe, expect, it } from 'vitest';
import { CatalogueError, siteCatalogue, withFallback, type Catalogue, type CataloguePage } from '../catalogue';
import { pickCoversFromPage } from '../covers';
import { findWorks, refusedConnection } from '../find';
import type { CalibreBook } from '../library';
import type { Work, WorkSummary } from '../site';

const summary = (w: Partial<WorkSummary> & { id: string; title: string }): WorkSummary => ({ authors: ['Philip K. Dick'], coverUrls: [], languages: [], ...w });
const work = (id: string, title: string, author = 'Philip K. Dick'): Work => ({ id, title, authors: [author] });
const book = (b: Partial<CalibreBook>): CalibreBook => ({ id: 1, title: 'Ubik', authors: ['Dick, Philip K.'], isbns: [], hasCover: true, path: 'a/b (1)', formats: ['EPUB'], languages: ['en'], ...b });

/** A catalogue out of two tables, which also notes what it was asked. */
function fake(searches: Record<string, WorkSummary[]>, pages: Record<string, CataloguePage | null> = {}): Catalogue & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    search: async (q) => {
      asked.push(`search:${q}`);
      return searches[q] ?? [];
    },
    page: async (id, offset) => {
      asked.push(`page:${id}@${offset}`);
      return pages[`${id}@${offset}`] ?? null;
    },
  };
}
const options = {};

describe('the covers of a page the website answers with', () => {
  it('joins each cover with its editions and rebuilds the image address from the id', () => {
    const covers = pickCoversFromPage(
      [
        { id: 'ol:10', url: 'https://evil.example/x.jpg', urlSmall: 'https://evil.example/y.jpg', editionIds: ['ol:OL1M', 'ol:OL2M', 'ol:gone'] },
        { id: 'gb:abcDEF123456', url: 'https://books.google.com/x', editionIds: ['gb:abcDEF123456'] },
        { id: 'ol:11', url: 'u', editionIds: [] },
      ],
      [
        { id: 'ol:OL1M', language: 'de', publisher: 'Heyne', isbn13: '9783453000001', year: 1987 },
        { id: 'ol:OL2M', language: 'en', publisher: 'Gollancz', year: 2005 },
      ],
    );
    expect(covers).toEqual([
      { coverId: 'ol:10', thumb: 'https://covers.openlibrary.org/b/id/10-M.jpg', languages: ['de', 'en'], publishers: ['Heyne', 'Gollancz'], isbns: ['9783453000001'], year: 2005 },
      { coverId: 'ol:11', thumb: 'https://covers.openlibrary.org/b/id/11-M.jpg', languages: [], publishers: [], isbns: [] },
    ]);
  });
});

describe('asking through the website', () => {
  const answer = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('searches with the site’s search and keeps only real works', async () => {
    const urls: string[] = [];
    const site = siteCatalogue('https://site.example', async (url) => {
      urls.push(String(url));
      return answer(200, { works: [summary({ id: 'OL1W', title: 'Ubik' }), summary({ id: 't:ubik::a:p dick', title: 'Ubik' })] });
    });
    expect((await site.search('ubik philip k. dick')).map((w) => w.id)).toEqual(['OL1W']);
    expect(urls).toEqual(['https://site.example/api/search?q=ubik%20philip%20k.%20dick']);
  });

  it('asks a work page in the Open-Library-only mode — the one that spends no Google request', async () => {
    const urls: string[] = [];
    const site = siteCatalogue('https://site.example', async (url) => {
      urls.push(String(url));
      return answer(200, { work: work('OL1W', 'Ubik'), covers: [{ id: 'ol:10', url: 'u', editionIds: ['ol:OL1M'] }], editions: [{ id: 'ol:OL1M', language: 'en', year: 1969 }], page: { offset: 100, limit: 100, total: 240, nextOffset: 200 } });
    });
    const page = await site.page('OL1W', 100);
    expect(urls).toEqual(['https://site.example/api/works/OL1W?offset=100&sibling=1']);
    expect(page).toMatchObject({ editions: 240, next: 200, work: { title: 'Ubik' } });
    expect(page?.covers[0]).toMatchObject({ coverId: 'ol:10', languages: ['en'], year: 1969 });
  });

  it('says the last page has no next, and an unknown work is unknown, not an error', async () => {
    const last = siteCatalogue('https://s', async () => answer(200, { work: work('OL1W', 'Ubik'), covers: [], editions: [], page: { total: 40 } }));
    expect((await last.page('OL1W', 0))?.next).toBeNull();
    const unknown = siteCatalogue('https://s', async () => answer(404, { error: 'Work not found' }));
    expect(await unknown.page('OL9W', 0)).toBeNull();
  });

  it('passes on the site’s refusals in words a reader can act on, and fails plainly on anything else', async () => {
    await expect(siteCatalogue('https://s', async () => answer(429)).search('x y z')).rejects.toThrow(CatalogueError);
    await expect(siteCatalogue('https://s', async () => answer(403)).page('OL1W', 0)).rejects.toThrow(/bot protection/);
    const down = siteCatalogue('https://s', async () => answer(503));
    await expect(down.search('x y z')).rejects.toThrow('The website answered 503.');
    await expect(down.search('x y z')).rejects.not.toThrow(CatalogueError);
  });

  it('does not let an unreachable website look like Open Library shutting the door', async () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:3000'), { code: 'ECONNREFUSED' });
    const gone = siteCatalogue('http://localhost:3000', async () => { throw new TypeError('fetch failed', { cause: refused }); });
    const err = await gone.search('x y z').catch((e: unknown) => e);
    expect((err as Error).message).toBe('The website did not answer.');
    expect(refusedConnection(err)).toBe(false);
  });
});

describe('the website first, Open Library when it fails', () => {
  const broken: Catalogue = { search: async () => { throw new CatalogueError('busy'); }, page: async () => { throw new Error('down'); } };
  const second = fake({ q: [summary({ id: 'OL2W', title: 'From the second' })] }, { 'OL2W@0': { work: work('OL2W', 'X'), covers: [], editions: 3, next: null } });

  it('does not touch the second while the first answers — an empty answer is an answer', async () => {
    const first = fake({});
    const both = withFallback(first, second, () => true);
    expect(await both.search('q')).toEqual([]);
    expect(await both.page('OL2W', 0)).toBeNull();
    expect(second.asked).toEqual([]);
  });

  it('falls back when the first fails, and keeps the first’s words when it may not', async () => {
    expect((await withFallback(broken, second, () => true).search('q'))[0].id).toBe('OL2W');
    expect((await withFallback(broken, second, () => true).page('OL2W', 0))?.editions).toBe(3);
    await expect(withFallback(broken, second, () => false).search('q')).rejects.toThrow('busy');
  });
});

describe('which work a book is, asked through a catalogue', () => {
  const ubik = summary({ id: 'OL1W', title: 'Ubik', firstPublishYear: 1969, coverUrls: ['https://covers.openlibrary.org/b/id/911137-L.jpg'] });
  const guide = summary({ id: 'OL5W', title: 'A reader’s guide to Ubik', authors: ['Someone Else'] });

  it('proposes the work whose author and title agree, with a small picture', async () => {
    const c = fake({ 'Ubik Dick, Philip K.': [guide, ubik] });
    const found = await findWorks(book({}), c, options);
    expect(found).toMatchObject({ picked: 'OL1W', reason: 'author+title', editionCovers: [] });
    expect(found.hits.map((h) => h.id)).toEqual(['OL5W', 'OL1W']);
    expect(found.hits[1].thumb).toBe('https://covers.openlibrary.org/b/id/911137-M.jpg');
    expect(c.asked).toEqual(['search:Ubik Dick, Philip K.']);
  });

  it('takes the work the catalogue finds for the ISBN, puts it first, and searches the cleaned title beside it', async () => {
    const tears = summary({ id: 'OL7W', title: 'Flow my tears, the policeman said' });
    const c = fake({ '9781857983418': [tears], 'Flow My Tears, the Policeman Said Dick, Philip K.': [guide, tears] });
    const found = await findWorks(book({ title: '[Philip K. Dick 04] • Flow My Tears, the Policeman Said', isbns: ['9781857983418'] }), c, options);
    expect(found).toMatchObject({ picked: 'OL7W', reason: 'isbn' });
    expect(found.hits.map((h) => h.id)).toEqual(['OL7W', 'OL5W']);
    expect(found.failed).toBeUndefined();
  });

  it('tries the title alone when title and author together find nothing usable', async () => {
    const c = fake({ 'Ubik Dick, Philip K.': [], Ubik: [ubik] });
    expect(await findWorks(book({}), c, options)).toMatchObject({ picked: 'OL1W', reason: 'author+title' });
    expect(c.asked).toEqual(['search:Ubik Dick, Philip K.', 'search:Ubik']);
  });

  it('proposes nothing when only a stranger’s book comes back', async () => {
    const found = await findWorks(book({ title: 'Francisco Pizarro', authors: ['Arthur Schurig'] }), fake({ 'Francisco Pizarro Arthur Schurig': [guide], 'Francisco Pizarro': [guide] }), options);
    expect(found.picked).toBeUndefined();
    expect(found.hits).toHaveLength(1);
  });

  it('puts the remembered work first, named by the first page of its covers when the search does not list it', async () => {
    const c = fake({ 'Ubik Dick, Philip K.': [ubik] }, { 'OL9W@0': { work: work('OL9W', 'Ubik (German)'), covers: [], editions: 4, next: null } });
    const found = await findWorks(book({}), c, { ...options, remembered: 'OL9W' });
    expect(found).toMatchObject({ picked: 'OL9W', reason: 'remembered' });
    expect(found.hits.map((h) => h.title)).toEqual(['Ubik (German)', 'Ubik']);
  });

  it('answers a typed search with that search alone — no ISBN, no remembered work, no proposal', async () => {
    const c = fake({ 'der dunkle schirm': [ubik] });
    const found = await findWorks(book({ isbns: ['9781857983418'] }), c, { ...options, remembered: 'OL9W', query: 'der dunkle schirm' });
    expect(found.picked).toBeUndefined();
    expect(c.asked).toEqual(['search:der dunkle schirm']);
  });

  it('says what did not answer, in the website’s own words where it gave some, and never as "nothing found"', async () => {
    const busy: Catalogue = { search: async () => { throw new CatalogueError('The website is holding back.'); }, page: async () => null };
    const found = await findWorks(book({}), busy, options);
    expect(found).toMatchObject({ hits: [], failed: 'The website is holding back.' });
    expect(found.refused).toBeUndefined();
    const silent: Catalogue = { search: async () => { throw new Error('timeout'); }, page: async () => null };
    expect((await findWorks(book({}), silent, options)).failed).toBe('The search did not answer.');
  });

  it('notices a refused connection, so the app can stop asking', async () => {
    const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    const shut: Catalogue = { search: async () => { throw new TypeError('fetch failed', { cause: refused }); }, page: async () => null };
    expect((await findWorks(book({}), shut, options)).refused).toBe(true);
  });
});
