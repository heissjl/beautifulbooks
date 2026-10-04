/** The analytics' server counters and report (ROADMAP 3.1a, docs/plans/PLAN-3.1-analyse.md). */
import { describe, expect, it } from 'vitest';
import type { RedisCommands } from '../hotornot/store';
import { change, clickField, dayOf, insightsKey, lastDays, parseClickField, RETENTION_SECONDS, summarizeClicks, summarizeOps } from '../insights/model';
import { buildReport, parseMarket, parseRange } from '../insights/report';
import { countClick, countOp, readDays } from '../insights/store';
import { adminSessionToken, adminSessionValid, adminTokenValid } from '../suggest/auth';
import { noteGoogleFailure, resetGoogleQuota, takeDailyStops } from '../googlequota';
import { HttpError } from '../sources/http';

/** A Redis of hashes, with the calls it received. */
function fakeRedis(options: { fail?: boolean } = {}) {
  const hashes = new Map<string, Map<string, number>>();
  const expires = new Map<string, number>();
  const commands = {
    async hIncrBy(key: string, field: string, by: number) {
      if (options.fail) throw new Error('down');
      const h = hashes.get(key) ?? new Map<string, number>();
      h.set(field, (h.get(field) ?? 0) + by);
      hashes.set(key, h);
      return h.get(field);
    },
    async expire(key: string, seconds: number) {
      expires.set(key, seconds);
      return 1;
    },
    // RESP3 delivers hashes as a Map; the reader must cope.
    async hGetAll(key: string) {
      if (options.fail) throw new Error('down');
      return new Map([...(hashes.get(key) ?? new Map()).entries()].map(([k, v]) => [k, String(v)]));
    },
  } as unknown as RedisCommands;
  return { commands, hashes, expires };
}

const PROD = { VERCEL_ENV: 'production' };
const NOW = new Date('2026-10-04T12:00:00Z');

describe('keys and fields', () => {
  it('names a day by its UTC date', () => {
    expect(dayOf(new Date('2026-10-04T23:59:59Z'))).toBe('2026-10-04');
    expect(dayOf(new Date('2026-10-05T00:00:00Z'))).toBe('2026-10-05');
    expect(insightsKey('2026-10-04', 'clicks')).toBe('ins:2026-10-04:clicks');
  });

  it('keeps nothing but shop, market and kind — no ISBN, nothing else', () => {
    expect(clickField({ provider: 'bookshop', market: 'us', kind: 'product' })).toBe('bookshop|us|product');
    expect(clickField({ provider: 'abebooks-de-search', market: 'de', kind: 'search' })).toBe('abebooks-de-search|de|search');
    expect(clickField({ provider: 'Book|shop', market: 'us', kind: 'product' })).toBeNull();
    expect(clickField({ provider: 'bookshop', market: 'fr' as 'us', kind: 'product' })).toBeNull();
    expect(clickField({ provider: 'bookshop', market: 'us', kind: 'title' as 'product' })).toBeNull();
    expect(parseClickField('bookshop|us|product')).toEqual({ provider: 'bookshop', market: 'us', kind: 'product' });
    expect(parseClickField('bookshop|us|product|9780141036144')).toBeNull();
    expect(parseClickField('garbage')).toBeNull();
  });

  it('lists the days of a range, oldest first, capped at 90', () => {
    expect(lastDays(NOW, 3)).toEqual(['2026-10-02', '2026-10-03', '2026-10-04']);
    expect(lastDays(NOW, 500)).toHaveLength(90);
  });
});

describe('counting', () => {
  it('adds one per click to the day of the click and lets the day expire', async () => {
    const redis = fakeRedis();
    const click = { provider: 'amazon', market: 'de' as const, kind: 'product' as const };
    expect(await countClick(click, { env: PROD, commands: redis.commands, now: NOW })).toBe('counted');
    expect(await countClick(click, { env: PROD, commands: redis.commands, now: NOW })).toBe('counted');
    expect(redis.hashes.get('ins:2026-10-04:clicks')?.get('amazon|de|product')).toBe(2);
    expect(redis.expires.get('ins:2026-10-04:clicks')).toBe(RETENTION_SECONDS);
  });

  it('counts only in production — a preview shares the store and is not a reader', async () => {
    const redis = fakeRedis();
    const click = { provider: 'amazon', market: 'de' as const, kind: 'product' as const };
    expect(await countClick(click, { env: { VERCEL_ENV: 'preview' }, commands: redis.commands, now: NOW })).toBe('off');
    expect(await countClick(click, { env: {}, commands: redis.commands, now: NOW })).toBe('off');
    expect(redis.hashes.size).toBe(0);
  });

  it('never throws: a silent store costs a number, not a redirect', async () => {
    const down = fakeRedis({ fail: true });
    expect(await countClick({ provider: 'amazon', market: 'us', kind: 'search' }, { env: PROD, commands: down.commands, now: NOW })).toBe('failed');
    expect(await countOp('ol-failed', { env: PROD, commands: null, now: NOW })).toBe('no-store');
    expect(await countClick({ provider: '../x', market: 'us', kind: 'search' }, { env: PROD, commands: down.commands })).toBe('invalid');
  });

  it('reports a silent store as failed, never as a range without clicks', async () => {
    expect(await readDays(['2026-10-04'], 'clicks', fakeRedis({ fail: true }).commands)).toEqual({ ok: false, reason: 'failed' });
    expect(await readDays(['2026-10-04'], 'clicks', null)).toEqual({ ok: false, reason: 'no-store' });
    expect((await buildReport(7, undefined, null, NOW)).ok).toBe(false);
  });
});

