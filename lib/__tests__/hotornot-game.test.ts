import { beforeEach, describe, expect, it } from 'vitest';
import { rng } from '../loading';
import { CROWN_HOLD, ELO_START, applyVote, newElo } from '../hotornot/rating';
import {
  BOARD_SECONDS, POOL, TALLY_SAVE_EVERY, board, cachedBoard, castVote, flagCover, forgetBoards, forgetTallies, imagePath,
  nextPairFor, pairingTally, poolBooks, someBooks, type VersusPool,
  readyPairs,
} from '../hotornot/game';
import { StoreUnavailableError, memoryStore, type VoteStore } from '../hotornot/store';

// Tallies and boards live per instance; every test starts on a fresh one.
beforeEach(() => {
  forgetTallies();
  forgetBoards();
});
import { pairSecret, verifyPair } from '../hotornot/token';

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

/** `n` votes between random covers of the test pool, under `name`. */
async function fill(store: VoteStore, name: string, n: number, seed: number) {
  const random = rng(seed);
  const ids = pool.covers.map(c => c.id);
  for (let i = 0; i < n; i++) {
    const a = ids[Math.floor(random() * ids.length)];
    let b = ids[Math.floor(random() * ids.length)];
    if (b === a) b = ids[(ids.indexOf(a) + 1) % ids.length];
    await store.add(name, { a, b, winner: random() < 0.5 ? a : b, on: '2026-09-14' });
  }
}

/** A store that records where each tail was read from, and how often every vote was read. */
function watched(store: VoteStore) {
  const starts: number[] = [];
  let full = 0;
  const spy: VoteStore = {
    ...store,
    votesFrom: (p, start) => {
      starts.push(start);
      return store.votesFrom(p, start);
    },
    votes: p => {
      full += 1;
      return store.votes(p);
    },
  };
  return { spy, starts, full: () => full };
}

// 2026-09-14: a pair used to read and replay every vote ever cast; 403 records a click on the preview.
describe('the running tally behind the pairing', () => {
  it('rates every cover exactly as counting every vote again would', async () => {
    const store = memoryStore();
    await fill(store, 'test', 60, 3);
    const { elo, votes } = await pairingTally(store, pool);
    const again = newElo(pool.covers.map(c => c.id));
    for (const v of await store.votes('test')) applyVote(again, v);
    expect(votes).toBe(60);
    for (const c of pool.covers) {
      expect(elo.rating.get(c.id) ?? ELO_START).toBeCloseTo(again.rating.get(c.id) ?? ELO_START, 9);
      expect(elo.games.get(c.id) ?? 0).toBe(again.games.get(c.id));
    }
  });

  it('fetches only the votes it has not counted yet, and never all of them', async () => {
    const store = memoryStore();
    await fill(store, 'test', 30, 5);
    const { spy, starts, full } = watched(store);
    await pairingTally(spy, pool);
    await fill(store, 'test', 4, 7);
    await pairingTally(spy, pool);
    await pairingTally(spy, pool); // nothing new: not even a tail
    expect(starts).toEqual([0, 30]);
    expect(full()).toBe(0);
  });

  it('writes the tally beside the votes, and a fresh instance goes on from there', async () => {
    const store = memoryStore();
    await fill(store, 'test', TALLY_SAVE_EVERY + 5, 9);
    await pairingTally(store, pool);
    expect(await store.tally('test')).not.toBeNull();
    forgetTallies(); // a new instance
    await fill(store, 'test', 2, 11);
    const { spy, starts } = watched(store);
    const { votes } = await pairingTally(spy, pool);
    expect(starts).toEqual([TALLY_SAVE_EVERY + 5]);
    expect(votes).toBe(TALLY_SAVE_EVERY + 7);
  });

  it('counts again from the first vote when the saved tally was for another pool, or the votes were emptied', async () => {
    const store = memoryStore();
    await fill(store, 'test', 30, 13);
    await pairingTally(store, pool); // this instance has counted 30

    // The same pool, but a store holding only 3: the log is shorter than what was counted.
    const emptied = memoryStore();
    await fill(emptied, 'test', 3, 17);
    expect((await pairingTally(emptied, pool)).votes).toBe(3);

    forgetTallies();
    const rebuilt: VersusPool = { ...pool, covers: pool.covers.slice(0, 5) }; // same name, other covers
    const { spy, starts } = watched(store);
    await pairingTally(spy, rebuilt);
    expect(starts).toEqual([0]); // the saved tally was counted for the other pool
  });

  it('never counts the same new votes twice when two clicks arrive at once', async () => {
    const store = memoryStore();
    await fill(store, 'test', 20, 19);
    const [one, two] = await Promise.all([pairingTally(store, pool), pairingTally(store, pool)]);
    expect(one.votes).toBe(20);
    expect(two.votes).toBe(20);
    expect([...two.elo.games.values()].reduce((sum, n) => sum + n, 0)).toBe(40);
  });

  it('counts the pool it grew from first, and only votes on covers it still holds', async () => {
    const store = memoryStore();
    const grown: VersusPool = { ...pool, name: 'test-grown', inherits: ['test'] };
    await store.add('test', { a: 'ol:1', b: 'ol:2', winner: 'ol:1', on: '2026-09-11' });
    await store.add('test', { a: 'ol:1', b: 'ol:99', winner: 'ol:99', on: '2026-09-11' });
    await store.add('test-grown', { a: 'ol:3', b: 'ol:4', winner: 'ol:4', on: '2026-09-12' });
    expect((await pairingTally(store, grown)).votes).toBe(2);
  });
});

