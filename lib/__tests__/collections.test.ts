/** Thematic collections (ROADMAP 5.10, SPEC F8, lib/collections.ts). */
import { describe, expect, it } from 'vitest';
import collectionsFile from '@/data/collections.json';
import { applyContent, applyOrder, applyOverrides, authorsShown, coverLine, isCollectionSlug, nextOverrides, parseCollections, type CollectionRecord } from '../collections';

const record = (over: Partial<CollectionRecord> = {}): CollectionRecord => ({
  slug: 'women-writers',
  title: 'Women writers',
  kind: 'authors',
  intro: 'Intro.',
  published: true,
  authors: [{ name: 'Mary Shelley', keys: ['OL25342A'] }, { name: 'Ingeborg Bachmann', keys: ['OL27744A'] }],
  works: [
    { id: 'OL472971W', title: 'Malina', author: 'Ingeborg Bachmann', coverId: 'ol:12273691' },
    { id: 'OL450063W', title: 'Frankenstein', author: 'Mary Shelley', coverId: 'ol:13498737' },
  ],
  ...over,
});

describe('parseCollections', () => {
  it('keeps the file order and turns cover ids into numbers', () => {
    const [c] = parseCollections([record()], { includeDrafts: false });
    expect(c.works.map(w => w.id)).toEqual(['OL472971W', 'OL450063W']);
    expect(c.works[0].coverId).toBe(12273691);
    expect(c.scope).toEqual(['Mary Shelley', 'Ingeborg Bachmann']);
  });

  it('hides drafts unless asked for them', () => {
    const draft = record({ published: false });
    expect(parseCollections([draft], { includeDrafts: false })).toEqual([]);
    expect(parseCollections([draft], { includeDrafts: true })).toHaveLength(1);
  });

  it('leaves out a pick without a usable cover rather than showing a blank tile', () => {
    const [c] = parseCollections(
      [record({ works: [
        { id: 'OL1W', title: 'A', author: 'Mary Shelley', coverId: '' },
        { id: 'OL2W', title: 'B', author: 'Mary Shelley', coverId: 'ol:0' },
        { id: 'OL3W', title: 'C', author: 'Mary Shelley', coverId: 'gb:abc' },
        { id: 'OL4W', title: 'D', author: 'Mary Shelley', coverId: 'ol:42' },
      ] })],
      { includeDrafts: false },
    );
    expect(c.works.map(w => w.id)).toEqual(['OL4W']);
  });

  it('shows a work listed twice once, in its first place', () => {
    const w = record().works;
    const [c] = parseCollections([record({ works: [w[0], w[1], { ...w[0], coverId: 'ol:1' }] })], { includeDrafts: false });
    expect(c.works.map(x => x.coverId)).toEqual([12273691, 13498737]);
  });

  it('skips a bad or repeated slug', () => {
    const out = parseCollections(
      [record({ slug: 'Women Writers' }), record(), record({ title: 'again' })],
      { includeDrafts: false },
    );
    expect(out.map(c => c.title)).toEqual(['Women writers']);
  });

  it('takes a series scope from its publishers', () => {
    const [c] = parseCollections(
      [record({ slug: 'penguin-classics', kind: 'series', authors: undefined, publishers: ['Penguin Classics'], works: [] })],
      { includeDrafts: false },
    );
    expect(c.scope).toEqual(['Penguin Classics']);
  });
});

describe('authorsShown', () => {
  it('names only authors with a work on the wall, in wall order', () => {
    const [c] = parseCollections([record()], { includeDrafts: false });
    expect(authorsShown(c)).toEqual(['Ingeborg Bachmann', 'Mary Shelley']);
  });
});

describe('isCollectionSlug', () => {
  it('accepts lowercase words joined by hyphens only', () => {
    expect(isCollectionSlug('women-writers')).toBe(true);
    expect(isCollectionSlug('penguin-classics-1946')).toBe(true);
    expect(isCollectionSlug('Women')).toBe(false);
    expect(isCollectionSlug('-x')).toBe(false);
    expect(isCollectionSlug('a--b')).toBe(false);
    expect(isCollectionSlug('')).toBe(false);
  });
});

