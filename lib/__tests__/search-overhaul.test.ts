/**
 * The search overhaul (ROADMAP 6.60, SPEC F1.9 and F1.10) against the
 * answers recorded in lib/__fixtures__/search/responses.json
 * (`npx tsx scripts/record-search-fixtures.ts`). No live calls: a URL that is
 * not in the file fails the test.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/search/route';
import { authorResultWorks, authorSearchPath, parseAuthorQuery, pickAuthor } from '../authorsearch';
import { resetRateLimits } from '../ratelimit';
import { search, searchByAuthor } from '../search';
import { authorLookupUrl, authorWorksUrl, searchUrl, type OlAuthorDoc } from '../sources/openlibrary';
import type { OlSearchDoc } from '../sources/openlibrary-parse';

const RESPONSES: Record<string, { docs: unknown[] }> = JSON.parse(
  readFileSync(path.join(__dirname, '..', '__fixtures__', 'search', 'responses.json'), 'utf8'),
);

let calls: string[] = [];
/** URLs that answer with silence instead of their fixture. */
let silent = new Set<string>();

function timeout(): never {
  const e = new Error('timed out');
  e.name = 'TimeoutError';
  throw e;
}

beforeEach(() => {
  resetRateLimits();
  calls = [];
  silent = new Set();
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (silent.has(url)) timeout();
    const body = RESPONSES[url];
    if (!body) throw new Error(`no fixture for ${url}`);
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('typo correction (F1.9)', () => {
  it('answers an empty search with the corrected one and says so', async () => {
    const r = await search('gatsbee');
    expect(r.correction).toEqual({ from: 'gatsbee', to: 'gatsby', applied: true });
    expect(r.works[0].title).toBe('The Great Gatsby');
    expect(calls).toEqual([searchUrl('gatsbee'), searchUrl('gatsby')]);
  });

  it('corrects a phrase word by word', async () => {
    const r = await search('pride and prejudise');
    expect(r.correction?.to).toBe('pride and prejudice');
    expect(r.works[0].authors[0]).toBe('Jane Austen');
  });

  it('replaces a weak answer when the corrected one is far stronger', async () => {
    // The original answer is books about Tolkien and namesakes, none above 26 editions.
    const r = await search('Tolkein');
    expect(r.correction).toEqual({ from: 'Tolkein', to: 'Tolkien', applied: true });
    expect(r.works[0].title).toBe('The Hobbit');
    const h = await search('Hemmingway');
    expect(h.correction?.to).toBe('Hemingway');
    expect(h.works[0].authors[0]).toBe('Ernest Hemingway');
  });

  it('never asks a second time when the first answer is strong', async () => {
    const r = await search('harry poter');
    expect(r.correction).toBeUndefined();
    expect(r.works[0].title).toMatch(/^Harry Potter/);
    expect(calls).toEqual([searchUrl('harry poter')]);
  });

  it('leaves an ordinary weak answer alone when no word is a near miss', async () => {
    const r = await search('piranesi');
    expect(r.correction).toBeUndefined();
    expect(r.works[0].title).toBe('Piranesi');
    expect(calls).toHaveLength(1);
  });

  it('does not correct with exact=1 — the reader asked for what they typed', async () => {
    const r = await search('gatsbee', { exact: true });
    expect(r.works).toEqual([]);
    expect(r.correction).toBeUndefined();
    expect(calls).toEqual([searchUrl('gatsbee')]);
  });

  it('offers the word but claims nothing when the corrected search is silent (N12)', async () => {
    silent.add(searchUrl('gatsby'));
    const r = await search('gatsbee');
    expect(r.works).toEqual([]);
    expect(r.correction).toEqual({ from: 'gatsbee', to: 'gatsby', applied: false });
  });

  it('keeps a weak answer as it was when the corrected search is silent', async () => {
    silent.add(searchUrl('Tolkien'));
    const r = await search('Tolkein');
    expect(r.correction).toBeUndefined();
    expect(r.works.length).toBeGreaterThan(0);
  });

  it('never asks Google', async () => {
    await search('gatsbee');
    await search('Tolkein');
    expect(calls.some(u => u.includes('googleapis'))).toBe(false);
  });
});

describe('pickAuthor', () => {
  const lookup = (name: string) => (RESPONSES[authorLookupUrl(name)].docs as OlAuthorDoc[]);

  it('takes the person most readers know, not Open Library’s first hit', () => {
    expect(lookup('Tolkien')[0].name).toBe('Christopher Tolkien');
    expect(pickAuthor(lookup('Tolkien'))).toMatchObject({ key: 'OL26320A', keys: ['OL26320A'] });
  });

  it('adds records of the same name that readers use too (1984 hangs on a small one)', () => {
    const orwell = pickAuthor(lookup('George Orwell'))!;
    expect(orwell.key).toBe('OL118077A');
    expect(orwell.keys).toContain('OL15318546A');
  });

  it('leaves out a namesake nobody reads', () => {
    expect(pickAuthor(lookup('Harper Lee'))!.keys).toEqual(['OL498120A']);
  });

  it('finds a person under an alternate spelling', () => {
    expect(pickAuthor(lookup('Dostojewski'))?.key).toBe('OL22242A');
  });
});

describe('authorResultWorks', () => {
  it('keeps only her own records, most-printed first (Harper Lee: 3 of 18 in free text)', () => {
    const docs = RESPONSES[authorWorksUrl('OL498120A')].docs as OlSearchDoc[];
    const works = authorResultWorks(docs, ['OL498120A']);
    expect(works[0].title).toBe('To Kill a Mockingbird');
    expect(works.every(w => w.authorKeys?.[0] === 'OL498120A')).toBe(true);
    expect(works.some(w => /cliffsnotes/i.test(w.title))).toBe(false);
    const counts = works.map(w => w.editionCount ?? 0);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });
});

describe('searchByAuthor (F1.10)', () => {
  it('resolves a name and lists her works', async () => {
    const r = await searchByAuthor({ name: 'George Orwell' });
    expect(r.author?.key).toBe('OL118077A');
    expect(r.works[0].title).toBe('Nineteen Eighty-Four');
    expect(r.works.map(w => w.title)).toContain('Animal Farm');
  });

  it('corrects a misspelt name when the first answer is a namesake nobody reads', async () => {
    const r = await searchByAuthor({ name: 'Tolkein' });
    expect(r.correction).toEqual({ from: 'Tolkein', to: 'Tolkien', applied: true });
    expect(r.author?.key).toBe('OL26320A');
    expect(r.works[0].title).toBe('The Hobbit');
  });

  it('keeps the key from a link and adds her other records by name', async () => {
    const r = await searchByAuthor({ name: 'George Orwell', key: 'OL15318546A' });
    expect(r.works[0].title).toBe('Nineteen Eighty-Four');
    expect(calls).toContain(authorWorksUrl(['OL118077A', 'OL16029200A', 'OL16230010A', 'OL15318546A']));
  });

  it('goes by the key alone when the name lookup is silent', async () => {
    silent.add(authorLookupUrl('Harper Lee'));
    const r = await searchByAuthor({ name: 'Harper Lee', key: 'OL498120A' });
    expect(r.author).toEqual({ key: 'OL498120A', name: 'Harper Lee' });
    expect(r.works[0].title).toBe('To Kill a Mockingbird');
  });

  it('throws when Open Library is silent and there is no key to fall back on', async () => {
    silent.add(authorLookupUrl('Harper Lee'));
    await expect(searchByAuthor({ name: 'Harper Lee' })).rejects.toThrow(/did not answer/);
  });
});

describe('parseAuthorQuery / authorSearchPath', () => {
  it('reads name and key from the address and ignores a malformed key', () => {
    expect(parseAuthorQuery(' Harper  Lee ', 'OL498120A')).toEqual({ name: 'Harper Lee', key: 'OL498120A' });
    expect(parseAuthorQuery('Harper Lee', '../x')).toEqual({ name: 'Harper Lee' });
    expect(parseAuthorQuery('', '')).toBeNull();
  });
  it('builds the link the "More by …" heading uses', () => {
    expect(authorSearchPath('Harper Lee', 'OL498120A')).toBe('/?author=Harper+Lee&key=OL498120A');
  });
});

describe('GET /api/search', () => {
  let client = 0;
  const get = (qs: string) => GET(new NextRequest(new URL(`http://localhost/api/search${qs}`), {
    headers: { 'x-forwarded-for': `192.0.2.${++client}` },
  }));

  it('answers the author mode', async () => {
    const res = await get('?author=Harper%20Lee');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.author.key).toBe('OL498120A');
    expect(body.works.length).toBeGreaterThan(0);
  });

  it('answers 503, not an empty list, when the author lookup is silent (N12)', async () => {
    silent.add(authorLookupUrl('Harper Lee'));
    const res = await get('?author=Harper%20Lee');
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuses a name too short to ask', async () => {
    const res = await get('?author=Li');
    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it('carries the correction and honours exact=1', async () => {
    expect((await (await get('?q=gatsbee')).json()).correction.to).toBe('gatsby');
    expect((await (await get('?q=gatsbee&exact=1')).json()).correction).toBeUndefined();
  });

  it('never spends the google bucket: 25 searches in a row pass the google limit', async () => {
    // The search bucket allows 30 in a burst; google allows fewer. Same client for all.
    const same = () => GET(new NextRequest(new URL('http://localhost/api/search?q=piranesi'), {
      headers: { 'x-forwarded-for': '192.0.2.250' },
    }));
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++) statuses.push((await same()).status);
    expect(statuses.every(s => s === 200)).toBe(true);
  });
});
