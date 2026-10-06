/** The browser's signals and what the view makes of them (ROADMAP 3.1b, docs/plans/PLAN-3.1-analyse.md §4). */
import { describe, expect, it } from 'vitest';
import type { RedisCommands } from '../hotornot/store';
import { EMPTY_RETENTION_SECONDS, RETENTION_SECONDS } from '../insights/model';
import { buildReport } from '../insights/report';
import {
  bookField,
  countClass,
  emptyQuery,
  entryOf,
  landingField,
  landingOf,
  originOf,
  pagesClass,
  parseSignal,
  positionClass,
  seenClass,
  type BookSignal,
} from '../insights/signals';
import { countSignal } from '../insights/store';
import { emptySearches, summarizeBooks, summarizeChannels, summarizeSearches, topWorks } from '../insights/visits';

const HOST = 'buyitscovers.com';
const book: BookSignal = { t: 'book', work: 'OL1168083W', from: 'search', market: 'de', pages: '2', seen: '13-40', picked: true, verdict: 'differs', bought: true, found: false, entry: 'engine' };

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
    expect(originOf({ path: '/shelfportrait/k3x9q2ab', search: '' }, '', HOST)).toBe('shelf');
    expect(originOf({ path: '/shelfportrait/board', search: '?b=a1fz.7gxh3' }, '', HOST)).toBe('shelf');
    expect(originOf({ path: '/shelfportraits', search: '' }, '', HOST)).toBe('page');
    expect(originOf({ path: '/about', search: '' }, '', HOST)).toBe('page');
  });

  it('classes the referrer of a first page, and never sends it', () => {
    expect(originOf(null, '', HOST)).toBe('direct');
    expect(originOf(null, 'https://www.google.de/', HOST)).toBe('engine');
    expect(originOf(null, 'https://duckduckgo.com/', HOST)).toBe('engine');
    expect(originOf(null, 'https://www.bing.com/search?q=x', HOST)).toBe('engine');
    expect(originOf(null, 'https://t.co/abc', HOST)).toBe('x');
    expect(originOf(null, 'https://www.reddit.com/r/books', HOST)).toBe('reddit');
    expect(originOf(null, 'https://www.facebook.com/', HOST)).toBe('social');
    expect(originOf(null, 'https://someblog.example/post', HOST)).toBe('other');
    expect(originOf(null, `https://${HOST}/?q=dune`, HOST)).toBe('search');
    expect(originOf(null, 'not a url', HOST)).toBe('other');
  });
});