/*
  The boundary Julian set on 2026-09-24: „füge keine weiteren dazu ohne mein
  ok". An author collection lists its authors, and every work on its wall must
  be by one of them — so a work cannot slip in by someone who was never
  agreed, whether through the tool or a hand edit of the file.
*/
describe('data/collections.json', () => {
  const records = (collectionsFile as { collections: CollectionRecord[] }).collections;

  it('parses every record, drafts included', () => {
    expect(parseCollections(records, { includeDrafts: true })).toHaveLength(records.length);
  });

  // A note to Julian in a draft's intro (2026-09-25) must never go live with it.
  it('publishes no intro that still carries a note to Julian', () => {
    for (const r of records.filter(x => x.published)) expect(r.intro, r.slug).not.toMatch(/NOTE FOR JULIAN/);
  });

  it('has only works by the listed authors in an author collection', () => {
    for (const r of records.filter(x => x.kind === 'authors')) {
      const names = (r.authors ?? []).map(a => a.name);
      for (const w of r.works) expect(names, `${r.slug}: ${w.title}`).toContain(w.author.normalize('NFC'));
    }
  });

  // ISFDB sends lost letters as U+FFFD; read as ISO-8859-1 they became „Jï¿½rgen" on the wall (2026-09-26).
  it('shows no cover artist with a destroyed letter', () => {
    for (const r of records) {
      for (const w of r.works) {
        for (const a of w.coverArtists ?? []) expect(a, `${r.slug}: ${w.title}`).not.toMatch(/\uFFFD|ï¿½|Ã./);
      }
    }
  });
});

describe('coverLine', () => {
  it('claims a choice by hand only where one was made', () => {
    expect(coverLine('authors')).toContain('chosen by hand');
    expect(coverLine('series')).not.toContain('hand');
    expect(coverLine('authors', 'catalogue')).toContain('not all of them chosen by hand');
  });
});

describe('publishing from /curate (5.10g)', () => {
  const draft = record({ slug: 'edition-suhrkamp', published: false });
  const live = record({ slug: 'sf-masterworks', published: true });

  it('lets a switch win over the file', () => {
    const [a, b] = applyOverrides([draft, live], { 'edition-suhrkamp': true, 'sf-masterworks': false });
    expect(a.published).toBe(true);
    expect(b.published).toBe(false);
    expect(applyOverrides([draft], {})[0].published).toBe(false);
  });

  it('keeps only differences from the file, so file and site cannot drift apart unnoticed', () => {
    const on = nextOverrides({}, draft, true);
    expect(on).toEqual({ 'edition-suhrkamp': true });
    expect(nextOverrides(on, draft, false)).toEqual({});
    expect(nextOverrides({}, live, true)).toEqual({});
  });
});

describe('publishing a draft from /curate (5.10g)', () => {
  it('replaces the collection at that address, or adds a new one', () => {
    const file = [record({ slug: 'tiptree-award', published: false }), record({ slug: 'sf-masterworks' })];
    const draft = record({ slug: 'tiptree-award', published: true, title: 'The Otherwise Award' });
    const fresh = record({ slug: 'penguin-modern', published: true, title: 'Penguin Modern' });
    const out = applyContent(file, { 'tiptree-award': draft, 'penguin-modern': fresh });
    expect(out.map(r => [r.slug, r.title, r.published])).toEqual([
      ['tiptree-award', 'The Otherwise Award', true],
      ['sf-masterworks', 'Women writers', true],
      ['penguin-modern', 'Penguin Modern', true],
    ]);
  });
});

describe('arranging the collections (5.10h)', () => {
  it('puts the named slugs first, in that order, and keeps the rest after them in file order', () => {
    const recs = ['a', 'b', 'c', 'd'].map(slug => record({ slug }));
    expect(applyOrder(recs, ['c', 'a']).map(r => r.slug)).toEqual(['c', 'a', 'b', 'd']);
    expect(applyOrder(recs, []).map(r => r.slug)).toEqual(['a', 'b', 'c', 'd']);
    expect(applyOrder(recs, ['x', 'd']).map(r => r.slug)).toEqual(['d', 'a', 'b', 'c']);
  });
});

