/**
 * The search route's promise about its own answers (SPEC §3 F1.7).
 *
 * A 200 means Open Library answered; an empty `works` inside one means it had
 * nothing. Anything else is a status. This is tested at the route rather than
 * in `lib/` because the cache header is part of the promise: an outage cached
 * for a day would keep telling every visitor that the book does not exist.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/search/route';
import { resetRateLimits } from '../ratelimit';

/** Each test gets its own client so the token buckets never interfere. */
let client = 0;
function get(queryString: string): Promise<Response> {
  const url = new URL(`http://localhost/api/search${queryString}`);
  return GET(new NextRequest(url, { headers: { 'x-forwarded-for': `203.0.113.${++client}` } }));
}

let respond: () => Response;

beforeEach(() => {
  resetRateLimits();
  respond = () => new Response(JSON.stringify({ docs: [] }), { headers: { 'content-type': 'application/json' } });
  vi.stubGlobal('fetch', vi.fn(async () => respond()));
});
afterEach(() => vi.unstubAllGlobals());

describe('GET /api/search', () => {
  it('answers 503 and forbids caching when Open Library times out', async () => {
    respond = () => { const e = new Error('timed out'); e.name = 'TimeoutError'; throw e; };
    const res = await get('?q=norwegian+wood');

    // The bug this replaces: 200 with works: [], which the UI showed as
    // "No books found" for a book with 124 works in the catalogue.
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'Open Library did not answer' });
  });

  it('answers 503 when Open Library returns an error status', async () => {
    respond = () => new Response('upstream is unwell', { status: 502 });
    const res = await get('?q=norwegian+wood');
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers 200 with an empty list when the catalogue answered and had nothing', async () => {
    const res = await get('?q=zzzznotabook');
    expect(res.status).toBe(200);
    expect((await res.json()).works).toEqual([]);
    // Only a real answer is worth caching.
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
  });

  it('refuses a query too short to ask instead of reporting it as nothing found', async () => {
    // Open Library replies 422 "Query too short" for these, which used to
    // reach the reader as "No books found" for a search like `it`.
    const res = await get('?q=it');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least 3/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('still refuses an empty query', async () => {
    const res = await get('?q=%20%20');
    expect(res.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});
