import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkSummary } from '../model';
import { mergeWorkPages } from '../pages';
import { getWorkPage } from '../work';
import { MAX_SIBLINGS, siblingsOf } from '../works';

/**
 * ROADMAP 6.13: Open Library files *Ansichten eines Clowns* as six records.
 * The search card merged them; the wall loaded one. These tests hold the
 * pieces that make the wall load what the card promised.
 */

const BOELL = { key: 'OL2633288A', name: 'Heinrich Böll' };
const lead = { id: 'OL279833W', title: 'Ansichten eines Clowns', authors: [BOELL.name], authorKeys: [BOELL.key] };

const summary = (id: string, title: string, editionCount: number, author = BOELL): WorkSummary => ({
  id, title, authors: [author.name], authorKeys: [author.key], editionCount, coverUrls: [], languages: [],
});

describe('siblingsOf', () => {
  it('finds the other records of the same book, largest first, and never the work itself', () => {
    const found = siblingsOf(lead, [
      summary('OL279833W', 'Ansichten eines Clowns', 8),
      summary('OL9063200W', 'Ansichten eines Clowns', 1),
      summary('OL8114847W', 'Ansichten eines Clowns', 3),
      // Bracketed series note: the same title under identity rule 2 (6.15 step 1).
      summary('OL15394832W', "Ansichten eines Clowns (Methuen's Twentieth Century German Texts)", 2),
    ]);
    expect(found.map(s => s.id)).toEqual(['OL8114847W', 'OL15394832W', 'OL9063200W']);
    expect(found[0].editionCount).toBe(3);
  });

  it('keeps apart another book by the same author, and the same title by someone else', () => {
    const found = siblingsOf(lead, [
      summary('OL1W', 'Gruppenbild mit Dame', 40),
      summary('OL2W', 'Ansichten eines Clowns', 2, { key: 'OL9A', name: 'Bernd Balzer' }),
    ]);
    expect(found).toEqual([]);
  });

  it('stops at MAX_SIBLINGS and drops the smallest', () => {
    const many = Array.from({ length: MAX_SIBLINGS + 3 }, (_, i) => summary(`OL${100 + i}W`, lead.title, i + 1));
    const found = siblingsOf(lead, many);
    expect(found).toHaveLength(MAX_SIBLINGS);
    expect(found.some(s => s.editionCount === 1)).toBe(false);
  });
});

describe('mergeWorkPages across records', () => {
  it('adds up the totals of different records and does not add up pages of one', () => {
    const page = (id: string, offset: number, total: number) =>
      ({ work: { id }, editions: [], covers: [], page: { offset, limit: 100, total } });
    const merged = mergeWorkPages(
      [page('OL279833W', 0, 8), page('OL8114847W', 0, 3), page('OL9063200W', 0, 1)],
      { done: true, truncated: null },
    );
    expect(merged.total).toBe(12);
    expect(merged.checked).toBe(12);
    const big = mergeWorkPages([page('OL468431W', 0, 250), page('OL468431W', 100, 250)], { done: false, truncated: null });
    expect(big.total).toBe(250);
    expect(big.checked).toBe(200);
  });
});

describe('getWorkPage page 0 and the sibling search', () => {
  const doc = (key: string, title: string, editions: number, author = BOELL) => ({
    key: `/works/${key}`, title, author_name: [author.name], author_key: [author.key],
    edition_count: editions, cover_i: 1, language: ['ger'],
  });
  let siblingAnswer: () => Response;
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    siblingAnswer = () => Response.json({ docs: [
      doc('OL279833W', 'Ansichten eines Clowns', 8),
      doc('OL8114847W', 'Ansichten eines Clowns', 3),
      doc('OL1W', 'Gruppenbild mit Dame', 40),
    ] });
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      calls.push(url.toString());
      const q = url.searchParams.get('q') ?? '';
      if (url.pathname === '/search.json' && q.startsWith('key:/works/')) {
        return Response.json({ docs: [doc('OL279833W', 'Ansichten eines Clowns', 8)] });
      }
      if (url.pathname === '/search.json' && q.startsWith('title:')) return siblingAnswer();
      if (url.pathname.endsWith('/editions.json')) return Response.json({ size: 0, entries: [] });
      return new Response('{}', { status: 404 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reports the siblings, asked by title and author key', async () => {
    const page = await getWorkPage('OL279833W', { googleBooks: false });
    expect(page?.siblings).toEqual([{ id: 'OL8114847W', editionCount: 3 }]);
    const asked = calls.find(u => u.includes('q=title'));
    expect(decodeURIComponent(asked ?? '')).toContain(`author_key:${BOELL.key}`);
  });

  it('still returns the page when the sibling search fails, and claims no siblings', async () => {
    siblingAnswer = () => new Response('{}', { status: 500 });
    const page = await getWorkPage('OL279833W', { googleBooks: false });
    expect(page).not.toBeNull();
    expect(page?.siblings).toBeUndefined();
  });

  it('does not search for siblings on a later page, for a mosaic caller, or when told not to', async () => {
    await getWorkPage('OL279833W', { googleBooks: false, offset: 100 });
    await getWorkPage('OL279833W', { googleBooks: false, siblings: false });
    expect(calls.some(u => u.includes('q=title'))).toBe(false);
  });
});
