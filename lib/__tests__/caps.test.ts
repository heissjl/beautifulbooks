/** The caps on drafts and suggestions (ROADMAP 2.20), against the memory stores. */
import { describe, expect, it } from 'vitest';
import { draftsFull, memoryDraftStore, type Draft } from '../curate/drafts';
import { DRAFTS_CAP, SUGGESTIONS_CAP } from '../fill';
import { memorySuggestStore, suggestionsFull, type Suggestion } from '../suggest/store';

const draft = (i: number, deleted = false): Draft =>
  ({ id: `draft${String(i).padStart(4, '0')}`, updatedAt: `2026-10-17T00:00:${String(i % 60).padStart(2, '0')}Z`, deleted } as unknown as Draft);

describe('caps (2.20)', () => {
  it('refuses the 201st live draft, and a deleted draft frees its place', async () => {
    const store = memoryDraftStore();
    for (let i = 0; i < DRAFTS_CAP - 1; i++) {
      await store.put(draft(i));
      await store.register(`draft${String(i).padStart(4, '0')}`);
    }
    expect(await draftsFull(store)).toBe(false);
    await store.put(draft(DRAFTS_CAP - 1));
    await store.register(`draft${String(DRAFTS_CAP - 1).padStart(4, '0')}`);
    expect(await draftsFull(store)).toBe(true);
    await store.put(draft(3, true));
    expect(await draftsFull(store)).toBe(false);
  });

  it('refuses the 1001st suggestion; decided ones count, the list is never pruned', async () => {
    const store = memorySuggestStore();
    const s = (i: number): Suggestion => ({ id: `s${i}`, on: '2026-10-17', collection: null, newCollection: 'x', work: { id: 'OL1W', title: 't', author: 'a', coverId: '1' } });
    for (let i = 0; i < SUGGESTIONS_CAP - 1; i++) await store.add(s(i));
    expect(await suggestionsFull(store)).toBe(false);
    await store.add(s(SUGGESTIONS_CAP));
    await store.decide('s0', 'taken');
    expect(await store.count()).toBe(SUGGESTIONS_CAP);
    expect(await suggestionsFull(store)).toBe(true);
  });
});
