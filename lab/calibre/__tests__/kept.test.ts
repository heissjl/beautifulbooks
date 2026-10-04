import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Catalogue, CataloguePage } from '../catalogue';
import { findWorks } from '../find';
import { AnswerStore, keptCatalogue, type Served } from '../kept';
import type { CalibreBook } from '../library';
import type { WorkSummary } from '../site';

const DAY = 86_400_000;
const dirs: string[] = [];
const folder = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'calibre-kept-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A clock the test moves, and a question that counts how often it was put. */
const clock = (start = 1_000_000) => {
  const c = { t: start, now: () => c.t };
  return c;
};
const counted = <T>(answer: () => T) => {
  const q = { asked: 0, ask: async () => (q.asked++, answer()) };
  return q;
};

describe('answers kept on disk', () => {
  it('serves a fresh answer without asking — in the next run too — and says when it was given', async () => {
    const dir = folder();
    const time = clock();
    const q = counted(() => ({ n: 1 }));
    expect(await new AnswerStore(dir, 30 * DAY, time.now).answer('page', 'OL1W-0', q.ask)).toEqual({ n: 1 });

    time.t += 29 * DAY;
    const served: Served[] = [];
    const nextRun = new AnswerStore(dir, 30 * DAY, time.now);
    expect(await nextRun.answer('page', 'OL1W-0', q.ask, { served: (s) => served.push(s) })).toEqual({ n: 1 });
    expect(q.asked).toBe(1);
    expect(served).toEqual([{ at: 1_000_000 }]);
  });

  it('asks again once the answer is older than it may be, and keeps the new one', async () => {
    const dir = folder();
    const time = clock();
    let n = 0;
    const q = counted(() => ++n);
    const store = new AnswerStore(dir, 30 * DAY, time.now);
    await store.answer('isbn', '9781857983418', q.ask);
    time.t += 30 * DAY;
    const served: Served[] = [];
    expect(await store.answer('isbn', '9781857983418', q.ask, { served: (s) => served.push(s) })).toBe(2);
    expect(served).toEqual([]);
    expect(await store.answer('isbn', '9781857983418', q.ask)).toBe(2);
    expect(q.asked).toBe(2);
  });

  it('serves the old answer, marked, when the catalogue fails — and fails itself when it has none', async () => {
    const dir = folder();
    const time = clock();
    const store = new AnswerStore(dir, 30 * DAY, time.now);
    await store.answer('page', 'OL1W-0', async () => 'then');
    time.t += 40 * DAY;
    const down = new Error('silent');
    const served: Served[] = [];
    expect(await store.answer('page', 'OL1W-0', async () => { throw down; }, { served: (s) => served.push(s) })).toBe('then');
    expect(served).toEqual([{ at: 1_000_000, error: down }]);
    // The failure replaced nothing: the next asker is told the same age.
    expect(store.read('page', 'OL1W-0')).toEqual({ at: 1_000_000, value: 'then' });
    await expect(store.answer('page', 'OL2W-0', async () => { throw down; })).rejects.toThrow('silent');
    expect(store.read('page', 'OL2W-0')).toBeNull();
  });

  it('asks again on the reader’s word, and then counts the new answer as asked', async () => {
    const dir = folder();
    const time = clock();
    let n = 0;
    const q = counted(() => ++n);
    const store = new AnswerStore(dir, 30 * DAY, time.now);
    await store.answer('page', 'OL1W-0', q.ask);
    time.t += 60_000;
    const click = time.t;
    time.t += 5;
    expect(await store.answer('page', 'OL1W-0', q.ask, { notBefore: click })).toBe(2);
    expect(await store.answer('page', 'OL1W-0', q.ask, { notBefore: click })).toBe(2);
    expect(q.asked).toBe(2);
    // A moment that has not come yet — another clock — means "now", or every answer would be too old for ever.
    time.t += 5;
    expect(await store.answer('page', 'OL1W-0', q.ask, { notBefore: time.t + DAY })).toBe(3);
    expect(await store.answer('page', 'OL1W-0', q.ask, { notBefore: time.t + DAY })).toBe(3);
  });

  it('puts one request to the catalogue for two askers at the same time', async () => {
    const store = new AnswerStore(folder());
    let asked = 0;
    let finish: (v: string) => void = () => {};
    const ask = () => {
      asked++;
      return new Promise<string>((done) => { finish = done; });
    };
    const both = Promise.all([store.answer('page', 'OL1W-0', ask), store.answer('page', 'OL1W-0', ask)]);
    finish('once');
    expect(await both).toEqual(['once', 'once']);
    expect(asked).toBe(1);
  });

  it('treats a broken or foreign file as no file', async () => {
    const dir = folder();
    const store = new AnswerStore(dir);
    await store.answer('page', 'OL1W-0', async () => 'good');
    const file = join(dir, 'page-OL1W-0.json');
    writeFileSync(file, '{"v":1,"key":"OL1W-0","at":');
    expect(store.read('page', 'OL1W-0')).toBeNull();
    writeFileSync(file, JSON.stringify({ v: 1, key: 'OL9W-0', at: 5, value: 'another work' }));
    expect(store.read('page', 'OL1W-0')).toBeNull();
    expect(await new AnswerStore(dir).answer('page', 'OL1W-0', async () => 'asked anew')).toBe('asked anew');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ key: 'OL1W-0', value: 'asked anew' });
  });

  it('keeps an answer not worth a file for the run only', async () => {
    const dir = folder();
    const q = counted(() => [] as string[]);
    const store = new AnswerStore(dir);
    await store.answer('search', 'ubik', q.ask, { worth: (v) => v.length > 0 });
    await store.answer('search', 'ubik', q.ask, { worth: (v) => v.length > 0 });
    expect(q.asked).toBe(1);
    expect(readdirSync(dir)).toEqual([]);
    await new AnswerStore(dir).answer('search', 'ubik', q.ask, { worth: (v) => v.length > 0 });
    expect(q.asked).toBe(2);
  });
});

