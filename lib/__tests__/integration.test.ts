/**
 * End-to-end through the data layer with a mocked fetch that serves the
 * recorded fixtures by URL (Open Library and Google Books). Covers SPEC §3
 * F1/F2, §4 N2 (two calls per search), F3.3 (a failing source does not fail
 * the request) and E4/E5 (Google covers attach to Open Library works only).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { search } from '../search';
import { MAX_EDITIONS_SCANNED, getWorkDetail, getWorkPage } from '../work';
import { authorMatchKey, normalizeTitle } from '../normalize';

const FIXTURES = path.join(__dirname, '..', '__fixtures__');
const fixture = (slug: string, file: string) => JSON.parse(readFileSync(path.join(FIXTURES, slug, file), 'utf8'));
/** Later edition pages exist for Gatsby only; missing pages mean "no more entries". */
function tryFixture(slug: string, file: string): { entries: unknown[] } | undefined {
  try {
    return fixture(slug, file);
  } catch {
    return undefined;
  }
}

const SLUG_BY_QUERY: Record<string, string> = {
  'mumbo jumbo': 'mumbo-jumbo',
  '1984': '1984',
  "gravity's rainbow": 'gravitys-rainbow',
  'the great gatsby': 'the-great-gatsby',
  'pride and prejudice': 'pride-and-prejudice',
};

type Route = (url: URL) => { status?: number; body?: unknown } | undefined;

/** Default: serve the recorded Google search fixture for a known query, else 429. */
const googleFixture: Route = url => {
  const q = (url.searchParams.get('q') ?? '').replace(/^intitle:/, '');
  const slug = SLUG_BY_QUERY[q];
  return slug ? { body: fixture(slug, 'googlebooks-search.json') } : { status: 429 };
};
let googleBooks: Route = googleFixture;
const calls: string[] = [];

/** Serves Open Library fixtures; Google Books behaviour is pluggable per test. */
function route(url: URL): { status?: number; body?: unknown } {
  const q = url.searchParams.get('q') ?? '';
  if (url.hostname === 'www.googleapis.com') return googleBooks(url) ?? { status: 429 };
  if (url.pathname === '/search.json' && q.startsWith('key:/works/')) {
    const id = q.replace('key:/works/', '');
    for (const slug of Object.values(SLUG_BY_QUERY)) {
      const doc = fixture(slug, 'openlibrary-search.json').docs.find((d: { key: string }) => d.key === `/works/${id}`);
      if (doc) return { body: { docs: [doc] } };
    }
    return { body: { docs: [] } };
  }
  if (url.pathname === '/search.json') {
    const slug = SLUG_BY_QUERY[q];
    return slug ? { body: fixture(slug, 'openlibrary-search.json') } : { body: { docs: [] } };
  }
  const m = url.pathname.match(/^\/works\/(OL\d+W)\/editions\.json$/);
  if (m) {
    for (const slug of Object.values(SLUG_BY_QUERY)) {
      const f = fixture(slug, 'openlibrary-editions.json');
      if (f.workId !== m[1]) continue;
      const offset = Number(url.searchParams.get('offset') ?? 0);
      // Only Gatsby has later pages recorded; everything else ends after page 0.
      const page = offset === 0 ? f : tryFixture(slug, `openlibrary-editions-${offset}.json`);
      return { body: { size: f.size, entries: page?.entries ?? [] } };
    }
    return { status: 404 };
  }
  return { status: 404 };
}

