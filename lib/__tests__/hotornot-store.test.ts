import { describe, expect, it, vi } from 'vitest';
import {
  STORE_LOOKED_FOR, StoreUnavailableError, memoryStore, missingStoreMessage, storeConfig, storeFromEnv, upstashStore,
} from '../hotornot/store';

const vote = { a: 'ol:1', b: 'ol:2', winner: 'ol:1', on: '2026-09-11' };

describe('the memory store', () => {
  it('keeps votes in order, per pool', async () => {
    const store = memoryStore();
    await store.add('p', vote);
    await store.add('p', { ...vote, winner: 'ol:2' });
    await store.add('q', vote);
    expect((await store.votes('p')).map(v => v.winner)).toEqual(['ol:1', 'ol:2']);
    expect(await store.votes('q')).toHaveLength(1);
  });

  it('keeps the first reason a cover was reported for', async () => {
    const store = memoryStore();
    await store.flag('p', { id: 'ol:9', reason: 'broken' });
    await store.flag('p', { id: 'ol:9', reason: 'reported' });
    expect(await store.flags('p')).toEqual([{ id: 'ol:9', reason: 'broken' }]);
  });

  it('lets a pair token be used once, until it has expired', async () => {
    let now = 1000;
    const store = memoryStore(() => now);
    expect(await store.claim('t', 60)).toBe(true);
    expect(await store.claim('t', 60)).toBe(false);
    now += 61_000;
    expect(await store.claim('t', 60)).toBe(true);
  });
});

describe('the Upstash store', () => {
  function recorder(answer: (body: unknown[]) => unknown, status = 200) {
    const calls: Array<{ url: string; body: unknown[]; auth: string | null }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as unknown[];
      calls.push({ url: String(url), body, auth: new Headers(init?.headers).get('Authorization') });
      return new Response(JSON.stringify(answer(body)), { status, headers: { 'content-type': 'application/json' } });
    });
    return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
  }

  it('sends one command as a JSON array with the token as a bearer header', async () => {
    const { calls, fetchImpl } = recorder(() => ({ result: 1 }));
    await upstashStore('https://x.upstash.io', 'secret', fetchImpl).add('p', vote);
    expect(calls[0].url).toBe('https://x.upstash.io');
    expect(calls[0].auth).toBe('Bearer secret');
    expect(calls[0].body).toEqual(['RPUSH', 'versus:p:votes', JSON.stringify(vote)]);
  });

  it('reads the votes back and skips a line it cannot read', async () => {
    const { fetchImpl } = recorder(() => ({ result: [JSON.stringify(vote), 'not json', JSON.stringify({ a: 1 })] }));
    expect(await upstashStore('u', 't', fetchImpl).votes('p')).toEqual([vote]);
  });

  it('reads the flags from the flat field-value list HGETALL answers', async () => {
    const { fetchImpl } = recorder(() => ({ result: ['ol:9', 'broken', 'ol:8', 'reported'] }));
    expect(await upstashStore('u', 't', fetchImpl).flags('p')).toEqual([
      { id: 'ol:9', reason: 'broken' },
      { id: 'ol:8', reason: 'reported' },
    ]);
  });

  it('claims a token with SET NX EX, and only the first claim wins', async () => {
    let first = true;
    const { calls, fetchImpl } = recorder(() => {
      const result = first ? 'OK' : null;
      first = false;
      return { result };
    });
    const store = upstashStore('u', 't', fetchImpl);
    expect(await store.claim('tok', 3600)).toBe(true);
    expect(await store.claim('tok', 3600)).toBe(false);
    expect(calls[0].body).toEqual(['SET', 'versus:token:tok', 1, 'NX', 'EX', 3600]);
  });

  // A silent store is not an empty board (SPEC F1.7, N12).
  it('reports silence as silence: an error status, an error body, a failed request', async () => {
    const down = recorder(() => ({}), 500);
    await expect(upstashStore('u', 't', down.fetchImpl).votes('p')).rejects.toBeInstanceOf(StoreUnavailableError);
    const refused = recorder(() => ({ error: 'WRONGPASS' }));
    await expect(upstashStore('u', 't', refused.fetchImpl).votes('p')).rejects.toBeInstanceOf(StoreUnavailableError);
    const offline = vi.fn(async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    await expect(upstashStore('u', 't', offline).add('p', vote)).rejects.toBeInstanceOf(StoreUnavailableError);
  });
});

describe('finding the store in the environment', () => {
  it('matches the end of the name under the STORAGE_ prefix, whichever naming the integration used', () => {
    expect(storeConfig({ STORAGE_KV_REST_API_URL: 'https://a', STORAGE_KV_REST_API_TOKEN: 'x' }))
      .toEqual({ url: 'https://a', token: 'x' });
    expect(storeConfig({ STORAGE_REST_API_URL: 'https://b', STORAGE_REST_API_TOKEN: 'y' }))
      .toEqual({ url: 'https://b', token: 'y' });
    expect(storeConfig({ STORAGE_UPSTASH_REDIS_REST_URL: 'https://c', STORAGE_UPSTASH_REDIS_REST_TOKEN: 'z' }))
      .toEqual({ url: 'https://c', token: 'z' });
  });

  it('never takes the read-only token, nor anything without the prefix', () => {
    expect(storeConfig({ STORAGE_KV_REST_API_URL: 'https://a', STORAGE_KV_REST_API_READ_ONLY_TOKEN: 'r' })).toBeNull();
    expect(storeConfig({ KV_REST_API_URL: 'https://a', KV_REST_API_TOKEN: 'x' })).toBeNull();
  });

  it('says what it looked for without ever saying a value', () => {
    expect(STORE_LOOKED_FOR.join(' ')).toContain('STORAGE_');
    expect(STORE_LOOKED_FOR.join(' ')).not.toMatch(/https?:/);
  });

  // The first preview said "not configured" although the store was connected (2026-09-11).
  it('names the STORAGE_ variables a preview does have, never their values, and says nothing of them in production', () => {
    const env = { VERCEL_ENV: 'preview', STORAGE_URL: 'rediss://default:secret@x.upstash.io:6379', OTHER: 'y' };
    const message = missingStoreMessage(env);
    expect(message).toContain('STORAGE_URL');
    expect(message).not.toContain('secret');
    expect(message).not.toContain('OTHER');
    expect(missingStoreMessage({ VERCEL_ENV: 'preview' })).toContain('No variable');
    expect(missingStoreMessage({ ...env, VERCEL_ENV: 'production' })).not.toContain('STORAGE_URL');
  });

  it('plays from memory on a laptop, and refuses to in a production build without a store', () => {
    expect(storeFromEnv({ NODE_ENV: 'development' })?.kind).toBe('memory');
    expect(storeFromEnv({ NODE_ENV: 'production' })).toBeNull();
    expect(storeFromEnv({ NODE_ENV: 'production', STORAGE_KV_REST_API_URL: 'https://a', STORAGE_KV_REST_API_TOKEN: 'x' })?.kind)
      .toBe('upstash');
  });
});
