/** The browser's signals and what the view makes of them (ROADMAP 3.1b, docs/plans/PLAN-3.1-analyse.md §4). */
import { describe, expect, it } from 'vitest';
import type { RedisCommands } from '../hotornot/store';
import { EMPTY_RETENTION_SECONDS, RETENTION_SECONDS } from '../insights/model';
import { buildReport } from '../insights/report';
import {
  bookField,
  countClass,
  emptyQuery,
  originOf,
  pagesClass,
  parseSignal,
  positionClass,
  seenClass,
  type BookSignal,
} from '../insights/signals';
import { countSignal } from '../insights/store';
import { emptySearches, summarizeBooks, summarizeSearches, topWorks } from '../insights/visits';

const HOST = 'buyitscovers.com';
const book: BookSignal = { t: 'book', work: 'OL1168083W', from: 'search', market: 'de', pages: '2', seen: '13-40', picked: true, verdict: 'differs', bought: true, found: false };

describe('classes', () => {
  it('puts numbers into the classes the plan names', () => {
    expect([0, 1, 2, 3, 4, 9].map(pagesClass)).toEqual(['0', '1', '2', '3', '4+', '4+']);
    expect([0, 12, 13, 40, 41, 100, 101, 250, 251].map(seenClass)).toEqual(['0-12', '0-12', '13-40', '13-40', '41-100', '41-100', '101-250', '101-250', '250+']);
    expect([0, 1, 2, 5, 6, 20, 21].map(countClass)).toEqual(['0', '1', '2-5', '2-5', '6-20', '6-20', '20+']);
    expect([null, 0, 1, 2, 3, 4, 10, 11].map(positionClass)).toEqual(['none', 'none', '1', '2', '3', '4-10', '4-10', '11+']);
  });

  it('keeps a search that found nothing as lower-case words, clipped', () => {
    expect(emptyQuery('  Schneider\tBROCKHAUS  1932 ')).toBe('schneider brockhaus 1932');
    expect(emptyQuery('x'.repeat(200))).toHaveLength(80);
    expect(emptyQuery('   ')).toBeUndefined();
  });
});

describe('where a visit came from', () => {
  it('reads the previous address inside the site first', () => {
    expect(originOf({ path: '/', search: '?q=dune' }, '', HOST)).toBe('search');
    expect(originOf({ path: '/', search: '?author=Orwell' }, '', HOST)).toBe('search');
    expect(originOf({ path: '/', search: '' }, 'https://www.google.com/', HOST)).toBe('home');
    expect(originOf({ path: '/collections/sf-masterworks', search: '' }, '', HOST)).toBe('collection');
    expect(originOf({ path: '/book/OL1W', search: '' }, '', HOST)).toBe('book');
    expect(originOf({ path: '/about', search: '' }, '', HOST)).toBe('other');
  });

  it('classes the referrer of a first page, and never sends it', () => {
    expect(originOf(null, '', HOST)).toBe('direct');
    expect(originOf(null, 'https://www.google.de/', HOST)).toBe('engine');
    expect(originOf(null, 'https://duckduckgo.com/', HOST)).toBe('engine');
    expect(originOf(null, 'https://www.bing.com/search?q=x', HOST)).toBe('engine');
    expect(originOf(null, 'https://t.co/abc', HOST)).toBe('social');
    expect(originOf(null, 'https://www.reddit.com/r/books', HOST)).toBe('social');
    expect(originOf(null, 'https://someblog.example/post', HOST)).toBe('other');
    expect(originOf(null, `https://${HOST}/?q=dune`, HOST)).toBe('search');
    expect(originOf(null, 'not a url', HOST)).toBe('other');
  });
});

describe('the receiver keeps only what it expects', () => {
  it('accepts a well-formed signal', () => {
    expect(parseSignal(book)).toEqual(book);
    expect(parseSignal({ t: 'search', outcome: 'empty', count: '0', clicked: 'none', mode: 'title', q: 'Gödel ESCHER' }))
      .toEqual({ t: 'search', outcome: 'empty', count: '0', clicked: 'none', mode: 'title', q: 'gödel escher' });
  });

  it('drops the words of a search that found something', () => {
    expect(parseSignal({ t: 'search', outcome: 'results', count: '2-5', clicked: '1', mode: 'title', q: 'my own name' }))
      .toEqual({ t: 'search', outcome: 'results', count: '2-5', clicked: '1', mode: 'title' });
  });

  it('drops a signal with anything out of its list, and adds nothing it was sent', () => {
    expect(parseSignal({ ...book, work: 'OL1W; DROP' })).toBeNull();
    expect(parseSignal({ ...book, from: 'https://evil.example' })).toBeNull();
    expect(parseSignal({ ...book, market: 'fr' })).toBeNull();
    expect(parseSignal({ ...book, bought: 'yes' })).toBeNull();
    expect(parseSignal({ ...book, seen: '1000' })).toBeNull();
    expect(parseSignal({ t: 'other' })).toBeNull();
    expect(parseSignal(null)).toBeNull();
    const extra = parseSignal({ ...book, ip: '1.2.3.4', ua: 'Firefox' }) as unknown as Record<string, unknown>;
    expect(extra.ip).toBeUndefined();
    expect(extra.ua).toBeUndefined();
  });
});

