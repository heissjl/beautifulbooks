/**
 * The analytics' write buffer (ROADMAP 2.18d): sums per instance, one command
 * per day-hash, the same totals as counting per event; the switch INSIGHTS=off.
 */
import { describe, expect, it } from 'vitest';
import type { RedisCommands } from '../redis';
import { FIELDS_BUFFERED, FLUSH_EVERY_MS, InsightsBuffer } from '../insights/buffer';
import { EMPTY_RETENTION_SECONDS, insightsKey, RETENTION_SECONDS } from '../insights/model';
import type { BookSignal, SearchSignal } from '../insights/signals';
import { countClick, countingEnabled, countSignal, flushInsights, insightsOff, queueClick, queueSignal } from '../insights/store';

/** A Redis of hashes that counts how it was asked: one `EVAL` per hash, or one `HINCRBY` per field. */
function fakeRedis(options: { fail?: boolean; script?: boolean } = {}) {
  const hashes = new Map<string, Map<string, number>>();
  const expires = new Map<string, number>();
  const evals: string[] = [];
  const singles: string[] = [];
  const apply = (key: string, field: string, by: number) => {
    const h = hashes.get(key) ?? new Map<string, number>();
    h.set(field, (h.get(field) ?? 0) + by);
    hashes.set(key, h);
    return h.get(field) ?? 0;
  };
  const commands = {
    async hIncrBy(key: string, field: string, by: number) {
      if (options.fail) throw new Error('down');
      singles.push(key);
      return apply(key, field, by);
    },
    async expire(key: string, seconds: number) {
      expires.set(key, seconds);
      return 1;
    },
    async hGetAll(key: string) {
      return new Map([...(hashes.get(key) ?? new Map<string, number>()).entries()].map(([k, v]) => [k, String(v)]));
    },
    ...(options.script === false
      ? {}
      : {
          async hIncrByMany(key: string, increments: ReadonlyArray<readonly [string, number]>, ttl: number) {
            if (options.fail) throw new Error('down');
            evals.push(key);
            for (const [field, by] of increments) apply(key, field, by);
            expires.set(key, ttl);
            return increments.length;
          },
        }),
  } as unknown as RedisCommands;
  const plain = () => Object.fromEntries([...hashes.entries()].map(([k, h]) => [k, Object.fromEntries(h)]));
  return { commands, hashes, expires, evals, singles, plain };
}

const PROD = { VERCEL_ENV: 'production' };
const OFF = { VERCEL_ENV: 'production', INSIGHTS: 'off' };
const NOW = new Date('2026-10-17T12:00:00Z');
const DAY = '2026-10-17';
const click = { provider: 'bookshop', market: 'us' as const, kind: 'product' as const };
const book: BookSignal = {
  t: 'book',
  work: 'OL468431W',
  from: 'home',
  market: 'us',
  pages: '1',
  seen: '13-40',
  picked: true,
  verdict: 'verified',
  bought: true,
  found: false,
  entry: 'direct',
};
const emptySearch: SearchSignal = { t: 'search', outcome: 'empty', count: '0', clicked: 'none', mode: 'title', q: 'gatsbee' };

