/** Unsaved edits on /curate (lib/curate/pending.ts). */
import { describe, expect, it } from 'vitest';
import { NOTHING_PENDING, hasPending, moveTo, pendingOps, pendingWorks, type Pending } from '../curate/pending';

const w = (id: string, coverId = `ol:${id.length}`) => ({ id, title: `T ${id}`, author: 'A', coverId });
const wall = [w('A'), w('B'), w('C'), w('D')];

describe('pending edits', () => {
  it('shows removals, new covers, added books and the order before anything is saved', () => {
    const p: Pending = { removed: ['B'], picks: { C: w('C', 'ol:9'), E: w('E') }, order: ['E', 'A', 'C', 'D'] };
    const shown = pendingWorks(wall, p);
    expect(shown.map(x => x.id)).toEqual(['E', 'A', 'C', 'D']);
    expect(shown.find(x => x.id === 'C')?.coverId).toBe('ol:9');
    expect(hasPending(p)).toBe(true);
    expect(hasPending(NOTHING_PENDING)).toBe(false);
  });

  it('moves a cover to the front, or anywhere', () => {
    expect(moveTo(['A', 'B', 'C', 'D'], 'D', 0)).toEqual(['D', 'A', 'B', 'C']);
    expect(moveTo(['A', 'B', 'C', 'D'], 'A', 2)).toEqual(['B', 'C', 'A', 'D']);
    expect(moveTo(['A', 'B'], 'A', 99)).toEqual(['B', 'A']);
  });

  it('saves as steps the server applies one by one: text, removals, covers, then the whole order', () => {
    const p: Pending = { title: 'New', removed: ['B'], picks: { E: w('E') }, order: null };
    const ids = pendingWorks(wall, p).map(x => x.id);
    expect(pendingOps(p, ids)).toEqual([
      { op: 'meta', title: 'New' },
      { op: 'remove', id: 'B' },
      { op: 'pick', id: 'E', title: 'T E', author: 'A', coverId: 'ol:1' },
      { op: 'order', ids: ['A', 'C', 'D', 'E'] },
    ]);
    expect(pendingOps({ ...NOTHING_PENDING, intro: 'x' }, [])).toEqual([{ op: 'meta', intro: 'x' }]);
  });
});