describe('a catalogue with kept answers', () => {
  const summary = (id: string, title: string): WorkSummary => ({ id, title, authors: ['Philip K. Dick'], coverUrls: [], languages: [] });
  const page: CataloguePage = { work: { id: 'OL1W', title: 'Ubik', authors: ['Philip K. Dick'] }, covers: [], editions: 3, next: null };
  const fake = (searches: Record<string, WorkSummary[]>, pages: Record<string, CataloguePage | null> = {}): Catalogue & { asked: string[] } => {
    const asked: string[] = [];
    return {
      asked,
      search: async (q) => (asked.push(`search:${q}`), searches[q] ?? []),
      page: async (id, offset) => (asked.push(`page:${id}@${offset}`), pages[`${id}@${offset}`] ?? null),
    };
  };

  it('keeps searches and pages across runs; a search that differs only in case or spacing is the same search', async () => {
    const dir = folder();
    const first = fake({ 'Ubik Philip K. Dick': [summary('OL1W', 'Ubik')] }, { 'OL1W@0': page });
    const run1 = keptCatalogue(new AnswerStore(dir), first);
    await run1.search('Ubik Philip K. Dick');
    await run1.page('OL1W', 0);

    const second = fake({});
    const served: Served[] = [];
    const run2 = keptCatalogue(new AnswerStore(dir), second, { served: (s) => served.push(s) });
    expect((await run2.search('  ubik   philip k. dick '))[0].id).toBe('OL1W');
    expect((await run2.page('OL1W', 0))?.editions).toBe(3);
    expect(second.asked).toEqual([]);
    expect(served).toHaveLength(2);
    // Another page of the same work is another question.
    expect(await run2.page('OL1W', 100)).toBeNull();
    expect(second.asked).toEqual(['page:OL1W@100']);
  });

  it('does not write down an empty search or an unknown work — either may be a failure in disguise', async () => {
    const dir = folder();
    const nothing = fake({});
    const kept = keptCatalogue(new AnswerStore(dir), nothing);
    expect(await kept.search('nothing here')).toEqual([]);
    expect(await kept.page('OL9W', 0)).toBeNull();
    expect(readdirSync(dir)).toEqual([]);

    const later = fake({ 'nothing here': [summary('OL1W', 'Ubik')] }, { 'OL9W@0': page });
    const nextRun = keptCatalogue(new AnswerStore(dir), later);
    expect(await nextRun.search('nothing here')).toHaveLength(1);
    expect(await nextRun.page('OL9W', 0)).not.toBeNull();
  });

  it('lets a book opened before be found while the catalogue is silent, and says so', async () => {
    const dir = folder();
    const time = clock();
    const book: CalibreBook = { id: 1, title: 'Ubik', authors: ['Philip K. Dick'], isbns: [], hasCover: true, path: 'a/b (1)', formats: ['EPUB'], languages: ['en'] };
    const up = fake({ 'Ubik Philip K. Dick': [summary('OL1W', 'Ubik')] });
    await findWorks(book, keptCatalogue(new AnswerStore(dir, 30 * DAY, time.now), up), {});

    time.t += 45 * DAY;
    const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    const shut: Catalogue = { search: async () => { throw new TypeError('fetch failed', { cause: refused }); }, page: async () => null };
    const served: Served[] = [];
    const found = await findWorks(book, keptCatalogue(new AnswerStore(dir, 30 * DAY, time.now), shut, { served: (s) => served.push(s) }), {});
    expect(found).toMatchObject({ picked: 'OL1W', reason: 'author+title' });
    expect(found.failed).toBeUndefined();
    expect(served).toHaveLength(1);
    expect((served[0].error as Error).cause).toBe(refused);
  });
});

describe('the covers listed under the book’s ISBN', () => {
  const book: CalibreBook = { id: 1, title: 'Ubik', authors: ['Philip K. Dick'], isbns: ['9781857988536'], hasCover: true, path: 'a/b (1)', formats: ['EPUB'], languages: ['en'] };
  const none: Catalogue = { search: async () => [], page: async (id) => (id === 'OL1W' ? { work: { id: 'OL1W', title: 'Ubik', authors: ['Philip K. Dick'] }, covers: [], editions: 3, next: null } : null) };

  it('come from whoever the app hands in, and name the work', async () => {
    const found = await findWorks(book, none, { edition: async (isbn) => (isbn === '9781857988536' ? { workId: 'OL1W', covers: ['ol:10'] } : null) });
    expect(found).toMatchObject({ picked: 'OL1W', reason: 'isbn', editionCovers: ['ol:10'] });
  });

  it('are simply absent when nobody was asked, and a failure when the asking failed', async () => {
    const notAsked = await findWorks(book, none, { edition: async () => undefined });
    expect(notAsked).toMatchObject({ editionCovers: [] });
    expect(notAsked.failed).toBeUndefined();
    const failed = await findWorks(book, none, { edition: async () => { throw new Error('timeout'); } });
    expect(failed.failed).toBe('Open Library did not say which covers it lists under this ISBN.');
  });
});
