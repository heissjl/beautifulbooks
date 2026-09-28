import { describe, expect, it } from 'vitest';
import type { RedisCommands } from '../hotornot/store';
import { hashVisitor, newVisitorId, newWall } from '../walls/owner';
import { moderate } from '../walls/model';
import { commandsWallStore, memoryWallStore, moderationList, shownWalls, wallsOf, WallStoreUnavailableError, type WallStore } from '../walls/store';

function fakeCommands(): RedisCommands {
  const kv = new Map<string, string>();
  const lists = new Map<string, string[]>();
  const hashes = new Map<string, Map<string, string>>();
  return {
    rPush: async (k, v) => lists.set(k, [...(lists.get(k) ?? []), v]).get(k)?.length,
    lRange: async (k, a, b) => (lists.get(k) ?? []).slice(a, b === -1 ? undefined : b + 1),
    lLen: async (k) => (lists.get(k) ?? []).length,
    get: async (k) => kv.get(k) ?? null,
    set: async (k, v) => kv.set(k, v) && 'OK',
    hGetAll: async (k) => Object.fromEntries(hashes.get(k) ?? []),
    hIncrBy: async (k, f, by) => {
      const h = hashes.get(k) ?? new Map<string, string>();
      h.set(f, String(Number(h.get(f) ?? 0) + by));
      hashes.set(k, h);
      return Number(h.get(f));
    },
    hSetNX: async () => 1,
    setNx: async () => 'OK',
  };
}

const ME = newVisitorId(Buffer.alloc(16, 1));
const YOU = newVisitorId(Buffer.alloc(16, 2));

for (const [name, make] of [['memory', memoryWallStore], ['redis', () => commandsWallStore(fakeCommands())]] as const) {
  describe(`${name} wall store`, () => {
    it('keeps walls, lists an owner’s own, newest change first, and counts all', async () => {
      const store: WallStore = make();
      const a = newWall('aaaaaaaaaa', ME, 'Hall', '2026-09-01T00:00:00Z');
      const b = newWall('bbbbbbbbbb', ME, 'Study', '2026-09-02T00:00:00Z');
      const c = newWall('cccccccccc', YOU, 'Theirs', '2026-09-03T00:00:00Z');
      for (const w of [a, b, c]) {
        await store.put(w);
        await store.register(w);
      }
      await store.put({ ...a, updatedAt: '2026-09-05T00:00:00Z' });
      expect((await wallsOf(store, hashVisitor(ME))).map((w) => w.title)).toEqual(['Hall', 'Study']);
      expect(await store.count()).toBe(3);
      expect(await store.get('zzzzzzzzzz')).toBeNull();
    });

    it('lists shown walls with views, and reported ones first for Julian', async () => {
      const store: WallStore = make();
      const a = { ...newWall('aaaaaaaaaa', ME, 'A', '2026-09-01T00:00:00Z'), showcase: 'shown' as const };
      const b = moderate({ ...newWall('bbbbbbbbbb', ME, 'B', '2026-09-01T00:00:00Z'), showcase: 'shown' as const }, 'hidden', 'x');
      const c = newWall('cccccccccc', YOU, 'C private', '2026-09-01T00:00:00Z');
      for (const w of [a, b, c]) {
        await store.put(w);
        await store.submitted(w.id);
      }
      await store.submitted('aaaaaaaaaa');
      await store.view('aaaaaaaaaa');
      await store.view('aaaaaaaaaa');
      await store.report('bbbbbbbbbb');
      await store.interest('cccccccccc');
      await store.interest('cccccccccc');
      expect(await store.interests()).toEqual(new Map([['cccccccccc', 2]]));
      expect((await shownWalls(store)).map((s) => [s.wall.id, s.views])).toEqual([['aaaaaaaaaa', 2]]);
      expect((await moderationList(store)).map((s) => [s.wall.id, s.reports])).toEqual([['bbbbbbbbbb', 1], ['aaaaaaaaaa', 0]]);
    });
  });
}

it('says the store is down instead of "no wall"', async () => {
  const broken = { ...fakeCommands(), get: async () => { throw new Error('ECONNRESET'); } };
  await expect(commandsWallStore(broken).get('aaaaaaaaaa')).rejects.toBeInstanceOf(WallStoreUnavailableError);
});