describe('the board, once a minute', () => {
  it('is counted once for everyone within a minute, and again after it', async () => {
    const store = memoryStore();
    await fill(store, 'test', 10, 23);
    const { spy, full } = watched(store);
    const t = 1_000_000;
    const first = await cachedBoard(spy, { pool, now: t });
    await cachedBoard(spy, { pool, now: t + 30_000 });
    expect(full()).toBe(1);
    await fill(store, 'test', 1, 29);
    const later = await cachedBoard(spy, { pool, now: t + BOARD_SECONDS * 1000 + 1 });
    expect(full()).toBe(2);
    expect(later.votes).toBe(first.votes + 1);
  });

  it('does not keep a store that did not answer for a minute', async () => {
    const down: VoteStore = { ...memoryStore(), votes: async () => { throw new StoreUnavailableError('silent'); } };
    await expect(cachedBoard(down, { pool, now: 1 })).rejects.toBeInstanceOf(StoreUnavailableError);
    await expect(cachedBoard(memoryStore(), { pool, now: 2 })).resolves.toMatchObject({ votes: 0 });
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

describe('the books behind the pool (the page a crawler reads, SPEC F7.6)', () => {
  const many: VersusPool = {
    ...pool,
    covers: [
      { id: 'ol:1', workId: 'OL1W', title: 'Zeno', author: 'Z' },
      { id: 'ol:2', workId: 'OL1W', title: 'Zeno', author: 'Z' },
      { id: 'ol:3', workId: 'OL2W', title: 'Aeneid', author: 'V' },
      { id: 'ol:4', workId: 'OL3W', title: 'Middlemarch', author: 'E' },
    ],
  };

  it('names each book once, in title order, with how many of its covers play', () => {
    expect(poolBooks(many)).toEqual([
      { workId: 'OL2W', title: 'Aeneid', author: 'V', covers: 1 },
      { workId: 'OL3W', title: 'Middlemarch', author: 'E', covers: 1 },
      { workId: 'OL1W', title: 'Zeno', author: 'Z', covers: 2 },
    ]);
  });

  it('spreads a sample over the whole list instead of taking the front of the alphabet', () => {
    const sample = someBooks(2, many);
    expect(sample.map(b => b.title)).toEqual(['Aeneid', 'Zeno']);
    expect(someBooks(9, many)).toHaveLength(3);
    expect(someBooks(0, many)).toEqual([]);
  });

  it('reads the real pool the page ships with', () => {
    const books = poolBooks();
    expect(books.length).toBeGreaterThan(200);
    expect(books.reduce((sum, b) => sum + b.covers, 0)).toBe(POOL.covers.length);
    // Every entry is a link the page writes: /book/<work>.
    expect(books.every(b => /^OL\d+W$/.test(b.workId) && b.title.length > 0)).toBe(true);
  });
});

describe('readyPairs (pairs handed out with the page)', () => {
  const secret = pairSecret('test-token');

  it('draws signed pairs, no cover twice (two covers of one book are allowed, F7.9)', () => {
    const pairs = readyPairs(secret, 3, { random: rng(7), now: 1_700_000_000_000, store: 'memory' });
    expect(pairs).toHaveLength(3);
    const ids = pairs.flatMap(p => [p.a.id, p.b.id]);
    expect(new Set(ids).size).toBe(6);
    for (const p of pairs) {
      expect(p.votes).toBeNull();
      expect(p.token).toMatch(/\S/);
      expect(verifyPair(secret, p.pool, p.a.id, p.b.id, p.token, 1_700_000_000_000)).toBe(true);
    }
  });
});

