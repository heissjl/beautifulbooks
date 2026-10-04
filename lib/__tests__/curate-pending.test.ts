/** Unsaved edits on /curate (lib/curate/pending.ts). */
import { describe, expect, it } from 'vitest';
import { NOTHING_PENDING, hasPending, moveTo, pendingOps, pendingWorks, pickKey, removeTile, type Pending } from '../curate/pending';

const w = (id: string, coverId = `ol:${id.length}`) => ({ id, title: `T ${id}`, author: 'A', coverId });
const wall = [w('A'), w('B'), w('C'), w('D')];
const k = (id: string, coverId = `ol:${id.length}`) => `${id}|${coverId}`;
const keys = (tiles: Array<{ id: string; coverId: string }>) => tiles.map(pickKey);

describe('pending edits', () => {
  it('shows removals, new covers, added books and the order before anything is saved', () => {
    const p: Pending = { removed: [k('B')], picks: { [k('C')]: w('C', 'ol:9'), [k('E')]: w('E') }, order: [k('E'), k('A'), k('C', 'ol:9'), k('D')] };
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
    const p: Pending = { title: 'New', removed: [k('B')], picks: { [k('E')]: w('E') }, order: null };
    expect(pendingOps(p, keys(pendingWorks(wall, p)))).toEqual([
      { op: 'meta', title: 'New' },
      { op: 'remove', id: 'B', coverId: 'ol:1' },
      { op: 'pick', id: 'E', title: 'T E', author: 'A', coverId: 'ol:1' },
      { op: 'order', ids: [k('A'), k('C'), k('D'), k('E')] },
    ]);
    expect(pendingOps({ ...NOTHING_PENDING, intro: 'x' }, [])).toEqual([{ op: 'meta', intro: 'x' }]);
  });

  it('says which tile a new cover replaces, so a work shown twice keeps its other cover', () => {
    const twice = [w('A', 'ol:1'), w('A', 'ol:2'), w('B')];
    const p: Pending = { removed: [], picks: { [k('A', 'ol:2')]: w('A', 'ol:7') }, order: null };
    expect(pendingWorks(twice, p).map(x => x.coverId)).toEqual(['ol:1', 'ol:7', 'ol:1']);
    expect(pendingOps(p, keys(pendingWorks(twice, p)))[0]).toEqual({ op: 'pick', id: 'A', title: 'T A', author: 'A', coverId: 'ol:7', was: 'ol:2' });
  });

  it('adds a work a second time with another cover, and takes one of two tiles off alone', () => {
    const again: Pending = { removed: [], picks: { [k('A', 'ol:5')]: { ...w('A', 'ol:5'), again: true } }, order: null };
    expect(pendingWorks(wall, again).filter(x => x.id === 'A').map(x => x.coverId)).toEqual(['ol:1', 'ol:5']);
    expect(pendingOps(again, keys(pendingWorks(wall, again)))[0]).toMatchObject({ op: 'pick', id: 'A', coverId: 'ol:5', again: true });

    const twice = [w('A', 'ol:1'), w('A', 'ol:2')];
    const saved = new Set(keys(twice));
    const off = removeTile(NOTHING_PENDING, saved, k('A', 'ol:2'));
    expect(off.removed).toEqual([k('A', 'ol:2')]);
    expect(pendingWorks(twice, off).map(x => x.coverId)).toEqual(['ol:1']);
    expect(pendingOps(off, keys(pendingWorks(twice, off)))).toEqual([{ op: 'remove', id: 'A', coverId: 'ol:2' }]);

    const changedThenOff = removeTile({ removed: [], picks: { [k('A', 'ol:2')]: w('A', 'ol:9') }, order: null }, saved, k('A', 'ol:9'));
    expect(changedThenOff).toEqual({ removed: [k('A', 'ol:2')], picks: {}, order: null });
    expect(removeTile(again, new Set(keys(wall)), k('A', 'ol:5'))).toEqual(NOTHING_PENDING);
  });
});
