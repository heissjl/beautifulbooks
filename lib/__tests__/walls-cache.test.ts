/**
 * What an instance remembers of readers' walls (ROADMAP 2.18c): a wall for
 * half a minute, the shown list for a minute, views in a buffer written as one
 * bundle; a write forgets the copy; a silent store trips the pause.
 */
import { describe, expect, it } from 'vitest';
import { HINCRBY_MANY_SCRIPT, type RedisCommands } from '../redis';
import { Pause } from '../storepause';
import { FLUSH_EVERY_MS, LIST_TTL_MS, WALL_TTL_MS, WallMemory, WALLS_REMEMBERED } from '../walls/cache';
import { newVisitorId, newWall } from '../walls/owner';
import { cachedWall, commandsWallStore, flushViews, forgettingWallStore, memoryWallStore, shownWallsCached, type WallStore } from '../walls/store';

const ME = newVisitorId(Buffer.alloc(16, 1));
const T = '2026-10-17T00:00:00Z';

function counting(store: WallStore): { store: WallStore; reads: () => number; lists: () => number } {
  let reads = 0;
  let lists = 0;
  return {
    store: {
      ...store,
      get: (id) => {
        reads += 1;
        return store.get(id);
      },
      submittedIds: () => {
        lists += 1;
        return store.submittedIds();
      },
    },
    reads: () => reads,
    lists: () => lists,
  };
}

