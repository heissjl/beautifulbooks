/** Friends' collection drafts (ROADMAP 5.10b, SPEC F8.5, lib/curate/drafts.ts). */
import { describe, expect, it } from 'vitest';
import type { CollectionRecord } from '../collections';
import { applyOp, listDrafts, memoryDraftStore, newDraft, toRecord } from '../curate/drafts';

const now = new Date('2026-09-24T20:00:00Z');
const later = new Date('2026-09-24T21:00:00Z');

const published: CollectionRecord = {
  slug: 'women-writers',
  title: 'Women writers',
  kind: 'authors',
  intro: 'Intro.',
  published: true,
  authors: [{ name: 'Mary Shelley', keys: ['OL25342A'] }],
  works: [{ id: 'OL450063W', title: 'Frankenstein', author: 'Mary Shelley', coverId: 'ol:13498737' }],
};

describe('newDraft', () => {
  it('starts empty, as an unpublished collection with an address from the title', () => {
    const d = newDraft({ title: '  Penguin Modern Classics ', kind: 'series', by: 'Caitlin' }, now);
    expect(d).toMatchObject({ slug: 'penguin-modern-classics', kind: 'series', publishers: [], works: [], by: 'Caitlin', published: false, createdOn: '2026-09-24' });
    expect(d.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it('copies a published collection without sharing its arrays', () => {
    const d = newDraft({}, now, published);
    expect(d).toMatchObject({ slug: 'women-writers', basedOn: 'women-writers', title: 'Women writers' });
    d.authors?.[0].keys.push('OL1A');
    d.works.pop();
    expect(published.authors?.[0].keys).toEqual(['OL25342A']);
    expect(published.works).toHaveLength(1);
  });

  it('refuses a draft without a title', () => {
    expect(() => newDraft({ title: ' ' }, now)).toThrow(/title/);
  });
});

describe('applyOp', () => {
  const base = () => newDraft({ title: 'Women writers 2', by: 'Caitlin' }, now);

  it('lets a friend add an author to their own draft, and then her book', () => {
    let d = applyOp(base(), { op: 'addAuthor', name: 'Virginia Woolf', key: '/authors/OL19400A' }, later);
    d = applyOp(d, { op: 'pick', id: 'OL39349W', title: 'Mrs Dalloway', author: 'Virginia Woolf', coverId: 'ol:1', firstPublished: 1925 }, later);
    expect(d.authors).toEqual([{ name: 'Virginia Woolf', keys: ['OL19400A'] }]);
    expect(d.works).toEqual([{ id: 'OL39349W', title: 'Mrs Dalloway', author: 'Virginia Woolf', coverId: 'ol:1', firstPublished: 1925, addedAt: '2026-09-24' }]);
    expect(d.updatedAt).toBe(later.toISOString());
  });

  it('still refuses a book by someone not on the draft’s list', () => {
    expect(() => applyOp(base(), { op: 'pick', id: 'OL1W', title: 'T', author: 'Nobody', coverId: 'ol:1' })).toThrow(/list of authors/);
  });

  it('checks what the browser sends', () => {
    expect(() => applyOp(base(), { op: 'addAuthor', name: 'X', key: 'javascript:1' })).toThrow(/Open Library/);
    expect(() => applyOp(base(), { op: 'pick', id: 'x', title: 'T', author: 'A', coverId: 'ol:1' })).toThrow(/book and a cover/);
    expect(() => applyOp(base(), { op: 'addPublisher', name: 'Penguin' })).toThrow(/by authors/);
    expect(() => applyOp(base(), { op: 'meta', title: '' })).toThrow(/title/);
    expect(() => applyOp(base(), { op: 'drop tables' })).toThrow(/Unknown/);
  });

  it('keeps the address of a draft based on a published collection when renamed', () => {
    const d = applyOp(newDraft({}, now, published), { op: 'meta', title: 'Women who wrote' });
    expect(d.slug).toBe('women-writers');
    expect(applyOp(base(), { op: 'meta', title: 'Women who wrote' }).slug).toBe('women-who-wrote');
  });

  it('clips long text and drops an emptied name', () => {
    const d = applyOp(base(), { op: 'meta', intro: 'x'.repeat(5000), by: '' });
    expect(d.intro).toHaveLength(1200);
    expect(d.by).toBeUndefined();
  });
});

describe('toRecord', () => {
  it('writes only the collection fields, as a draft', () => {
    const r = toRecord({ ...newDraft({}, now, published), published: true });
    expect(Object.keys(r).sort()).toEqual(['authors', 'intro', 'kind', 'published', 'slug', 'title', 'works']);
    expect(r.published).toBe(false);
  });
});

describe('listDrafts', () => {
  it('leaves out deleted drafts and puts the newest change first', async () => {
    const store = memoryDraftStore();
    const a = newDraft({ title: 'A' }, now);
    const b = newDraft({ title: 'B' }, later);
    const c = { ...newDraft({ title: 'C' }, later), deleted: true };
    for (const d of [a, b, c]) { await store.register(d.id); await store.put(d); }
    expect((await listDrafts(store)).map(d => d.title)).toEqual(['B', 'A']);
  });
});