beforeEach(() => {
  calls.length = 0;
  googleBooks = googleFixture;
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    const { status = 200, body = {} } = route(url);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('search', () => {
  it('makes exactly two external calls and survives Google Books failing (N2, F3.3)', async () => {
    googleBooks = () => ({ status: 429 });
    const r = await search('mumbo jumbo');
    expect(calls).toHaveLength(2);
    expect(calls.some(u => u.includes('openlibrary.org/search.json'))).toBe(true);
    expect(calls.some(u => u.includes('googleapis.com'))).toBe(true);
    expect(r.works[0].id).toBe('OL30751W');
    expect(r.works[0].authors[0]).toBe('Ishmael Reed');
    expect(r.language).toBe('all');
  });

  it('returns nothing for an empty query without calling anyone', async () => {
    const r = await search('   ');
    expect(r.works).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('adds recorded Google covers to the mosaic of the top work without creating works', async () => {
    const r = await search('mumbo jumbo');
    expect(r.works[0].id).toBe('OL30751W');
    expect(r.works[0].coverUrls.length).toBeGreaterThan(1);
    expect(r.works[0].coverUrls[0]).toContain('covers.openlibrary.org');
    expect(r.works[0].coverUrls.slice(1).every(u => u.includes('books.google.com') && u.includes('zoom=1') && u.includes('fife=w'))).toBe(true);
    expect(r.works.every(w => /^OL\d+W$/.test(w.id))).toBe(true);
  });

  it('meets the acceptance criteria for the five queries', async () => {
    const gatsby = await search('the great gatsby');
    const fitz = gatsby.works.filter(w => authorMatchKey(w.authors[0]) === 'f fitzgerald' && normalizeTitle(w.title) === 'great gatsby');
    expect(fitz).toHaveLength(1);
    expect(gatsby.works[0].id).toBe('OL468431W');

    const orwell = await search('1984');
    expect(orwell.works[0].authors[0]).toBe('George Orwell');

    const pynchon = await search("gravity's rainbow");
    expect(pynchon.works[0].id).toBe('OL2636675W');

    const austen = await search('pride and prejudice');
    expect(austen.works[0].id).toBe('OL66554W');
    expect(austen.works.some(w => /zombies/i.test(w.title))).toBe(true);
  });

  it('attaches Google Books covers to the matching work only (E4/E5)', async () => {
    googleBooks = () => ({
      body: {
        items: [
          { id: 'g1', volumeInfo: { title: 'Mumbo Jumbo', authors: ['Ishmael Reed'], imageLinks: { thumbnail: 'http://books.google.com/g1?zoom=1' }, language: 'en' } },
          { id: 'g2', volumeInfo: { title: 'Mumbo Jumbo', authors: ['Ishmael Reed'], imageLinks: { thumbnail: 'http://books.google.com/g2?zoom=1' }, language: 'de' } },
          { id: 'g3', volumeInfo: { title: 'Mumbo Jumbo', authors: ['Nobody Known'], imageLinks: { thumbnail: 'http://books.google.com/g3?zoom=1' } } },
        ],
      },
    });
    const r = await search('mumbo jumbo');
    const reed = r.works[0];
    expect(reed.id).toBe('OL30751W');
    expect(reed.coverUrls).toHaveLength(3);
    expect(reed.coverUrls[0]).toContain('covers.openlibrary.org');
    expect(reed.coverUrls.slice(1)).toEqual(['https://books.google.com/g1?zoom=1&fife=w800', 'https://books.google.com/g2?zoom=1&fife=w800']);
    expect(reed.languages).toContain('de');
    expect(r.works.some(w => w.authors[0] === 'Nobody Known')).toBe(false);
  });

  it('caps mosaic covers at four', async () => {
    googleBooks = () => ({
      body: { items: Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, volumeInfo: { title: 'Mumbo Jumbo', authors: ['Ishmael Reed'], imageLinks: { thumbnail: `http://books.google.com/g${i}?zoom=1` } } })) },
    });
    const r = await search('mumbo jumbo');
    expect(r.works[0].coverUrls).toHaveLength(4);
  });

  it('filters works by language while keeping works without language data (F1.2)', async () => {
    const all = await search('1984');
    const de = await search('1984', { language: 'de' });
    expect(de.works.length).toBeLessThan(all.works.length);
    expect(de.works[0].authors[0]).toBe('George Orwell');
    expect(de.works.every(w => w.languages.length === 0 || w.languages.includes('de'))).toBe(true);
    expect(de.language).toBe('de');
    expect((await search('1984', { language: 'nonsense' })).language).toBe('all');
  });
});

describe('getWorkPage', () => {
  const GATSBY = 'OL468431W';

  it('returns the first page with the work, the source total and the next offset', async () => {
    const p = await getWorkPage(GATSBY);
    expect(p!.work.title).toBe('The Great Gatsby');
    expect(p!.page).toMatchObject({ offset: 0, limit: 100, total: 1180, nextOffset: 100 });
    expect(p!.editions.length).toBeGreaterThan(0);
    expect(p!.signatures).toBeUndefined();
  });

  it('asks Google Books once on the first page and never for ISBNs (SPEC 13a)', async () => {
    await getWorkPage(GATSBY, { offset: 0 });
    const google = calls.filter(u => u.includes('googleapis'));
    // One title search. The ten ISBN lookups that used to run here now happen
    // when a cover is selected (lib/isbn.ts), which is the whole point of 13a.
    expect(google).toHaveLength(1);
    expect(decodeURIComponent(google[0])).toContain('intitle:');
    expect(google.some(u => u.includes('isbn:'))).toBe(false);

    calls.length = 0;
    const p = await getWorkPage(GATSBY, { offset: 100 });
    expect(calls.some(u => u.includes('googleapis'))).toBe(false);
    expect(p!.editions.every(e => e.source === 'openlibrary')).toBe(true);
  });

  it('spends no Google request when the caller does not want one (mosaics)', async () => {
    // A result list of twenty cards would otherwise cost twenty title
    // searches, twenty times the figure §8.7 plans the quota against.
    const p = await getWorkPage(GATSBY, { offset: 0, googleBooks: false });
    expect(calls.some(u => u.includes('googleapis'))).toBe(false);
    expect(p!.covers.length).toBeGreaterThan(3);
    expect(p!.editions.every(e => e.source === 'openlibrary')).toBe(true);
  });

  it('serves different editions per page, which is the point of paging (SPEC §9.1 A)', async () => {
    const [first, second] = await Promise.all([getWorkPage(GATSBY, { offset: 0 }), getWorkPage(GATSBY, { offset: 100 })]);
    const ids = new Set(first!.editions.map(e => e.id));
    expect(second!.editions.some(e => !ids.has(e.id))).toBe(true);
    // The newest records carry few covers; later pages are where the covers are.
    expect(second!.covers.length).toBeGreaterThan(first!.covers.filter(c => c.source === 'openlibrary').length);
  });

  it('stops offering pages at the end of the work and at the scan cap', async () => {
    // A short page means the work has no more records.
    const short = await getWorkPage(GATSBY, { offset: 300 });
    expect(short!.page.nextOffset).toBeUndefined();

    // A full page near the cap must not offer another one either.
    const fullPage = fixture('the-great-gatsby', 'openlibrary-editions-200.json');
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.includes('/editions.json')) {
        return new Response(JSON.stringify({ size: 5000, entries: fullPage.entries }), { headers: { 'content-type': 'application/json' } });
      }
      const { status = 200, body = {} } = route(url);
      return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    }));
    const atCap = await getWorkPage(GATSBY, { offset: MAX_EDITIONS_SCANNED - 100 });
    expect(atCap!.page.nextOffset).toBeUndefined();
    const below = await getWorkPage(GATSBY, { offset: MAX_EDITIONS_SCANNED - 200 });
    expect(below!.page.nextOffset).toBe(MAX_EDITIONS_SCANNED - 100);
  });

  it('rejects malformed ids and unknown works', async () => {
    await expect(getWorkPage('../etc/passwd')).resolves.toBeNull();
    await expect(getWorkPage('OL999999999W')).resolves.toBeNull();
  });

  it('asks for signatures without failing when the images cannot be hashed', async () => {
    const p = await getWorkPage(GATSBY, { offset: 100, signatures: true, hashDeadlineMs: 200 });
    // The mocked fetch serves JSON, not images, so nothing hashes; the page still loads.
    expect(p!.signatures).toEqual({});
    expect(p!.covers.length).toBeGreaterThan(0);
  });
});

