/**
 * The retail cover for one ISBN (SPEC §9.3 step 13a, lib/isbn.ts).
 * Google Books is mocked; no image is ever fetched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getIsbnCovers, isIsbn13 } from '../isbn';

const BELOVED = '9780307388629';
let handler: (url: URL) => { status?: number; body?: unknown };
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
  calls.length = 0;
  vi.stubEnv('GOOGLE_BOOKS_API_KEY', 'test-key');
  handler = () => ({ body: { items: [volume('v1', BELOVED)] } });
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url.toString());
    const { status = 200, body = {} } = handler(url);
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
    handler = () => ({ body: { items: [] } });
    await expect(getIsbnCovers(BELOVED)).resolves.toEqual({ isbn13: BELOVED, covers: [] });
  });

  it('ignores volumes that do not actually carry the ISBN', async () => {
    handler = () => ({ body: { items: [volume('other', '9780000000000')] } });
    expect((await getIsbnCovers(BELOVED))!.covers).toEqual([]);
  });

  it('survives Google failing', async () => {
    handler = () => ({ status: 429 });
    await expect(getIsbnCovers(BELOVED)).resolves.toMatchObject({ isbn13: BELOVED, covers: [] });
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

  it('says the source was unavailable rather than pretending there is no cover', async () => {
    handler = () => ({ status: 503 });
    const r = await getIsbnCovers(BELOVED);
    expect(calls).toHaveLength(2);
    expect(r).toMatchObject({ isbn13: BELOVED, covers: [], unavailable: true });
  });

  it('reports unavailable without an API key instead of an empty answer', async () => {
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', '');
    expect(await getIsbnCovers(BELOVED)).toMatchObject({ unavailable: true });
    expect(calls).toHaveLength(0);
  });
});