describe('summing up', () => {
  const days = ['2026-10-03', '2026-10-04'];
  const hashes = [
    { 'bookshop|us|product': '3', 'amazon|de|search': '1', 'stray-field': '9' },
    { 'bookshop|us|product': 2, 'amazon|de|product': '4', 'thalia|de|product': 'x' },
  ];

  it('adds per shop and market, largest first, and keeps empty days as zero', () => {
    const s = summarizeClicks([...days, '2026-10-05'], [...hashes, null]);
    expect(s.total).toBe(10);
    expect(s.perDay).toEqual([
      { day: '2026-10-03', clicks: 4 },
      { day: '2026-10-04', clicks: 6 },
      { day: '2026-10-05', clicks: 0 },
    ]);
    expect(s.byMarket).toEqual({ us: 5, uk: 0, de: 5 });
    expect(s.rows).toEqual([
      { provider: 'amazon', market: 'de', clicks: 5, product: 4 },
      { provider: 'bookshop', market: 'us', clicks: 5, product: 5 },
    ]);
  });

  it('narrows to one market', () => {
    expect(summarizeClicks(days, hashes, 'us').total).toBe(5);
  });

  it('names the days the operation stumbled', () => {
    const ops = summarizeOps(days, [{ 'ol-failed': '2' }, { 'google-stop': 1 }]);
    expect(ops.totals).toEqual({ 'google-stop': 1, 'ol-failed': 2 });
    expect(ops.daysWith).toEqual({ 'google-stop': ['2026-10-04'], 'ol-failed': ['2026-10-03'] });
  });

  it('calls a rise from nothing new, not infinite', () => {
    expect(change(10, 0)).toBeNull();
    expect(change(15, 10)).toBeCloseTo(0.5);
  });

  it('builds the report from the store, with the range before for comparison', async () => {
    const redis = fakeRedis();
    const opts = { env: PROD, commands: redis.commands };
    await countClick({ provider: 'bookshop', market: 'us', kind: 'product' }, { ...opts, now: NOW });
    await countClick({ provider: 'bookshop', market: 'us', kind: 'product' }, { ...opts, now: NOW });
    await countClick({ provider: 'bookshop', market: 'us', kind: 'product' }, { ...opts, now: new Date('2026-09-30T08:00:00Z') });
    const report = await buildReport(7, undefined, redis.commands, NOW);
    if (!report.ok) throw new Error('expected a report');
    expect(report.clicks.total).toBe(3);
    expect(report.previousTotal).toBe(0);
    expect(report.change).toBeNull();
    expect(report.few).toBe(true);
    expect(report.labels.bookshop).toBe('Bookshop.org');
    const lastDay = await buildReport(7, undefined, redis.commands, new Date('2026-10-11T12:00:00Z'));
    if (!lastDay.ok) throw new Error('expected a report');
    expect(lastDay.clicks.total).toBe(0);
    expect(lastDay.previousTotal).toBe(3);
  });

  it('reads only the ranges and markets it offers', () => {
    expect(parseRange('90')).toBe(90);
    expect(parseRange('365')).toBe(30);
    expect(parseRange(null)).toBe(30);
    expect(parseMarket('de')).toBe('de');
    expect(parseMarket('fr')).toBeUndefined();
  });
});

describe('who may read', () => {
  const env = { SUGGEST_ADMIN_PASSWORD: 'julian-only' };
  const now = 1_700_000_000_000;

  it('accepts Julian’s admin cookie without the friends’ tools switched on', () => {
    const token = adminSessionToken(now, env);
    expect(adminTokenValid(token, now + 1000, env)).toBe(true);
    // /curate and the moderation keep their own condition.
    expect(adminSessionValid(token, now + 1000, env)).toBe(false);
    expect(adminSessionValid(token, now + 1000, { ...env, SUGGEST_PASSWORD: 'x' })).toBe(true);
  });

  it('accepts nothing without an admin password, an expired cookie or a forged one', () => {
    const token = adminSessionToken(now, env);
    expect(adminTokenValid(token, now, {})).toBe(false);
    expect(adminTokenValid(token, now + 8 * 24 * 3600 * 1000, env)).toBe(false);
    expect(adminTokenValid(`${now + 1e9}.forged`, now, env)).toBe(false);
    expect(adminTokenValid(undefined, now, env)).toBe(false);
  });
});

describe('Google daily stops', () => {
  it('are handed to the analytics once, and only the daily kind', () => {
    resetGoogleQuota();
    const body = JSON.stringify({ error: { code: 403, errors: [{ reason: 'dailyLimitExceeded' }] } });
    noteGoogleFailure(new HttpError(429, 'https://www.googleapis.com/books', 'rateLimitExceeded'), 0);
    expect(takeDailyStops()).toBe(0);
    noteGoogleFailure(new HttpError(403, 'https://www.googleapis.com/books', body), 1);
    // The breaker is already open: a second refusal the same day is not a second stop.
    noteGoogleFailure(new HttpError(403, 'https://www.googleapis.com/books', body), 2);
    expect(takeDailyStops()).toBe(1);
    expect(takeDailyStops()).toBe(0);
    resetGoogleQuota();
  });
});
