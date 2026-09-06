/**
 * Client behaviour with a mocked fetch: timeouts, HTTP errors, paging,
 * cache options. Responses come from the recorded fixtures.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchVolumes, searchEditionCandidates } from '../sources/googlebooks';
import { HttpError, fetchJson } from '../sources/http';
import { getEditions, getEditionsPage, getWork, searchWorks } from '../sources/openlibrary';

const FIXTURES = path.join(__dirname, '..', '__fixtures__');
const fixture = (slug: string, file: string) => JSON.parse(readFileSync(path.join(FIXTURES, slug, file), 'utf8'));

type Handler = (url: string) => { status?: number; body?: unknown };

let handler: Handler;
const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  handler = () => ({ status: 500 });
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    const { status = 200, body = {} } = handler(url);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('passes timeout signal and Next cache option, throws HttpError on non-2xx', async () => {
    handler = () => ({ body: { ok: true } });
    await expect(fetchJson('https://x/a', { timeoutMs: 100, revalidate: 42 })).resolves.toEqual({ ok: true });
    const init = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit & { next?: unknown };
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.next).toEqual({ revalidate: 42 });

    handler = () => ({ status: 429 });
    await expect(fetchJson('https://x/b', { timeoutMs: 100, revalidate: 0 })).rejects.toBeInstanceOf(HttpError);
  });
});

describe('searchWorks', () => {
  it('parses the recorded response and requests only the needed fields', async () => {
    handler = () => ({ body: fixture('1984', 'openlibrary-search.json') });
    const works = await searchWorks('1984');
    expect(works.length).toBeGreaterThan(5);
    expect(works[0].coverUrls[0]).toMatch(/^https:\/\/covers\.openlibrary\.org\//);
    expect(calls[0]).toContain('fields=key,title');
    expect(calls[0]).toContain('q=1984');
  });
  it('returns [] on HTTP error and on timeout instead of throwing (F3.3)', async () => {
    handler = () => ({ status: 503 });
    await expect(searchWorks('x')).resolves.toEqual([]);
    // AbortSignal.timeout uses internal timers that fake timers cannot advance,
    // so the timeout is simulated by the mock rejecting the way fetch does.
    handler = () => { const e = new Error('timeout'); e.name = 'TimeoutError'; throw e; };
    await expect(searchWorks('x')).resolves.toEqual([]);
  });
});

describe('getWork', () => {
  it('uses one search-by-key request when the work is indexed', async () => {
    handler = url => {
      if (url.includes('q=key')) return { body: { docs: [{ key: '/works/OL1168083W', title: 'Nineteen Eighty-Four', author_name: ['George Orwell', 'George Orwell'], first_publish_year: 1949, edition_count: 537, cover_i: 1 }] } };
      return { status: 500 };
    };
    const w = await getWork('OL1168083W');
    expect(w).toEqual({ id: 'OL1168083W', title: 'Nineteen Eighty-Four', authors: ['George Orwell'], firstPublishYear: 1949, editionCount: 537 });
    expect(calls).toHaveLength(1);
    expect(decodeURIComponent(calls[0])).toContain('q=key:/works/OL1168083W');
  });
  it('falls back to the work document and resolves author keys, null on 404', async () => {
    handler = url => {
      if (url.includes('q=key')) return { body: { docs: [] } };
      if (url.endsWith('/works/OL1168083W.json')) return { body: { key: '/works/OL1168083W', title: 'Nineteen Eighty-Four', authors: [{ author: { key: '/authors/OL118077A' } }], first_publish_date: 'June 8, 1949' } };
      if (url.endsWith('/authors/OL118077A.json')) return { body: { name: 'George Orwell' } };
      return { status: 404 };
    };
    const w = await getWork('OL1168083W');
    expect(w).toEqual({ id: 'OL1168083W', title: 'Nineteen Eighty-Four', authors: ['George Orwell'], firstPublishYear: 1949 });
    await expect(getWork('OL0W')).resolves.toBeNull();
  });
  it('throws on transport errors of the document path so the page can show an error state', async () => {
    handler = () => ({ status: 500 });
    await expect(getWork('OL1W')).rejects.toBeInstanceOf(HttpError);
  });
});

describe('getEditions', () => {
  const work = { id: 'OL1168083W', title: 'Nineteen Eighty-Four', authors: ['George Orwell'] };
  const page = fixture('1984', 'openlibrary-editions.json') as { size: number; entries: unknown[] };

  it('reads one page and reports the total size', async () => {
    handler = () => ({ body: { size: page.size, entries: page.entries } });
    const p = await getEditionsPage(work.id, 0);
    expect(p.size).toBe(537);
    expect(p.entries).toHaveLength(100);
    expect(calls[0]).toContain('limit=100&offset=0');
  });

  it('pages until enough covers are found, within the entry budget', async () => {
    handler = () => ({ body: { size: 537, entries: page.entries } });
    const eds = await getEditions(work, { minWithCovers: 40, maxEntries: 500 });
    // 24 covers per recorded page -> 2 pages needed for 40
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain('offset=100');
    expect(eds.length).toBeGreaterThanOrEqual(40);
    expect(eds.every(e => e.workId === work.id && e.covers.length > 0)).toBe(true);
  });

  it('stops at the entry budget and at the last page', async () => {
    handler = () => ({ body: { size: 537, entries: page.entries } });
    await getEditions(work, { minWithCovers: 1000, maxEntries: 250 });
    expect(calls).toHaveLength(3);

    calls.length = 0;
    handler = () => ({ body: { size: 23, entries: page.entries.slice(0, 23) } });
    await getEditions(work, { minWithCovers: 1000, maxEntries: 500 });
    expect(calls).toHaveLength(1);
  });

  it('returns [] for an unknown work', async () => {
    handler = () => ({ status: 404 });
    await expect(getEditions(work)).resolves.toEqual([]);
  });
});

describe('googlebooks', () => {
  it('appends the API key only when configured and never throws', async () => {
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', '');
    handler = () => ({ status: 429 });
    await expect(searchVolumes('1984')).resolves.toEqual([]);
    expect(calls[0]).not.toContain('key=');

    vi.stubEnv('GOOGLE_BOOKS_API_KEY', 'abc');
    handler = () => ({ body: { items: [{ id: 'v1', volumeInfo: { title: '1984', authors: ['George Orwell'], imageLinks: { thumbnail: 'http://books.google.com/x?zoom=1&edge=curl' }, language: 'en' } }] } });
    const items = await searchVolumes('1984');
    expect(calls[1]).toContain('key=abc');
    expect(items).toHaveLength(1);
    expect(items[0].coverUrl).toBe('https://books.google.com/x?zoom=2');

    const cands = await searchEditionCandidates('1984', 'George Orwell');
    expect(decodeURIComponent(calls[2])).toContain('intitle:1984 inauthor:George Orwell');
    expect(cands).toHaveLength(1);
    vi.unstubAllEnvs();
  });
});
