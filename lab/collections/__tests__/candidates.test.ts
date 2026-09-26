import { describe, expect, it } from 'vitest';
import type { CollectionRecord } from '../../../lib/collections';
import { draftFromCandidates, upsertCollection, type CandidateRow } from '../candidates';

const row = (over: Partial<CandidateRow>): CandidateRow => ({
  order: 1, id: 'OL1W', title: 'A', author: 'X', coverId: 'ol:1', edition: '/books/OL1M', status: 'found', ...over,
});
const spec = { slug: 'sf-ru', title: 'SF, Russian covers', from: 'openlibrary:rus', addedAt: '2026-09-26' };

describe('draftFromCandidates', () => {
  it('keeps only found covers, in list order, as an unpublished catalogue series without publishers', () => {
    const record = draftFromCandidates([
      row({ order: 3, id: 'OL3W', coverId: 'ol:3' }),
      row({ order: 1, id: 'OL1W', coverId: 'ol:1' }),
      row({ order: 2, id: 'OL2W', coverId: null, edition: null, status: 'none' }),
      row({ order: 4, id: 'OL4W', coverId: null, edition: null, status: 'failed' }),
    ], spec);
    expect(record).toMatchObject({ slug: 'sf-ru', kind: 'series', published: false, coverSource: 'catalogue', publishers: [], intro: '' });
    expect(record.works.map(w => w.id)).toEqual(['OL1W', 'OL3W']);
    expect(record.works[0]).toMatchObject({ coverId: 'ol:1', from: 'openlibrary:rus:OL1M', addedAt: '2026-09-26' });
  });

  it('writes the language into from and the ISBN as coverIsbn when the row has them', () => {
    const [pick] = draftFromCandidates([row({ language: 'fre', isbn: '9782207500996' })], { ...spec, from: 'openlibrary' }).works;
    expect(pick).toMatchObject({ from: 'openlibrary:fre:OL1M', coverIsbn: '9782207500996' });
    expect(draftFromCandidates([row({})], spec).works[0]).not.toHaveProperty('coverIsbn');
  });

  it('takes a work listed twice once', () => {
    expect(draftFromCandidates([row({ order: 1 }), row({ order: 2 })], spec).works).toHaveLength(1);
  });

  it('keeps an existing intro but never the published flag', () => {
    const existing = { ...draftFromCandidates([], spec), intro: 'Hello', published: true };
    expect(draftFromCandidates([], spec, existing)).toMatchObject({ intro: 'Hello', published: false });
  });
});

describe('draftFromCandidates over an existing draft', () => {
  it('keeps the credits switch, and a credit only while the image is the same', () => {
    const existing: CollectionRecord = {
      ...draftFromCandidates([], spec),
      coverCredits: 'isfdb',
      works: [
        { id: 'OL1W', title: 'A', author: 'X', coverId: 'ol:1', coverArtists: ['Chris Moore'], isfdbRecord: '1' },
        { id: 'OL2W', title: 'B', author: 'X', coverId: 'ol:2', coverArtists: ['Someone'] },
      ],
    };
    const next = draftFromCandidates([row({ id: 'OL1W', coverId: 'ol:1' }), row({ order: 2, id: 'OL2W', coverId: 'ol:9' })], spec, existing);
    expect(next.coverCredits).toBe('isfdb');
    expect(next.works[0]).toMatchObject({ coverArtists: ['Chris Moore'], isfdbRecord: '1' });
    expect(next.works[1]).not.toHaveProperty('coverArtists');
  });
});

describe('upsertCollection', () => {
  const other = { slug: 'other', title: 'O', kind: 'authors', intro: '', published: true, works: [] } as CollectionRecord;
  it('appends a new slug and leaves the others alone', () => {
    const next = upsertCollection([other], draftFromCandidates([], spec));
    expect(next.map(c => c.slug)).toEqual(['other', 'sf-ru']);
    expect(next[0]).toBe(other);
  });
  it('replaces the record of the same slug in place', () => {
    const first = draftFromCandidates([], spec);
    const next = upsertCollection([first, other], draftFromCandidates([row({})], spec));
    expect(next.map(c => c.slug)).toEqual(['sf-ru', 'other']);
    expect(next[0].works).toHaveLength(1);
  });
});
