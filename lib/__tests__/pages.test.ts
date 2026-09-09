/**
 * Merging edition pages and keeping the language tabs stable
 * (SPEC §9.3 step 11, lib/pages.ts).
 */
import { describe, expect, it } from 'vitest';
import { coverForId, leadLanguagesSettled, mergeWorkPages, orderGroups, type WorkPageData } from '../pages';
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
  const group = (language: string | undefined, n: number): LanguageGroup => ({
    language,
    coverIds: Array.from({ length: n }, (_, i) => `${language ?? 'x'}-${i}`),
  });

  it('leads with English, then German, whatever the counts say', () => {
    const groups = [group('tr', 40), group('de', 3), group('es', 20), group('en', 8)];
    expect(orderGroups(groups).map(g => g.language)).toEqual(['en', 'de', 'tr', 'es']);
  });

  it('orders the tail by size, so the big languages come first', () => {
    const groups = [group('es', 2), group('fr', 9), group('it', 5)];
    expect(orderGroups(groups).map(g => g.language)).toEqual(['fr', 'it', 'es']);
  });

  it('holds the first two places while later pages arrive', () => {
    const first = orderGroups([group('en', 8), group('de', 3), group('tr', 2)]);
    expect(first.map(g => g.language)).toEqual(['en', 'de', 'tr']);
    // Turkish overtakes both, but must not push them aside.
    const later = orderGroups([group('en', 9), group('de', 4), group('tr', 60), group('es', 30)]);
    expect(later.map(g => g.language)).toEqual(['en', 'de', 'tr', 'es']);
  });

  it('puts the searched language ahead of the leads, and unknown last', () => {
    const groups = [group(undefined, 5), group('en', 8), group('de', 3), group('fr', 4)];
    expect(orderGroups(groups, 'fr').map(g => g.language)).toEqual(['fr', 'en', 'de', undefined]);
    expect(orderGroups(groups, 'all').map(g => g.language)).toEqual(['en', 'de', 'fr', undefined]);
  });

  it('leads with a searched lead language too, without giving it two places', () => {
    const groups = [group(undefined, 5), group('en', 8), group('de', 3), group('fr', 4)];
    // The reported bug: German searched, English tab shown (2026-09-07).
    expect(orderGroups(groups, 'de').map(g => g.language)).toEqual(['de', 'en', 'fr', undefined]);
    expect(orderGroups(groups, 'en').map(g => g.language)).toEqual(['en', 'de', 'fr', undefined]);
  });

  it('copes with a work that has no English or German editions', () => {
    const groups = [group('it', 3), group('fr', 7), group(undefined, 1)];
    expect(orderGroups(groups).map(g => g.language)).toEqual(['fr', 'it', undefined]);
  });
});

describe('leadLanguagesSettled', () => {
  const group = (language: string | undefined, n: number): LanguageGroup => ({
    language,
    coverIds: Array.from({ length: n }, (_, i) => `${language ?? 'x'}-${i}`),
  });

  it('waits until an English group is there, so the row does not shift later', () => {
    expect(leadLanguagesSettled([group('tr', 4)], false)).toBe(false);
    expect(leadLanguagesSettled([group('tr', 4), group('en', 1)], false)).toBe(true);
  });

  it('waits for the searched language instead, wherever it sits', () => {
    const loaded = [group('en', 12)];
    expect(leadLanguagesSettled(loaded, false, 'de')).toBe(false);
    expect(leadLanguagesSettled([...loaded, group('de', 1)], false, 'de')).toBe(true);
    // No filter, or the "all" option, keeps the English rule.
    expect(leadLanguagesSettled(loaded, false, '')).toBe(true);
    expect(leadLanguagesSettled(loaded, false, 'all')).toBe(true);
  });

  it('gives up waiting once every page is loaded', () => {
    expect(leadLanguagesSettled([group('tr', 4)], true)).toBe(true);
    expect(leadLanguagesSettled([], true)).toBe(true);
    // A language the work does not have must not hold the scene for ever.
    expect(leadLanguagesSettled([group('en', 12)], true, 'ja')).toBe(true);
  });
});

describe('coverForId', () => {
  const first = cover('ol:1', ['ol:A']);
  const folded = { ...cover('ol:2', ['ol:B']), similarIds: ['ol:9'] };
  const wall = { covers: [first, folded], coversById: new Map([[first.id, first], [folded.id, folded]]) };

  it('picks nothing when the reader has picked nothing (ROADMAP 1.1)', () => {
    /*
      The point of the item: no fallback to the first cover. It used to show
      an edition nobody chose and spent a Google request on it. If this test
      fails because a fallback came back, read the comment on coverForId.
    */
    expect(coverForId(wall, null)).toBeNull();
    expect(coverForId(wall, '')).toBeNull();
  });

  it('finds the cover a shared address names', () => {
    expect(coverForId(wall, 'ol:1')).toBe(first);
  });

  it('resolves a folded duplicate to the cover it was folded into', () => {
    expect(coverForId(wall, 'ol:9')).toBe(folded);
  });

  it('answers null for an id the wall does not know, not the first cover', () => {
    expect(coverForId(wall, 'ol:404')).toBeNull();
  });
});
