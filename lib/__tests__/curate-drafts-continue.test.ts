import { describe, expect, it } from 'vitest';
import { draftToContinue, newDraft, sameContent } from '../curate/drafts';
import type { CollectionRecord } from '../collections';

const live: CollectionRecord = {
  slug: 'hugo',
  title: 'Hugo Award',
  kind: 'authors',
  intro: 'Winners.',
  published: true,
  authors: [{ name: 'A', keys: ['OL1A'] }],
  works: [{ id: 'OL1W', title: 'One', author: 'A', coverId: 'ol:1' }, { id: 'OL2W', title: 'Two', author: 'A', coverId: 'ol:2' }],
};

describe('draftToContinue', () => {
  it('opens a draft that still holds the live version, the newest of them', () => {
    const older = newDraft({}, new Date('2026-10-01'), live);
    const newer = newDraft({}, new Date('2026-10-03'), live);
    expect(draftToContinue([older, newer], live)?.id).toBe(newer.id);
  });

  it('opens none when the drafts differ from the live version', () => {
    const d = newDraft({}, new Date('2026-10-01'), live);
    const moved = { ...live, works: [...live.works].reverse() };
    expect(sameContent(d, moved)).toBe(false);
    expect(draftToContinue([d], moved)).toBeNull();
    expect(draftToContinue([{ ...d, deleted: true }], live)).toBeNull();
  });
});
