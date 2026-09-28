/**
 * "More by …" (ROADMAP 6.53): the filter over Open Library's author search,
 * the exclusion of the current work, the wording, and the route's promises
 * (no Google, its own bucket, silence never cached). Fixtures recorded with
 * `npx tsx scripts/record-author-fixtures.ts`; no test asks the network.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authorRowHeading, authorSearchHref, excludeCurrent, isAuthorKey, looksLikeVolumePart, minEditions,
  otherWorksByAuthor, withCuratedCovers, ROW_CANDIDATES, ROW_DESKTOP, type AuthorSearchDoc, type AuthorWork,
} from '../authorworks';
import { resetRateLimits, RATE_RULES } from '../ratelimit';
import { authorWorksUrl } from '../sources/openlibrary';
import { GET } from '@/app/api/authors/[key]/works/route';

function fixture(key: string): AuthorSearchDoc[] {
  const file = path.join(__dirname, '..', '__fixtures__', 'authors', `${key}.json`);
  return (JSON.parse(readFileSync(file, 'utf8')) as { docs: AuthorSearchDoc[] }).docs;
}

const titles = (ws: readonly AuthorWork[]) => ws.map(w => w.title);

function doc(title: string, editions: number, over: Partial<AuthorSearchDoc> = {}): AuthorSearchDoc {
  return {
    key: `/works/OL${Math.abs(hash(title + editions))}W`,
    title,
    author_name: ['A. Author'],
    author_key: ['OL1A'],
    edition_count: editions,
    cover_i: 100 + editions,
    ...over,
  };
}
function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

describe('otherWorksByAuthor — rules', () => {
  it('keeps only records whose first author is the one asked for', () => {
    const out = otherWorksByAuthor([
      doc('Her Novel', 50),
      doc('An Anthology', 40, { author_key: ['OL9A', 'OL1A'] }),
    ], 'OL1A');
    expect(titles(out)).toEqual(['Her Novel']);
  });

  it('drops secondary literature, marked adaptations and split volumes', () => {
    const out = otherWorksByAuthor([
      doc('Her Novel', 50),
      doc('Her Novel Study Guide', 20),
      doc('Her Novel (graphic novel)', 20),
      doc('Gone with the Wind [2/2]', 20),
      doc('Collected Works Vol. 2', 20),
    ], 'OL1A');
    expect(titles(out)).toEqual(['Her Novel']);
  });

  it('drops records without a cover', () => {
    expect(titles(otherWorksByAuthor([doc('Her Novel', 50), doc('No Scan', 30, { cover_i: undefined })], 'OL1A'))).toEqual(['Her Novel']);
  });

  it('applies the strict floor max(2, 2 %) of the largest record', () => {
    // Largest 400: the floor is 8, so a 7-edition record is out, 8 is in.
    const out = otherWorksByAuthor([doc('Big', 400), doc('Seven', 7), doc('Eight', 8)], 'OL1A');
    expect(titles(out)).toEqual(['Big', 'Eight']);
    // Small author: the floor is 2, so a one-edition record is out.
    expect(titles(otherWorksByAuthor([doc('Small', 20), doc('One', 1), doc('Two', 2)], 'OL1A'))).toEqual(['Small', 'Two']);
    expect(minEditions(50)).toBe(2);
    expect(minEditions(1000)).toBe(20);
  });

  it('merges records of the same title into one tile with the largest record’s id and cover', () => {
    const big = doc('The Trial', 300);
    const small = doc('Trial', 30);
    const out = otherWorksByAuthor([small, big], 'OL1A');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe(big.key.replace('/works/', ''));
    expect(out[0].coverId).toBe(big.cover_i);
    expect(out[0].editionCount).toBe(330);
  });

  it('sends at most twelve, most printed first', () => {
    const docs = Array.from({ length: 20 }, (_, i) => doc(`Book ${String.fromCharCode(65 + i)}`, 100 - i));
    const out = otherWorksByAuthor(docs, 'OL1A');
    expect(out).toHaveLength(ROW_CANDIDATES);
    expect(out[0].title).toBe('Book A');
  });

  it('recognises volume parts without eating ordinary titles', () => {
    expect(looksLikeVolumePart('Gone with the Wind [2/2]')).toBe(true);
    expect(looksLikeVolumePart('Tagebücher Band 3')).toBe(true);
    expect(looksLikeVolumePart('Gone with the Wind. 2/3')).toBe(true);
    expect(looksLikeVolumePart('Gone With the Wind. 1/?')).toBe(true);
    expect(looksLikeVolumePart('Letters, 1936-1949')).toBe(false);
    expect(looksLikeVolumePart('Juvenilia - Volume I Illustrated')).toBe(true);
    expect(looksLikeVolumePart('Band of Brothers')).toBe(false);
    expect(looksLikeVolumePart('The Left Hand of Darkness')).toBe(false);
    expect(looksLikeVolumePart('Tehanu (The Earthsea Cycle, Book 4)')).toBe(false);
  });
});

describe('otherWorksByAuthor — recorded authors (PLAN-6.53 §4, §8)', () => {
  const row = (key: string, id: string, title: string) => titles(excludeCurrent(otherWorksByAuthor(fixture(key), key), { id, title }));

  it('Fitzgerald: six novels and story collections, not Gatsby', () => {
    expect(row('OL27349A', 'OL468431W', 'The Great Gatsby')).toEqual([
      'This Side of Paradise', 'The Beautiful and Damned', 'Tender is the Night',
      'The Curious Case of Benjamin Button', 'May Day', 'Flappers and Philosophers',
    ]);
  });

  it('Kafka: catalogue titles, as Julian decided (Der Proceß, Das Schloß)', () => {
    const out = row('OL33146A', 'OL498556W', 'Metamorphosis');
    expect(out.slice(0, 2)).toEqual(['Der Proceß', 'Das Schloß']);
    expect(out).toHaveLength(ROW_DESKTOP);
  });

  it('Harper Lee: the Turkish record of her own novel stays out under the strict floor', () => {
    const out = row('OL498120A', 'OL3140822W', 'To Kill a Mockingbird');
    expect(out).toContain('Go Set A Watchman');
    expect(out.some(t => /Tespih/i.test(t))).toBe(false);
    expect(out).not.toContain('To Kill a Mockingbird');
  });

  it('Margaret Mitchell: nothing but the work itself survives, so the page shows only the line', () => {
    expect(row('OL151749A', 'OL267933W', 'Gone With the Wind')).toEqual([]);
  });

  it('Reed’s second key is scatter and yields nothing', () => {
    expect(otherWorksByAuthor(fixture('OL11412010A'), 'OL11412010A')).toEqual([]);
  });

  it('no row of the recorded authors holds secondary literature, a split volume or the work itself', () => {
    for (const [key, id, title] of [
      ['OL27349A', 'OL468431W', 'The Great Gatsby'], ['OL31353A', 'OL59800W', 'The Left Hand of Darkness'],
      ['OL33146A', 'OL498556W', 'Metamorphosis'], ['OL52922A', 'OL675783W', "The Handmaid's Tale"],
      ['OL498120A', 'OL3140822W', 'To Kill a Mockingbird'], ['OL27626A', 'OL30751W', 'Mumbo jumbo'],
    ]) {
      const out = excludeCurrent(otherWorksByAuthor(fixture(key), key), { id, title });
      expect(out.length, key).toBeGreaterThan(0);
      for (const w of out) {
        expect(w.id).not.toBe(id);
        expect(looksLikeVolumePart(w.title)).toBe(false);
        expect(w.coverId).toBeGreaterThan(0);
      }
    }
  });
});

describe('excludeCurrent', () => {
  const ws: AuthorWork[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((t, i) => ({ id: `W${i}`, title: `Book ${t}`, coverId: i + 1, editionCount: 100 - i }));

  it('drops the work, its siblings and same-titled records, keeps the order, stops at six', () => {
    const out = excludeCurrent([...ws, { id: 'X', title: 'The Book A', coverId: 9, editionCount: 1 }], {
      id: 'W0', title: 'Book A', siblingIds: ['W2'],
    });
    expect(out.map(w => w.id)).toEqual(['W1', 'W3', 'W4', 'W5', 'W6', 'W7']);
  });

  it('takes a smaller limit for the phone', () => {
    expect(excludeCurrent(ws, { id: 'none', title: 'none' }, 3)).toHaveLength(3);
  });
});

describe('withCuratedCovers', () => {
  it('puts Julian’s chosen cover in place of the default where he picked one', () => {
    const out = withCuratedCovers(
      [{ id: 'W1', title: 'a', coverId: 1, editionCount: 5 }, { id: 'W2', title: 'b', coverId: 2, editionCount: 4 }],
      new Map([['W2', 99]]),
    );
    expect(out.map(w => w.coverId)).toEqual([1, 99]);
  });
});

describe('wording', () => {
  it('names the author and claims nothing about completeness', () => {
    const h = authorRowHeading('Ursula K. Le Guin');
    expect(h).toBe('More by Ursula K. Le Guin');
    expect(h).not.toMatch(/\b(all|every|complete)\b/i);
    // The author search since 6.60, pinned to her key when there is one.
    expect(authorSearchHref('Ursula K. Le Guin')).toBe('/?author=Ursula+K.+Le+Guin');
    expect(authorSearchHref('Ursula K. Le Guin', 'OL31353A')).toBe('/?author=Ursula+K.+Le+Guin&key=OL31353A');
    expect(authorSearchHref('X', 'not-a-key')).toBe('/?author=X');
  });

  it('accepts only Open Library author keys', () => {
    expect(isAuthorKey('OL27349A')).toBe(true);
    expect(isAuthorKey('OL27349W')).toBe(false);
    expect(isAuthorKey('OL1A/../x')).toBe(false);
  });
});

describe('GET /api/authors/[key]/works', () => {
  let client = 0;
  let respond: (url: string) => Response;
  const calls: string[] = [];

  function get(key: string): Promise<Response> {
    const url = new URL(`http://localhost/api/authors/${key}/works`);
    return GET(new NextRequest(url, { headers: { 'x-forwarded-for': `198.51.100.${++client}` } }), { params: Promise.resolve({ key }) });
  }

  beforeEach(() => {
    resetRateLimits();
    calls.length = 0;
    respond = () => new Response(JSON.stringify({ numFound: 50, docs: fixture('OL27349A') }), { headers: { 'content-type': 'application/json' } });
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      return respond(url);
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks Open Library once and Google never, and caches a real answer', async () => {
    const res = await get('OL27349A');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authorKey).toBe('OL27349A');
    expect(body.works.length).toBeGreaterThan(0);
    expect(calls).toEqual([authorWorksUrl('OL27349A')]);
    expect(calls.some(u => u.includes('googleapis'))).toBe(false);
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=86400');
  });

  it('uses the chosen cover of a curated work (Gatsby)', async () => {
    const body = await (await get('OL27349A')).json();
    const gatsby = body.works.find((w: AuthorWork) => w.id === 'OL468431W');
    // The Great Gatsby is curated; its chosen cover is not Open Library's default.
    const raw = fixture('OL27349A').find(d => d.key === '/works/OL468431W');
    expect(gatsby).toBeDefined();
    expect(gatsby.coverId).not.toBe(raw?.cover_i);
  });

  it('answers 503 and forbids caching when Open Library is silent', async () => {
    respond = () => { const e = new Error('timed out'); e.name = 'TimeoutError'; throw e; };
    const res = await get('OL27349A');
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('answers 200 with an empty list when the catalogue answered with nothing', async () => {
    respond = () => new Response(JSON.stringify({ numFound: 0, docs: [] }), { headers: { 'content-type': 'application/json' } });
    const res = await get('OL1A');
    expect(res.status).toBe(200);
    expect((await res.json()).works).toEqual([]);
  });

  it('refuses a malformed key without asking anyone', async () => {
    const res = await get('robert');
    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('spends its own bucket, never the google one', async () => {
    // Exhaust `author` for one client: the next request is refused although `google` is untouched.
    const ip = '192.0.2.77';
    const once = () => GET(new NextRequest(new URL('http://localhost/api/authors/OL27349A/works'), { headers: { 'x-forwarded-for': ip } }), { params: Promise.resolve({ key: 'OL27349A' }) });
    // Were `google` (capacity 20) charged too, request 21 would already be refused.
    expect(RATE_RULES.author.capacity).toBeGreaterThan(RATE_RULES.google.capacity);
    const statuses: number[] = [];
    for (let i = 0; i < RATE_RULES.author.capacity; i++) statuses.push((await once()).status);
    expect(statuses.every(s => s === 200)).toBe(true);
    expect((await once()).status).toBe(429);
  });
});
