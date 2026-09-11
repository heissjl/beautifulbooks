import { describe, expect, it } from 'vitest';
import { rng } from '../loading';
import { CROWN_HOLD } from '../hotornot/rating';
import { POOL, board, castVote, flagCover, imagePath, nextPairFor, type VersusPool } from '../hotornot/game';
import { memoryStore } from '../hotornot/store';
import { pairSecret } from '../hotornot/token';

const pool: VersusPool = {
  name: 'test',
  builtAt: '2026-09-11',
  indexBuiltAt: '2026-09-09',
  excluded: [],
  covers: Array.from({ length: 6 }, (_, i) => ({ id: `ol:${i + 1}`, workId: `OL${i + 1}W`, title: `Book ${i + 1}`, author: 'A' })),
};
const secret = pairSecret(undefined);
const now = Date.UTC(2026, 8, 11, 12);

describe('a pair from the server', () => {
  it('is two covers of the pool, through our image route, with a token a vote accepts', async () => {
    const store = memoryStore();
    const pair = await nextPairFor(store, secret, { pool, random: rng(1), now });
    expect(pair).not.toBeNull();
    if (!pair) return;
    expect(pair.a.id).not.toBe(pair.b.id);
    expect(pool.covers.map(c => c.id)).toContain(pair.a.id);
    expect(pair.a.src).toBe(imagePath(pair.a.id, 'L'));
    expect(pair.a.src.startsWith('/img/L/ol-')).toBe(true);
    // Title and author under each cover since 2026-09-11.
    const book = pool.covers.find(c => c.id === pair.a.id);
    expect(pair.a).toMatchObject({ title: book?.title, author: book?.author, workId: book?.workId });
    // What the share button under a cover passes on: the book page with this cover selected.
    expect(pair.a.href).toBe(`/book/${book?.workId}/cover/${pair.a.id.replace(':', '-')}`);
    const outcome = await castVote(store, secret, { a: pair.a.id, b: pair.b.id, winner: pair.b.id, token: pair.token }, { pool, now });
    // Once the vote is in, the book behind the chosen cover may be named, with the way to it.
    expect(outcome).toEqual({
      ok: true,
      chosen: expect.objectContaining({ id: pair.b.id, href: expect.stringMatching(/^\/book\/OL\d+W\/cover\/ol-\d+$/) }),
    });
    expect(await store.votes('test')).toEqual([{ a: pair.a.id, b: pair.b.id, winner: pair.b.id, on: '2026-09-11' }]);
  });
});

// The 1000-cover pool grew from the 200-book one after friends had cast 35 votes on it.
describe('a pool that grew from another', () => {
  it('counts the votes and reports of the pool it inherits, for the covers it still holds', async () => {
    const store = memoryStore();
    const grown: VersusPool = { ...pool, name: 'test-grown', inherits: ['test'] };
    await store.add('test', { a: 'ol:1', b: 'ol:2', winner: 'ol:1', on: '2026-09-11' });
    await store.add('test', { a: 'ol:1', b: 'ol:99', winner: 'ol:99', on: '2026-09-11' }); // a cover the new pool dropped
    await store.flag('test', { id: 'ol:6', reason: 'reported' });
    await store.add('test-grown', { a: 'ol:3', b: 'ol:4', winner: 'ol:4', on: '2026-09-11' });
    const result = await board(store, { pool: grown });
    expect(result.votes).toBe(2);
    expect(result.covers).toBe(5);
    expect(result.flagged).toBe(1);
  });
});