describe('getWorkDetail', () => {
  it('removes translators from the author line using edition data (Reed, not Pellisa Díaz)', async () => {
    const d = await getWorkDetail('OL30751W', { dedupeCovers: false });
    expect(d!.work.authors).toEqual(['Ishmael Reed']);
    expect(d!.editions.every(e => !('authorKeys' in e))).toBe(true);
  });

  it('rejects malformed ids and returns null for unknown works', async () => {
    await expect(getWorkDetail('../etc/passwd')).resolves.toBeNull();
    await expect(getWorkDetail('OL999999999W')).resolves.toBeNull();
  });

  it('walks every page of a work, not just the newest records (SPEC §9.3 step 11)', async () => {
    const first = await getWorkPage('OL468431W', { offset: 0 });
    const whole = await getWorkDetail('OL468431W', { dedupeCovers: false });
    expect(whole!.editions.length).toBeGreaterThan(first!.editions.length);
    expect(whole!.covers.length).toBeGreaterThan(first!.covers.length * 3);
    expect(calls.filter(u => u.includes('/editions.json')).length).toBeGreaterThanOrEqual(4);
  });


  it('loads work, editions and language groups', async () => {
    const d = await getWorkDetail('OL1168083W', { dedupeCovers: false });
    expect(d).not.toBeNull();
    expect(d!.work.title).toBe('Nineteen Eighty-Four');
    expect(d!.work.authors[0]).toBe('George Orwell');
    expect(d!.work.editionCount).toBe(537);
    expect(d!.editions.length).toBeGreaterThan(20);
    expect(d!.editions.every(e => e.workId === 'OL1168083W')).toBe(true);
    expect(d!.covers.length).toBeGreaterThanOrEqual(d!.editions.length);
    expect(d!.covers.every(c => c.editionIds.length >= 1)).toBe(true);
    expect(d!.groups.map(g => g.language)).toContain('es');
    expect(d!.groups.at(-1)!.language).toBeUndefined();
    expect(d!.groups.flatMap(g => g.coverIds).sort()).toEqual(d!.covers.map(c => c.id).sort());
  });

  it('puts the preferred language first, merges Google Books editions by ISBN and keeps both covers (E8)', async () => {
    const without = await getWorkDetail('OL1168083W', { dedupeCovers: false });
    googleBooks = () => ({
      body: {
        items: [
          // Same ISBN as an Open Library edition in the fixture -> deduped, richer one wins.
          { id: 'g-dup', volumeInfo: { title: 'Nineteen Eighty-Four', authors: ['George Orwell'], description: '<p>Big Brother</p>', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788804719137' }], imageLinks: { thumbnail: 'http://books.google.com/dup?zoom=1' }, language: 'en' } },
          { id: 'g-new', volumeInfo: { title: 'Nineteen Eighty-Four', authors: ['George Orwell'], industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780000000000' }], imageLinks: { thumbnail: 'http://books.google.com/new?zoom=1' }, language: 'de' } },
          { id: 'g-other', volumeInfo: { title: 'Animal Farm', authors: ['George Orwell'], imageLinks: { thumbnail: 'http://books.google.com/af?zoom=1' } } },
          // Alternate title of the same work: not attached under identity rule 2 (known limitation, SPEC §8.5).
          { id: 'g-alt', volumeInfo: { title: '1984', authors: ['George Orwell'], imageLinks: { thumbnail: 'http://books.google.com/alt?zoom=1' } } },
        ],
      },
    });
    const d = await getWorkDetail('OL1168083W', { preferredLanguage: 'de', dedupeCovers: false });
    expect(d!.groups[0].language).toBe('de');
    expect(d!.editions.some(e => e.id === 'gb:g-new')).toBe(true);
    expect(d!.editions.some(e => e.id === 'gb:g-other')).toBe(false);
    expect(d!.editions.some(e => e.id === 'gb:g-alt')).toBe(false);
    const dup = d!.editions.find(e => e.isbn13 === '9788804719137');
    expect(dup?.description).toBe('Big Brother');
    // one new edition, one merged into an existing one ...
    expect(d!.editions.length).toBe(without!.editions.length + 1);
    // ... but both Google covers survive: the merged ISBN now carries two covers
    expect(d!.covers.length).toBe(without!.covers.length + 2);
    expect(d!.covers.filter(c => c.editionIds.includes(dup!.id)).map(c => c.source).sort()).toEqual(['googlebooks', 'openlibrary']);
    expect(decodeURIComponent(calls.find(u => u.includes('googleapis'))!)).toContain('inauthor:George Orwell');
  });
});