describe('the analytics buffer (2.18d)', () => {
  it('adds up and writes one command per day-hash, with the same sums as counting per event', async () => {
    const buffered = fakeRedis();
    const buffer = new InsightsBuffer();
    for (let i = 0; i < 3; i++) expect(queueClick(click, { env: PROD, buffer, now: NOW })).toBe('queued');
    for (let i = 0; i < 2; i++) expect(queueSignal(book, { env: PROD, buffer, now: NOW })).toBe('queued');
    expect(queueSignal(emptySearch, { env: PROD, buffer, now: NOW })).toBe('queued');
    expect(buffer.pending).toBe(5);
    expect(await flushInsights({ env: PROD, commands: buffered.commands, buffer, now: NOW, force: true })).toBe('written');
    expect(buffered.evals.sort()).toEqual(['book', 'clicks', 'empty', 'search', 'works'].map(h => insightsKey(DAY, h as 'book')).sort());
    expect(buffered.singles).toEqual([]);
    expect(buffered.expires.get(insightsKey(DAY, 'clicks'))).toBe(RETENTION_SECONDS);
    expect(buffered.expires.get(insightsKey(DAY, 'empty'))).toBe(EMPTY_RETENTION_SECONDS);
    expect(buffer.pending).toBe(0);

    const direct = fakeRedis();
    const opts = { env: PROD, commands: direct.commands, now: NOW };
    for (let i = 0; i < 3; i++) await countClick(click, opts);
    for (let i = 0; i < 2; i++) await countSignal(book, opts);
    await countSignal(emptySearch, opts);
    expect(buffered.plain()).toEqual(direct.plain());
    expect(buffered.plain()[insightsKey(DAY, 'clicks')]).toEqual({ 'bookshop|us|product': 3 });
  });

  it('writes at most every ten seconds: a flush in between does nothing', async () => {
    const redis = fakeRedis();
    const buffer = new InsightsBuffer();
    queueClick(click, { env: PROD, buffer, now: NOW });
    expect(await flushInsights({ env: PROD, commands: redis.commands, buffer, now: NOW })).toBe('written');
    queueClick(click, { env: PROD, buffer, now: NOW });
    expect(await flushInsights({ env: PROD, commands: redis.commands, buffer, now: new Date(NOW.getTime() + 5000) })).toBe('not-due');
    expect(redis.evals.length).toBe(1);
    expect(await flushInsights({ env: PROD, commands: redis.commands, buffer, now: new Date(NOW.getTime() + FLUSH_EVERY_MS) })).toBe('written');
    expect(redis.plain()[insightsKey(DAY, 'clicks')]).toEqual({ 'bookshop|us|product': 2 });
    expect(await flushInsights({ env: PROD, commands: redis.commands, buffer, now: new Date(NOW.getTime() + 2 * FLUSH_EVERY_MS) })).toBe('not-due');
  });

  it('puts the sums back when the store fails, and counts nothing twice', async () => {
    const buffer = new InsightsBuffer();
    queueClick(click, { env: PROD, buffer, now: NOW });
    const down = fakeRedis({ fail: true });
    expect(await flushInsights({ env: PROD, commands: down.commands, buffer, now: NOW, force: true })).toBe('failed');
    expect(buffer.pending).toBe(1);
    const up = fakeRedis();
    expect(await flushInsights({ env: PROD, commands: up.commands, buffer, now: NOW, force: true })).toBe('written');
    expect(up.plain()[insightsKey(DAY, 'clicks')]).toEqual({ 'bookshop|us|product': 1 });
    expect(buffer.pending).toBe(0);
  });

  it('INSIGHTS=off stops every count, in production too, and the view can tell', async () => {
    expect(insightsOff(OFF)).toBe(true);
    expect(insightsOff(PROD)).toBe(false);
    expect(countingEnabled(OFF)).toBe(false);
    expect(countingEnabled(PROD)).toBe(true);
    const buffer = new InsightsBuffer();
    expect(queueClick(click, { env: OFF, buffer, now: NOW })).toBe('off');
    expect(queueSignal(book, { env: OFF, buffer, now: NOW })).toBe('off');
    expect(buffer.pending).toBe(0);
    const redis = fakeRedis();
    expect(await countClick(click, { env: OFF, commands: redis.commands, now: NOW })).toBe('off');
    buffer.add(insightsKey(DAY, 'clicks'), 'bookshop|us|product', 1, RETENTION_SECONDS);
    expect(await flushInsights({ env: OFF, commands: redis.commands, buffer, now: NOW, force: true })).toBe('off');
    expect(redis.evals).toEqual([]);
  });

  it('refuses a click of no known shape before it reaches the buffer', () => {
    const buffer = new InsightsBuffer();
    expect(queueClick({ provider: '../x', market: 'us', kind: 'product' }, { env: PROD, buffer, now: NOW })).toBe('invalid');
    expect(buffer.pending).toBe(0);
  });

  it('drops the oldest hash whole when the buffer is full, so a dead store cannot grow it', () => {
    const buffer = new InsightsBuffer();
    for (let i = 0; i <= FIELDS_BUFFERED; i++) buffer.add(insightsKey(DAY, i < 10 ? 'ops' : 'works'), `f${i}`, 1, RETENTION_SECONDS);
    expect(buffer.pending).toBeLessThanOrEqual(FIELDS_BUFFERED);
    const taken = buffer.take(NOW.getTime());
    expect(taken.map(p => p.key)).toEqual([insightsKey(DAY, 'works')]);
  });

  it('falls back to one HINCRBY per field and one EXPIRE per hash where the store has no script', async () => {
    const redis = fakeRedis({ script: false });
    const buffer = new InsightsBuffer();
    queueClick(click, { env: PROD, buffer, now: NOW });
    queueSignal(book, { env: PROD, buffer, now: NOW });
    expect(await flushInsights({ env: PROD, commands: redis.commands, buffer, now: NOW, force: true })).toBe('written');
    expect(redis.singles.length).toBe(3);
    expect([...redis.expires.keys()].sort()).toEqual(['book', 'clicks', 'works'].map(h => insightsKey(DAY, h as 'book')).sort());
  });
});
