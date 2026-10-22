/**
 * The live records in an instance's memory (ROADMAP 2.18c): the home page and
 * the collections ask the store once a minute, not once a request; a write
 * forgets the copy; a silent store trips a pause and the file, or what was
 * last read, stands.
 */
import { describe, expect, it } from 'vitest';
import type { CollectionRecord } from '../collections';
import { forgettingPublishStore, LIVE_TTL_MS, liveRecordsFrom, readLiveState, type LiveMemory, type PublishStore } from '../collections-live';
import { Pause, PAUSE_MS } from '../storepause';

const record = (slug: string, published: boolean): CollectionRecord => ({ slug, title: slug, kind: 'authors', intro: '', published, works: [] });
const FILE: CollectionRecord[] = [record('a', true), record('b', false)];

function fakeStore(options: { switches?: Record<string, boolean>; silent?: boolean; hang?: boolean } = {}) {
  const calls = { states: 0, writes: 0 };
  const state = { switches: options.switches ?? {}, content: {} as Record<string, CollectionRecord>, order: [] as string[] };
  let silent = options.silent ?? false;
  const hang = options.hang ?? false;
  async function read<T>(value: T): Promise<T> {
    if (hang) return new Promise<T>(() => {});
    if (silent) throw new Error('ECONNREFUSED');
    return value;
  }
  const store: PublishStore = {
    get: () => read(state.switches),
    getContent: () => {
      calls.states += 1;
      return read(state.content);
    },
    getOrder: () => read(state.order),
    async set(o) {
      calls.writes += 1;
      state.switches = o;
    },
    async setContent(c) {
      calls.writes += 1;
      state.content = c;
    },
    async setOrder(o) {
      calls.writes += 1;
      state.order = o;
    },
  };
  return { store, calls, setSilent: (v: boolean) => { silent = v; } };
}

const published = (records: CollectionRecord[]) => records.map(r => [r.slug, r.published]);

describe('the live records in memory (2.18c)', () => {
  it('asks the store once a minute, not once a request', async () => {
    const { store, calls } = fakeStore({ switches: { b: true } });
    const memory: LiveMemory = {};
    const pause = new Pause();
    const t0 = 1_000_000;
    expect(published(await liveRecordsFrom(store, { memory, pause, now: t0, file: FILE }))).toEqual([['a', true], ['b', true]]);
    for (let i = 1; i < 20; i++) await liveRecordsFrom(store, { memory, pause, now: t0 + i * 3000, file: FILE });
    expect(calls.states).toBe(1);
    await liveRecordsFrom(store, { memory, pause, now: t0 + LIVE_TTL_MS, file: FILE });
    expect(calls.states).toBe(2);
  });

  it('forgets its copy when something is written through the store', async () => {
    const { store, calls } = fakeStore();
    const memory: LiveMemory = {};
    const pause = new Pause();
    const writing = forgettingPublishStore(store, memory);
    expect(published(await liveRecordsFrom(store, { memory, pause, now: 0, file: FILE }))).toEqual([['a', true], ['b', false]]);
    await writing.set({ b: true });
    expect(memory.held).toBeUndefined();
    expect(published(await liveRecordsFrom(store, { memory, pause, now: 1000, file: FILE }))).toEqual([['a', true], ['b', true]]);
    expect(calls.states).toBe(2);
    expect(calls.writes).toBe(1);
  });

  it('a silent store: the file, thirty seconds without asking, then one question again', async () => {
    const { store, calls } = fakeStore({ switches: { b: true }, silent: true });
    const memory: LiveMemory = {};
    const pause = new Pause();
    expect(published(await liveRecordsFrom(store, { memory, pause, now: 0, file: FILE, timeoutMs: 50 }))).toEqual([['a', true], ['b', false]]);
    expect(pause.active(1)).toBe(true);
    for (let t = 1000; t < PAUSE_MS; t += 5000) await liveRecordsFrom(store, { memory, pause, now: t, file: FILE, timeoutMs: 50 });
    expect(calls.states).toBe(1);
    await liveRecordsFrom(store, { memory, pause, now: PAUSE_MS, file: FILE, timeoutMs: 50 });
    expect(calls.states).toBe(2);
    expect(pause.trips).toBe(2);
  });

  it('keeps what it last read while the store is silent, instead of falling back to the file', async () => {
    const f = fakeStore({ switches: { b: true } });
    const memory: LiveMemory = {};
    const pause = new Pause();
    await liveRecordsFrom(f.store, { memory, pause, now: 0, file: FILE });
    f.setSilent(true);
    const later = await liveRecordsFrom(f.store, { memory, pause, now: LIVE_TTL_MS + 1, file: FILE, timeoutMs: 50 });
    expect(published(later)).toEqual([['a', true], ['b', true]]);
    expect(pause.active(LIVE_TTL_MS + 2)).toBe(true);
  });

  it('a fresh read asks the store whatever the memory holds and whatever the pause says', async () => {
    const { store, calls } = fakeStore({ switches: { b: true } });
    const memory: LiveMemory = {};
    const pause = new Pause();
    await liveRecordsFrom(store, { memory, pause, now: 0, file: FILE });
    pause.trip(0);
    await liveRecordsFrom(store, { memory, pause, now: 1, file: FILE, fresh: true });
    expect(calls.states).toBe(2);
    // A fresh read that finds the store silent does not trip the pause for the pages: it was a tool asking.
    const silent = fakeStore({ silent: true });
    const quiet = new Pause();
    expect(published(await liveRecordsFrom(silent.store, { memory: {}, pause: quiet, now: 0, file: FILE, fresh: true, timeoutMs: 50 }))).toEqual([['a', true], ['b', false]]);
    expect(quiet.active(1)).toBe(false);
  });

  it('a store that never answers is a silence within the timeout, not a hang', async () => {
    const { store } = fakeStore({ hang: true });
    expect(await readLiveState(store, 20)).toBeNull();
  });

  it('without a store the file is the site', async () => {
    expect(await liveRecordsFrom(null, { memory: {}, pause: new Pause(), now: 0, file: FILE })).toEqual(FILE);
  });
});