describe('a vote the server did not ask for', () => {
  async function fresh() {
    const store = memoryStore();
    const pair = await nextPairFor(store, secret, { pool, random: rng(2), now });
    if (!pair) throw new Error('no pair');
    return { store, pair };
  }

  it('is refused for a forged token, a cover not shown, a winner not on screen', async () => {
    const { store, pair } = await fresh();
    const base = { a: pair.a.id, b: pair.b.id, token: pair.token };
    expect((await castVote(store, secret, { ...base, winner: pair.a.id, token: `${pair.token}x` }, { pool, now })).ok).toBe(false);
    expect((await castVote(store, secret, { ...base, a: 'ol:99', winner: 'ol:99' }, { pool, now })).ok).toBe(false);
    const offScreen = pool.covers.find(c => c.id !== pair.a.id && c.id !== pair.b.id)?.id ?? '';
    expect((await castVote(store, secret, { ...base, winner: offScreen }, { pool, now })).ok).toBe(false);
    expect((await castVote(store, secret, { ...base, winner: pair.a.id }, { pool, now: now + 2 * 3600 * 1000 })).ok).toBe(false);
    expect(await store.votes('test')).toEqual([]);
  });

  it('counts once, however often the same pair is sent', async () => {
    const { store, pair } = await fresh();
    const input = { a: pair.a.id, b: pair.b.id, winner: pair.a.id, token: pair.token };
    expect((await castVote(store, secret, input, { pool, now })).ok).toBe(true);
    expect(await castVote(store, secret, input, { pool, now })).toEqual({ ok: false, status: 409, error: expect.any(String) });
    expect(await store.votes('test')).toHaveLength(1);
  });
});

describe('a cover reported as not a cover', () => {
  it('leaves the game for everyone, and only a cover that was on screen can be reported', async () => {
    const store = memoryStore();
    const pair = await nextPairFor(store, secret, { pool, random: rng(3), now });
    if (!pair) throw new Error('no pair');
    const other = pool.covers.find(c => c.id !== pair.a.id && c.id !== pair.b.id)?.id ?? '';
    expect((await flagCover(store, secret, { id: other, reason: 'reported', a: pair.a.id, b: pair.b.id, token: pair.token }, { pool, now })).ok)
      .toBe(false);
    expect(await flagCover(store, secret, { id: pair.a.id, reason: 'reported', a: pair.a.id, b: pair.b.id, token: pair.token }, { pool, now }))
      .toEqual({ ok: true });
    const random = rng(4);
    for (let i = 0; i < 40; i++) {
      const next = await nextPairFor(store, secret, { pool, random, now });
      expect(next?.a.id).not.toBe(pair.a.id);
      expect(next?.b.id).not.toBe(pair.a.id);
    }
  });
});

describe('the board', () => {
  it('crowns nothing on a few votes, and holds a clear end once the votes agree', async () => {
    const store = memoryStore();
    expect((await board(store, { pool })).worst.verdict).toBe('open');
    // Cover n beats cover m whenever n > m: a clear order, ol:1 at the bottom.
    const random = rng(5);
    for (let i = 0; i < 900; i++) {
      const pair = await nextPairFor(store, secret, { pool, random, now });
      if (!pair) break;
      const winner = Number(pair.a.id.slice(3)) > Number(pair.b.id.slice(3)) ? pair.a.id : pair.b.id;
      await castVote(store, secret, { a: pair.a.id, b: pair.b.id, winner, token: pair.token }, { pool, now });
    }
    const result = await board(store, { pool });
    expect(result.bottom[0].id).toBe('ol:1');
    expect(result.bottom[0].title).toBe('Book 1');
    expect(result.worst).toEqual({ verdict: 'exact', held: CROWN_HOLD });
    expect(result.top[0].id).toBe('ol:6');
    expect(result.store).toBe('memory');
  });
});

describe('the frozen pool', () => {
  // 1000 covers since 2026-09-11, up to five per book; it grew from the 200-book pool and inherits its votes.
  it('holds a thousand distinct covers, at most five per book, and none of the excluded ones', () => {
    expect(POOL.name).toBe('mix-1000-paperwhite');
    expect(POOL.inherits).toEqual(['mix-200-paperwhite']);
    expect(POOL.covers).toHaveLength(1000);
    expect(new Set(POOL.covers.map(c => c.id)).size).toBe(1000);
    const perBook = new Map<string, number>();
    for (const c of POOL.covers) perBook.set(c.workId, (perBook.get(c.workId) ?? 0) + 1);
    expect(Math.max(...perBook.values())).toBeLessThanOrEqual(5);
    const excluded = new Set(POOL.excluded.map(e => e.id));
    expect(excluded.has('ol:10942061')).toBe(true);
    expect(POOL.covers.some(c => excluded.has(c.id))).toBe(false);
  });
});
