/** The suggestion gate and store (ROADMAP 5.10a, SPEC F8.4). */
import { describe, expect, it } from 'vitest';
import { adminMatches, passwordMatches, sessionToken, sessionValid, suggestEnabled } from '../suggest/auth';
import { commandsSuggestStore, memorySuggestStore, parseSuggestion } from '../suggest/store';
import type { RedisCommands } from '../hotornot/store';

const env = { SUGGEST_PASSWORD: 'lesezeichen', SUGGEST_ADMIN_PASSWORD: 'julian-only' };

describe('the gate', () => {
  it('does not exist without a password', () => {
    expect(suggestEnabled({})).toBe(false);
    expect(suggestEnabled({ SUGGEST_PASSWORD: '  ' })).toBe(false);
    expect(passwordMatches('', {})).toBe(false);
    expect(sessionValid(sessionToken(0, env), 0, {})).toBe(false);
  });

  it('checks the friends’ password and keeps the admin one apart', () => {
    expect(passwordMatches('lesezeichen', env)).toBe(true);
    expect(passwordMatches(' lesezeichen ', env)).toBe(true);
    expect(passwordMatches('Lesezeichen', env)).toBe(false);
    expect(passwordMatches(42, env)).toBe(false);
    expect(adminMatches('lesezeichen', env)).toBe(false);
    expect(adminMatches('julian-only', env)).toBe(true);
    expect(adminMatches('julian-only', { SUGGEST_PASSWORD: 'x' })).toBe(false);
  });

  it('accepts its own cookie until it expires, and none after a password change', () => {
    const now = 1_700_000_000_000;
    const token = sessionToken(now, env);
    expect(sessionValid(token, now + 1000, env)).toBe(true);
    expect(sessionValid(token, now + 31 * 24 * 3600 * 1000, env)).toBe(false);
    expect(sessionValid(token, now, { ...env, SUGGEST_PASSWORD: 'neu' })).toBe(false);
    const [expires] = token.split('.');
    expect(sessionValid(`${Number(expires) + 1}.${token.split('.')[1]}`, now, env)).toBe(false);
    expect(sessionValid('garbage', now, env)).toBe(false);
    expect(sessionValid(undefined, now, env)).toBe(false);
  });
});

describe('parseSuggestion', () => {
  const work = { id: 'OL2756289W', title: 'Die Wand', author: 'Marlen Haushofer', coverId: 'ol:5271497' };
  const day = new Date('2026-09-24T12:00:00Z');

  it('keeps what the friend chose and typed, clipped, and nothing else', () => {
    const s = parseSuggestion({ collection: 'women-writers', work, note: ' the  green one ', by: 'Anna', ip: '1.2.3.4' }, ['women-writers'], day);
    expect(s).toMatchObject({ on: '2026-09-24', collection: 'women-writers', work, note: 'the green one', by: 'Anna' });
    expect(JSON.stringify(s)).not.toContain('1.2.3.4');
  });

  it('takes an idea for a new collection', () => {
    const s = parseSuggestion({ newCollection: 'Penguin Modern Classics', work }, [], day);
    expect(s).toMatchObject({ collection: null, newCollection: 'Penguin Modern Classics' });
  });

  it('says what is missing', () => {
    expect(parseSuggestion({ collection: 'women-writers', work: { ...work, id: 'x' } }, ['women-writers'])).toMatch(/book/);
    expect(parseSuggestion({ collection: 'women-writers', work: { ...work, coverId: '' } }, ['women-writers'])).toMatch(/cover/);
    expect(parseSuggestion({ collection: 'nope', work }, ['women-writers'])).toMatch(/does not exist/);
    expect(parseSuggestion({ work }, ['women-writers'])).toMatch(/collection/);
  });
});

describe('stores', () => {
  it('memory keeps the first decision', async () => {
    const store = memorySuggestStore();
    await store.decide('a', 'taken');
    await store.decide('a', 'declined');
    expect(await store.decisions()).toEqual({ a: 'taken' });
  });

  it('redis reads back what it wrote and skips damaged entries', async () => {
    const lists = new Map<string, string[]>();
    const hashes = new Map<string, Map<string, string>>();
    const commands = {
      rPush: async (k: string, v: string) => lists.set(k, [...(lists.get(k) ?? []), v]),
      lRange: async (k: string) => [...(lists.get(k) ?? []), 'not json'],
      hGetAll: async (k: string) => hashes.get(k) ?? new Map(),
      hSetNX: async (k: string, f: string, v: string) => {
        const h = hashes.get(k) ?? new Map<string, string>();
        if (!h.has(f)) h.set(f, v);
        hashes.set(k, h);
      },
    } as unknown as RedisCommands;
    const store = commandsSuggestStore(commands);
    const s = parseSuggestion({ collection: 'w', work: { id: 'OL1W', title: 'T', author: 'A', coverId: 'ol:1' } }, ['w']);
    if (typeof s === 'string') throw new Error(s);
    await store.add(s);
    expect(await store.list()).toEqual([s]);
    await store.decide(s.id, 'declined');
    expect(await store.decisions()).toEqual({ [s.id]: 'declined' });
  });
});
