/**
 * Merging edition pages and keeping the language tabs stable
 * (SPEC §9.3 step 11, lib/pages.ts).
 */
import { describe, expect, it } from 'vitest';
import { mergeWorkPages, orderGroups, type WorkPageData } from '../pages';
import type { Cover, Edition, LanguageGroup } from '../model';

function edition(id: string, extra: Partial<Edition> = {}): Edition {
  return { id, workId: 'OL1W', source: 'openlibrary', title: 'A Book', ...extra };
}

function cover(id: string, editionIds: string[]): Cover {
  return { id, url: `https://covers/${id}.jpg`, source: 'openlibrary', editionIds };
}

function page(offset: number, editions: Edition[], covers: Cover[], over: Partial<WorkPageData> = {}): WorkPageData {
  const { page: info, ...rest } = over;
  return {
    editions,
    covers,
    page: { offset, limit: 100, total: 250, nextOffset: offset + 100 < 250 ? offset + 100 : undefined, ...info },
    ...rest,
  };
}

const LOADING = { done: false, truncated: null } as const;
const DONE = { done: true, truncated: null } as const;

describe('mergeWorkPages', () => {
  it('keeps editions unique by id, first page wins', () => {
    const merged = mergeWorkPages(
      [
        page(0, [edition('ol:A', { publisher: 'Knopf' }), edition('ol:B')], []),
        page(100, [edition('ol:A', { publisher: 'Vintage' }), edition('ol:C')], []),
      ],
      DONE,
    );
    expect(merged.editions.map(e => e.id)).toEqual(['ol:A', 'ol:B', 'ol:C']);
    expect(merged.editions[0].publisher).toBe('Knopf');
  });

  it('unions the editions of a cover seen on several pages', () => {
    const merged = mergeWorkPages(
      [
        page(0, [edition('ol:A')], [cover('gb:x', ['ol:A'])]),
        page(100, [edition('ol:B')], [cover('gb:x', ['ol:B', 'ol:A'])]),
      ],
      DONE,
    );
    expect(merged.covers).toHaveLength(1);
    expect(merged.covers[0].editionIds).toEqual(['ol:A', 'ol:B']);
  });

  it('does not mutate the covers it was given', () => {
    const first = cover('ol:1', ['ol:A']);
    mergeWorkPages([page(0, [], [first]), page(100, [], [cover('ol:1', ['ol:B'])])], DONE);
    expect(first.editionIds).toEqual(['ol:A']);
  });

  it('collects signatures from every page', () => {
    const merged = mergeWorkPages(
      [
        page(0, [], [cover('ol:1', ['ol:A'])], { signatures: { 'ol:1': { hash: 'a'.repeat(16), contrast: 40 } } }),
        page(100, [], [cover('ol:2', ['ol:B'])], { signatures: { 'ol:2': { hash: 'b'.repeat(16), contrast: 30 } } }),
      ],
      DONE,
    );
    expect([...merged.signatures.keys()]).toEqual(['ol:1', 'ol:2']);
  });

  it('counts records scanned, capped at the total, and reports progress', () => {
    const one = mergeWorkPages([page(0, [], [])], LOADING);
    expect(one).toMatchObject({ checked: 100, total: 250, done: false, truncated: null });

    const all = mergeWorkPages([page(0, [], []), page(100, [], []), page(200, [], [])], DONE);
    // The last page holds 50 records, not 100.
    expect(all.checked).toBe(250);
    expect(all.done).toBe(true);
  });

  it('passes the truncation reason through', () => {
    const merged = mergeWorkPages([page(0, [], [])], { done: true, truncated: 'cap' });
    expect(merged.truncated).toBe('cap');
  });

  it('handles a work without any editions', () => {
    const merged = mergeWorkPages(
      [{ editions: [], covers: [], page: { offset: 0, limit: 100, total: 0 } }],
      DONE,
    );
    expect(merged).toMatchObject({ editions: [], covers: [], checked: 0, total: 0 });
  });
});

describe('orderGroups', () => {
  const group = (language: string | undefined, ids: string[]): LanguageGroup => ({ language, coverIds: ids });

  it('orders languages by when they first appeared, not by size', () => {
    const order = ['en1', 'en2', 'de1', 'fr1'];
    // German has more covers than English but showed up later.
    const groups = [group('de', ['de1', 'de2', 'de3']), group('en', ['en1', 'en2']), group('fr', ['fr1'])];
    expect(orderGroups(groups, order).map(g => g.language)).toEqual(['en', 'de', 'fr']);
  });

  it('keeps that order when a later page adds covers', () => {
    const first = orderGroups([group('en', ['en1']), group('de', ['de1'])], ['en1', 'de1']);
    expect(first.map(g => g.language)).toEqual(['en', 'de']);
    // Page 2 brings 20 German covers and one new language.
    const later = orderGroups(
      [group('de', ['de1', ...Array.from({ length: 20 }, (_, i) => `dx${i}`)]), group('en', ['en1']), group('es', ['es1'])],
      ['en1', 'de1', ...Array.from({ length: 20 }, (_, i) => `dx${i}`), 'es1'],
    );
    expect(later.map(g => g.language)).toEqual(['en', 'de', 'es']);
  });

  it('puts the searched language first and the unknown group last', () => {
    const groups = [group(undefined, ['u1']), group('en', ['en1']), group('de', ['de1'])];
    const order = ['u1', 'en1', 'de1'];
    expect(orderGroups(groups, order, 'de').map(g => g.language)).toEqual(['de', 'en', undefined]);
    expect(orderGroups(groups, order, 'all').map(g => g.language)).toEqual(['en', 'de', undefined]);
  });

  it('puts groups whose covers are not in the order list at the end', () => {
    const groups = [group('it', ['gone']), group('en', ['en1'])];
    expect(orderGroups(groups, ['en1']).map(g => g.language)).toEqual(['en', 'it']);
  });
});