function fakeRedis() {
  const hashes = new Map<string, Map<string, number>>();
  const expires = new Map<string, number>();
  const commands = {
    async hIncrBy(key: string, field: string, by: number) {
      const h = hashes.get(key) ?? new Map<string, number>();
      h.set(field, (h.get(field) ?? 0) + by);
      hashes.set(key, h);
      return h.get(field);
    },
    async expire(key: string, seconds: number) {
      expires.set(key, seconds);
      return 1;
    },
    async hGetAll(key: string) {
      return Object.fromEntries(hashes.get(key) ?? new Map());
    },
  } as unknown as RedisCommands;
  return { commands, hashes, expires };
}

describe('storing and adding up', () => {
  const NOW = new Date('2026-10-04T10:00:00Z');
  const PROD = { VERCEL_ENV: 'production' };

  it('adds a book visit to the day and its work, a search to the day and its words, with their own expiry', async () => {
    const r = fakeRedis();
    const opts = { env: PROD, commands: r.commands, now: NOW };
    expect(await countSignal(book, opts)).toBe('counted');
    expect(await countSignal({ t: 'search', outcome: 'empty', count: '0', clicked: 'none', mode: 'title', q: 'schneider brockhaus' }, opts)).toBe('counted');
    expect(r.hashes.get('ins:2026-10-04:book')?.get(bookField(book))).toBe(1);
    expect(r.hashes.get('ins:2026-10-04:works')?.get('OL1168083W|1')).toBe(1);
    expect(r.hashes.get('ins:2026-10-04:empty')?.get('schneider brockhaus')).toBe(1);
    expect(r.expires.get('ins:2026-10-04:book')).toBe(RETENTION_SECONDS);
    expect(r.expires.get('ins:2026-10-04:empty')).toBe(EMPTY_RETENTION_SECONDS);
    expect(await countSignal(book, { ...opts, env: { VERCEL_ENV: 'preview' } })).toBe('off');
  });

  it('turns visits into the funnel, the rate and the verdict table', () => {
    const day = {
      [bookField(book)]: 2,
      [bookField({ ...book, bought: false, verdict: 'verified' })]: 3,
      [bookField({ ...book, picked: false, bought: false, verdict: 'none', pages: '0', seen: '0-12', from: 'engine' })]: 5,
      [bookField({ ...book, market: 'us' })]: 1,
    };
    const s = summarizeBooks([day]);
    expect(s.visits).toBe(11);
    expect(s.bought).toBe(3);
    expect(s.rate).toBeCloseTo(3 / 11);
    expect(s.funnel).toEqual({ visits: 11, wall: 6, picked: 6, bought: 3 });
    expect(s.origins.engine).toBe(5);
    expect(s.verdicts.differs).toEqual({ visits: 3, bought: 3 });
    expect(s.verdicts.verified).toEqual({ visits: 3, bought: 0 });
    expect(s.onePageOrLess).toBe(5);
    expect(summarizeBooks([day], 'us').visits).toBe(1);
    expect(summarizeBooks([{ 'garbage': 4, 'from=x|market=de': 1 }]).visits).toBe(0);
  });

  it('counts click positions among searches with results only', () => {
    const s = summarizeSearches([{
      'outcome=results|count=2-5|clicked=1|mode=title': 6,
      'outcome=results|count=2-5|clicked=none|mode=title': 2,
      'outcome=empty|count=0|clicked=none|mode=title': 3,
      'outcome=failed|count=0|clicked=none|mode=author': 1,
    }]);
    expect(s).toMatchObject({ searches: 12, empty: 3, failed: 1 });
    expect(s.positions['1']).toBe(6);
    expect(s.positions.none).toBe(2);
  });

  it('shows a search without result only from two equal ones on', () => {
    expect(emptySearches([{ 'a b': 1, 'c d': 1 }, { 'a b': 1 }])).toEqual([{ q: 'a b', n: 2 }]);
  });

  it('ranks works by visits', () => {
    expect(topWorks([{ 'OL1W|1': 2, 'OL1W|0': 3, 'OL2W|0': 4, 'evil|1': 9 }])).toEqual([
      { work: 'OL1W', visits: 5, bought: 2 },
      { work: 'OL2W', visits: 4, bought: 0 },
    ]);
  });

  it('puts it all into one report, with titles for the works it knows', async () => {
    const r = fakeRedis();
    const opts = { env: PROD, commands: r.commands, now: NOW };
    await countSignal(book, opts);
    await countSignal({ t: 'search', outcome: 'results', count: '2-5', clicked: '1', mode: 'title' }, opts);
    const report = await buildReport(7, undefined, r.commands, NOW);
    if (!report.ok) throw new Error('expected a report');
    expect(report.books.visits).toBe(1);
    expect(report.searches.searches).toBe(1);
    expect(report.works[0]?.work).toBe('OL1168083W');
    expect(report.works[0]?.title).toMatch(/Nineteen Eighty-Four/i);
  });
});