describe('what an instance remembers of the walls (2.18c)', () => {
  it('reads a wall once per half minute for viewers, and remembers "no such wall" too', async () => {
    const base = memoryWallStore();
    await base.put(newWall('aaaaaaaaaa', ME, 'A', T));
    const c = counting(base);
    const memory = new WallMemory();
    expect((await cachedWall(c.store, 'aaaaaaaaaa', { memory, now: 0 }))?.title).toBe('A');
    expect((await cachedWall(c.store, 'aaaaaaaaaa', { memory, now: 1000 }))?.title).toBe('A');
    expect(await cachedWall(c.store, 'zzzzzzzzzz', { memory, now: 1000 })).toBeNull();
    expect(await cachedWall(c.store, 'zzzzzzzzzz', { memory, now: 2000 })).toBeNull();
    expect(c.reads()).toBe(2);
    expect(memory.hits).toBe(2);
    await cachedWall(c.store, 'aaaaaaaaaa', { memory, now: WALL_TTL_MS });
    expect(c.reads()).toBe(3);
  });

  it('forgets a wall the instance wrote, so its reader sees the change at once', async () => {
    const memory = new WallMemory();
    const store = forgettingWallStore(memoryWallStore(), memory);
    const w = newWall('bbbbbbbbbb', ME, 'Before', T);
    await store.put(w);
    expect((await cachedWall(store, 'bbbbbbbbbb', { memory, now: 0 }))?.title).toBe('Before');
    await store.put({ ...w, title: 'After' });
    expect((await cachedWall(store, 'bbbbbbbbbb', { memory, now: 1 }))?.title).toBe('After');
  });

  it('remembers at most WALLS_REMEMBERED walls, the oldest going first', () => {
    const memory = new WallMemory();
    for (let i = 0; i <= WALLS_REMEMBERED; i++) memory.keepWall(`w${i}`, null, i);
    expect(memory.wall('w0', WALLS_REMEMBERED)).toBeUndefined();
    expect(memory.wall(`w${WALLS_REMEMBERED}`, WALLS_REMEMBERED)).toBeNull();
  });

  it('reads the shown list once a minute and forgets it when a wall is shown or changed', async () => {
    const memory = new WallMemory();
    const pause = new Pause();
    const c = counting(memoryWallStore());
    const store = forgettingWallStore(c.store, memory);
    const a = { ...newWall('aaaaaaaaaa', ME, 'A', T), showcase: 'shown' as const };
    await store.put(a);
    await store.submitted(a.id);
    expect((await shownWallsCached(store, { memory, pause, now: 0 })).map((s) => s.wall.id)).toEqual(['aaaaaaaaaa']);
    await shownWallsCached(store, { memory, pause, now: 1000 });
    await shownWallsCached(store, { memory, pause, now: LIST_TTL_MS - 1 });
    expect(c.lists()).toBe(1);
    const b = { ...newWall('bbbbbbbbbb', ME, 'B', T), showcase: 'shown' as const };
    await store.put(b);
    await store.submitted(b.id);
    expect((await shownWallsCached(store, { memory, pause, now: 2000 })).map((s) => s.wall.id).sort()).toEqual(['aaaaaaaaaa', 'bbbbbbbbbb']);
    expect(c.lists()).toBe(2);
  });

  it('a silent store trips the pause: the last list stands, and nothing asks for thirty seconds', async () => {
    const base = memoryWallStore();
    const memory = new WallMemory();
    const pause = new Pause();
    const a = { ...newWall('aaaaaaaaaa', ME, 'A', T), showcase: 'shown' as const };
    await base.put(a);
    await base.submitted(a.id);
    await shownWallsCached(base, { memory, pause, now: 0 });
    let asked = 0;
    const broken: WallStore = {
      ...base,
      submittedIds: async () => {
        asked += 1;
        throw new Error('max clients');
      },
    };
    expect((await shownWallsCached(broken, { memory, pause, now: LIST_TTL_MS })).map((s) => s.wall.id)).toEqual(['aaaaaaaaaa']);
    expect(pause.active(LIST_TTL_MS + 1)).toBe(true);
    await shownWallsCached(broken, { memory, pause, now: LIST_TTL_MS + 5000 });
    expect(asked).toBe(1);
    // With nothing remembered, the failure is the caller's to show (N12).
    await expect(shownWallsCached(broken, { memory: new WallMemory(), pause: new Pause(), now: 0 })).rejects.toThrow('max clients');
  });

  it('buffers views and writes them as one bundle at most every ten seconds', async () => {
    const base = memoryWallStore();
    const memory = new WallMemory();
    memory.addView('aaaaaaaaaa');
    memory.addView('aaaaaaaaaa');
    memory.addView('bbbbbbbbbb');
    expect(memory.pendingViews).toBe(3);
    const t0 = 100_000;
    expect(await flushViews(base, { memory, now: t0 })).toBe(2);
    expect(memory.pendingViews).toBe(0);
    memory.addView('aaaaaaaaaa');
    expect(await flushViews(base, { memory, now: t0 + 5000 })).toBe(0);
    expect(await flushViews(base, { memory, now: t0 + FLUSH_EVERY_MS })).toBe(1);
    expect((await base.views()).get('aaaaaaaaaa')).toBe(3);
    expect((await base.views()).get('bbbbbbbbbb')).toBe(1);
  });

  it('puts the views back when the write fails, so they go with the instance, not with the error', async () => {
    const memory = new WallMemory();
    memory.addView('aaaaaaaaaa');
    const broken: WallStore = { ...memoryWallStore(), viewMany: async () => { throw new Error('ECONNRESET'); } };
    expect(await flushViews(broken, { memory, now: 100_000, force: true })).toBe(0);
    expect(memory.pendingViews).toBe(1);
  });

  it('writes the bundle as one EVAL without an expiry where the store has the script, one HINCRBY per wall otherwise', async () => {
    const calls: unknown[][] = [];
    const base: RedisCommands = {
      rPush: async () => 1,
      lRange: async () => [],
      lLen: async () => 0,
      get: async () => null,
      set: async () => 'OK',
      hGetAll: async () => ({}),
      hSetNX: async () => 1,
      setNx: async () => 'OK',
    };
    const withScript = commandsWallStore({ ...base, hIncrByMany: async (...args) => { calls.push(args); return 2; } });
    await withScript.viewMany([['a', 2], ['b', 1]]);
    expect(calls).toEqual([['walls:views', [['a', 2], ['b', 1]], 0]]);
    const single: string[] = [];
    const without = commandsWallStore({ ...base, hIncrBy: async (k, f, by) => { single.push(`${k} ${f} ${by}`); return by; } });
    await without.viewMany([['a', 2], ['b', 1]]);
    expect(single).toEqual(['walls:views a 2', 'walls:views b 1']);
    // The script sets no expiry for 0 — the views are kept, unlike a day's totals.
    expect(HINCRBY_MANY_SCRIPT).toContain("if tonumber(ARGV[1]) > 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end");
  });
});
