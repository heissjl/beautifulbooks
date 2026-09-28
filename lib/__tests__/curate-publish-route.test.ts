/**
 * The read side of /api/curate/publish (ROADMAP 6.54): the Cockpit asks it
 * what the running site lays over the file. Julian only, like publishing.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/curate/publish/route';
import { publishStoreFromEnv } from '../collections-live';
import { resetRateLimits } from '../ratelimit';

let client = 0;
function get(authorization?: string): Promise<Response> {
  const headers: Record<string, string> = { 'x-forwarded-for': `198.51.100.${++client}` };
  if (authorization) headers.authorization = authorization;
  return GET(new NextRequest(new URL('http://localhost/api/curate/publish'), { headers }));
}

beforeEach(() => {
  resetRateLimits();
  vi.stubEnv('SUGGEST_PASSWORD', 'friends-test');
  vi.stubEnv('SUGGEST_ADMIN_PASSWORD', 'admin-test');
  vi.stubEnv('STORAGE_REDIS_URL', '');
  vi.stubEnv('STORAGE_KV_REST_API_URL', '');
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /api/curate/publish', () => {
  it('answers 404 when suggestions are off, as if it did not exist', async () => {
    vi.stubEnv('SUGGEST_PASSWORD', '');
    expect((await get('Bearer admin-test')).status).toBe(404);
  });

  it('refuses anyone without the admin password', async () => {
    expect((await get()).status).toBe(403);
    expect((await get('Bearer friends-test')).status).toBe(403);
  });

  it('gives Julian the switches and the published drafts, and caches nothing', async () => {
    const store = publishStoreFromEnv()!;
    await store.set({ 'women-writers': true });
    await store.setContent({
      'tiptree-award': { slug: 'tiptree-award', title: 'Tiptree', kind: 'authors', intro: '', published: true, works: [] },
    });
    const res = await get('Bearer admin-test');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();
    expect(body.switches).toEqual({ 'women-writers': true });
    expect(Object.keys(body.content)).toEqual(['tiptree-award']);
    await store.set({});
    await store.setContent({});
  });
});
