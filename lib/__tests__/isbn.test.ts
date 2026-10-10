/**
 * The retail cover for one ISBN (SPEC §9.3 step 13a, lib/isbn.ts).
 * Google Books is mocked; no image is ever fetched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetGoogleQuota } from '../googlequota';
import { CANARY_ISBNS, resetGoogleFields } from '../googlefields';
import { getIsbnCovers, isIsbn13 } from '../isbn';

const BELOVED = '9780307388629';
let handler: (url: URL) => { status?: number; body?: unknown };
let olHandler: (url: URL) => { status?: number; body?: unknown };
const calls: string[] = [];

function volume(id: string, isbn13: string) {
  return {
    id,
    volumeInfo: {
      title: 'Beloved',
      authors: ['Toni Morrison'],
      industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn13 }],
      imageLinks: { thumbnail: `http://books.google.com/${id}?zoom=1` },
      language: 'en',
    },
  };
}

beforeEach(() => {
  // The Google breaker is module state: one test that provokes a 429 would
  // otherwise silence Google for every test after it (lib/googlequota.ts).
  resetGoogleQuota();
  resetGoogleFields();
  calls.length = 0;
  vi.stubEnv('GOOGLE_BOOKS_API_KEY', 'test-key');
  handler = () => ({ body: { items: [volume('v1', BELOVED)] } });
  // Open Library's record for the ISBN, the fallback (ROADMAP 1.12); a test replaces it to make it fail.
  olHandler = () => ({ body: { covers: [12547191, -1] } });
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    const { status = 200, body = {} } = url.hostname === 'openlibrary.org' ? olHandler(url) : handler(url);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('isIsbn13', () => {
  it('accepts thirteen digits and nothing else', () => {
    expect(isIsbn13(BELOVED)).toBe(true);
    expect(isIsbn13('0307388621')).toBe(false);
    expect(isIsbn13(undefined)).toBe(false);
  });
});

describe('getIsbnCovers', () => {
  it('does not believe an empty Google answer when the canaries are empty too: the catalogue answers (1.13)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    handler = () => ({ body: { totalItems: 0 } });
    const r = await getIsbnCovers(BELOVED);
    expect(r?.source).toBe('openlibrary');
    expect(r?.covers.map(c => c.id)).toEqual(['ol:12547191']);
    // The ISBN, then both canaries by `isbn:`, then Open Library.
    expect(calls.filter(u => u.includes('googleapis')).map(u => new URL(u).searchParams.get('q'))).toEqual([`isbn:${BELOVED}`, ...CANARY_ISBNS.map(c => `isbn:${c}`)]);
    // While held broken, the next ISBN goes straight to the catalogue without a Google request.
    calls.length = 0;
    await getIsbnCovers('9780140189834');
    expect(calls.some(u => u.includes('googleapis'))).toBe(false);
    warn.mockRestore();
  });

  it('believes an empty Google answer when a canary is listed', async () => {
    handler = url => (CANARY_ISBNS.some(c => url.searchParams.get('q') === `isbn:${c}`) ? { body: { items: [volume('c', CANARY_ISBNS[0])] } } : { body: { totalItems: 0 } });
    const r = await getIsbnCovers(BELOVED);
    expect(r?.source).toBe('googlebooks');
    expect(r?.covers).toEqual([]);
  });

  it('asks Google once for the ISBN and returns the cover it shows', async () => {
    const r = await getIsbnCovers(BELOVED);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain(`isbn:${BELOVED}`);
    expect(r).toMatchObject({ isbn13: BELOVED });
    expect(r!.covers).toHaveLength(1);
    expect(r!.covers[0]).toMatchObject({ id: 'gb:v1', source: 'googlebooks' });
    expect(r!.covers[0].url).toContain('zoom=1');
  });

  it('accepts a hyphenated ISBN and normalises it', async () => {
    const r = await getIsbnCovers('978-0-307-38862-9');
    expect(r!.isbn13).toBe(BELOVED);
  });

  it('rejects anything that is not an ISBN-13 without calling out', async () => {
    await expect(getIsbnCovers('not-an-isbn')).resolves.toBeNull();
    await expect(getIsbnCovers('')).resolves.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('returns an empty list when Google has no image, which is not an error', async () => {
    // Nothing for this ISBN while the canaries are listed: Google's answer, not Google's fault (1.13).
    handler = url => (url.searchParams.get('q') === `isbn:${BELOVED}` ? { body: { items: [] } } : { body: { items: [volume('c', CANARY_ISBNS[0])] } });
    await expect(getIsbnCovers(BELOVED)).resolves.toEqual({ isbn13: BELOVED, covers: [], source: 'googlebooks' });
  });

  it('ignores volumes that do not actually carry the ISBN', async () => {
    handler = () => ({ body: { items: [volume('other', '9780000000000')] } });
    expect((await getIsbnCovers(BELOVED))!.covers).toEqual([]);
  });

  it('survives Google failing', async () => {
    handler = () => ({ status: 429 });
    await expect(getIsbnCovers(BELOVED)).resolves.toMatchObject({ isbn13: BELOVED });
  });
});

describe('getIsbnCovers when Google is flaky', () => {
  it('retries once, because Google answers a transient 503 often enough to matter', async () => {
    let n = 0;
    handler = () => (++n === 1 ? { status: 503 } : { body: { items: [volume('v1', BELOVED)] } });
    const r = await getIsbnCovers(BELOVED);
    expect(calls).toHaveLength(2);
    expect(r!.covers).toHaveLength(1);
    expect(r!.unavailable).toBeUndefined();
  });

  it('asks Open Library’s record when Google fails twice, and says whose answer it is (ROADMAP 1.12)', async () => {
    handler = () => ({ status: 503 });
    const r = await getIsbnCovers(BELOVED);
    expect(calls.filter(u => u.includes('googleapis'))).toHaveLength(2);
    expect(calls.filter(u => u.includes('openlibrary.org/isbn/9780307388629.json'))).toHaveLength(1);
    expect(r).toMatchObject({ isbn13: BELOVED, source: 'openlibrary' });
    expect(r!.unavailable).toBeUndefined();
    // The -1 Open Library writes for a removed scan is not a cover.
    expect(r!.covers.map(c => c.id)).toEqual(['ol:12547191']);
    expect(r!.covers[0]).toMatchObject({ source: 'openlibrary', url: 'https://covers.openlibrary.org/b/id/12547191-L.jpg' });
  });

  it('says the source was unavailable only when Open Library is silent too', async () => {
    handler = () => ({ status: 503 });
    olHandler = () => ({ status: 503 });
    const r = await getIsbnCovers(BELOVED);
    expect(r).toMatchObject({ isbn13: BELOVED, covers: [], unavailable: true });
    expect(r!.source).toBeUndefined();
  });

  it('takes a missing Open Library record as "no cover on record", not as silence', async () => {
    handler = () => ({ status: 503 });
    olHandler = () => ({ status: 404 });
    await expect(getIsbnCovers(BELOVED)).resolves.toEqual({ isbn13: BELOVED, covers: [], source: 'openlibrary' });
  });

  it('falls back to Open Library, and asks Google nobody, once the day\'s quota is gone', async () => {
    // The quota read on 2026-09-07 is 1,000 a day, so this is a day that will
    // come. What must not happen is telling the reader no cover is on record
    // (SPEC §8.7 point 5) — and since ROADMAP 1.12 the catalogue stands in.
    handler = () => ({
      status: 403,
      body: { error: { code: 403, errors: [{ reason: 'dailyLimitExceeded' }] } },
    });
    const first = await getIsbnCovers(BELOVED);
    expect(first).toMatchObject({ source: 'openlibrary' });

    calls.length = 0;
    const second = await getIsbnCovers('9780141036144');
    expect(second).toMatchObject({ source: 'openlibrary' });
    // Not one further Google request: an exhausted quota only collects errors.
    expect(calls.filter(u => u.includes('googleapis'))).toHaveLength(0);
    expect(calls.filter(u => u.includes('openlibrary.org'))).toHaveLength(1);
  });

  it('falls back to Open Library without an API key instead of an empty answer', async () => {
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', '');
    expect(await getIsbnCovers(BELOVED)).toMatchObject({ source: 'openlibrary' });
    expect(calls.filter(u => u.includes('googleapis'))).toHaveLength(0);
  });
});