describe('channels (ROADMAP 5.6a)', () => {
  it('gives the platforms a launch or a pin goes to a class of their own', () => {
    const cases: Array<[string, string]> = [
      ['https://news.ycombinator.com/item?id=1', 'hn'],
      ['https://old.reddit.com/r/printSF/comments/x', 'reddit'],
      ['https://redd.it/abc', 'reddit'],
      ['https://www.pinterest.de/pin/123/', 'pinterest'],
      ['https://pin.it/xyz', 'pinterest'],
      ['https://l.instagram.com/?u=x', 'instagram'],
      ['https://www.tiktok.com/@someone', 'tiktok'],
      ['https://bsky.app/profile/x', 'bluesky'],
      ['https://t.co/AbC123', 'x'],
      ['https://x.com/buyitscovers', 'x'],
      ['https://mobile.twitter.com/someone', 'x'],
      ['https://www.producthunt.com/posts/x', 'producthunt'],
      ['https://www.linkedin.com/feed', 'social'],
      ['https://notreddit.com.example/', 'other'],
    ];
    for (const [referrer, origin] of cases) expect(originOf(null, referrer, HOST), referrer).toBe(origin);
  });

  it('lets a ?via= mark win over the referrer on the first page only, and ignores marks off the list', () => {
    expect(originOf(null, '', HOST, '?via=pinterest')).toBe('pinterest');
    expect(originOf(null, 'https://www.google.com/', HOST, '?cover=1&via=hn')).toBe('hn');
    expect(originOf(null, '', HOST, '?via=blog')).toBe('blog');
    expect(originOf(null, '', HOST, '?via=x')).toBe('x');
    expect(originOf(null, '', HOST, '?via=evil.example')).toBe('direct');
    expect(originOf({ path: '/', search: '' }, '', HOST, '?via=hn')).toBe('home');
    expect(entryOf('?via=mail', 'https://www.google.com/', HOST)).toBe('mail');
    expect(entryOf('', 'https://www.google.com/', HOST)).toBe('engine');
    expect(entryOf('', `https://${HOST}/book/OL1W`, HOST)).toBe('site');
    expect(entryOf('', '', HOST)).toBe('direct');
  });

  it('knows which pages are landing pages', () => {
    expect(landingOf('/', '')).toBe('home');
    expect(landingOf('/', '?q=dune&via=hn')).toBe('search');
    expect(landingOf('/collections', '')).toBe('collections');
    expect(landingOf('/collections/readers', '')).toBe('collections');
    expect(landingOf('/collections/sf-masterworks', '')).toBe('collection');
    expect(landingOf('/c/abc123', '')).toBe('wall');
    expect(landingOf('/book/OL1W', '')).toBeNull();
    expect(landingOf('/c/abc123/edit', '')).toBeNull();
    expect(landingOf('/about', '')).toBeNull();
  });

  it('accepts a landing signal and nothing that identifies the page', () => {
    const landing = { t: 'landing', page: 'collection', entry: 'pinterest', first: true, opened: false };
    expect(parseSignal(landing)).toEqual(landing);
    expect(parseSignal({ ...landing, slug: 'sf-masterworks' })).toEqual(landing);
    expect(parseSignal({ ...landing, page: '/c/abc' })).toBeNull();
    expect(parseSignal({ ...landing, entry: 'news.ycombinator.com' })).toBeNull();
    expect(parseSignal({ ...landing, first: 'yes' })).toBeNull();
    expect(parseSignal({ ...book, entry: undefined })).toBeNull();
  });

  it('adds up entries per channel, what they opened and how often they reached a shop', async () => {
    const day = '2026-10-04';
    const books = {
      // First page a book, from HN: an entry that opened a book.
      [bookField({ ...book, from: 'hn', entry: 'hn', bought: true })]: 2,
      [bookField({ ...book, from: 'hn', entry: 'hn', bought: false })]: 1,
      // Reached from a collection in a visit that began on Pinterest.
      [bookField({ ...book, from: 'collection', entry: 'pinterest', bought: true })]: 1,
      // A book reached from another page of the site is not an entry.
      [bookField({ ...book, from: 'page', entry: 'direct', bought: false })]: 4,
      // Counted before 5.6a: no channel.
      [bookField(book).replace('|entry=engine', '')]: 5,
    };
    const landings = {
      [landingField({ t: 'landing', page: 'collection', entry: 'pinterest', first: true, opened: true })]: 1,
      [landingField({ t: 'landing', page: 'collection', entry: 'pinterest', first: true, opened: false })]: 3,
      [landingField({ t: 'landing', page: 'home', entry: 'direct', first: true, opened: false })]: 6,
      [landingField({ t: 'landing', page: 'home', entry: 'hn', first: false, opened: true })]: 2,
    };
    const s = summarizeChannels([day], [books], [landings]);
    const by = Object.fromEntries(s.rows.map(r => [r.entry, r]));
    expect(by.hn).toEqual({ entry: 'hn', entries: 3, opened: 3, bookVisits: 3, bought: 2 });
    expect(by.pinterest).toEqual({ entry: 'pinterest', entries: 4, opened: 1, bookVisits: 1, bought: 1 });
    expect(by.direct).toEqual({ entry: 'direct', entries: 6, opened: 0, bookVisits: 4, bought: 0 });
    expect(s.entries).toBe(13);
    expect(s.perDay).toEqual([{ day, clicks: 7 }]);
    expect(s.landings.collection).toEqual({ visits: 4, first: 4, opened: 1 });
    expect(s.landings.home).toEqual({ visits: 8, first: 6, opened: 2 });
    expect(s.unattributed).toBe(5);

    const r = fakeRedis();
    const opts = { env: { VERCEL_ENV: 'production' }, commands: r.commands, now: new Date(`${day}T10:00:00Z`) };
    expect(await countSignal({ t: 'landing', page: 'wall', entry: 'mail', first: true, opened: true }, opts)).toBe('counted');
    expect(r.hashes.get(`ins:${day}:landing`)?.get('page=wall|entry=mail|first=1|opened=1')).toBe(1);
    expect(r.expires.get(`ins:${day}:landing`)).toBe(RETENTION_SECONDS);
    const report = await buildReport(7, undefined, r.commands, opts.now);
    if (!report.ok) throw new Error('expected a report');
    expect(report.channels.rows).toEqual([{ entry: 'mail', entries: 1, opened: 1, bookVisits: 0, bought: 0 }]);
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
