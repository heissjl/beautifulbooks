import { describe, expect, it } from 'vitest';
import { draftDelta } from '../draftdelta';

const w = (id: string, coverId = `ol:${id.length}`) => ({ id, title: `T ${id}`, author: 'A', coverId });

describe('draftDelta', () => {
  it('is empty when draft and file agree', () => {
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL1W'), w('OL2W')] }, { title: 'X', intro: '', works: [w('OL1W'), w('OL2W')] });
    expect(r.ops).toEqual([]);
    expect(r.summary).toBe('already equal');
  });
  it('sends the order when only the order changed, and nothing counts as online-only', () => {
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL1W'), w('OL2W')] }, { title: 'X', intro: '', works: [w('OL2W'), w('OL1W')] });
    expect(r.ops).toEqual([{ op: 'order', ids: ['OL2W', 'OL1W'] }]);
    expect(r.onlineOnly).toEqual([]);
  });
  it('reports what only the online draft has, and still lists the steps', () => {
    const r = draftDelta(
      { title: 'Old, title', intro: '', works: [w('OL1W', 'ol:1'), w('OL9W')] },
      { title: 'New — title', intro: 'Hi', works: [w('OL1W', 'ol:2'), w('OL3W')] },
    );
    expect(r.ops[0]).toEqual({ op: 'meta', title: 'New — title', intro: 'Hi' });
    expect(r.ops).toContainEqual({ op: 'remove', id: 'OL9W' });
    expect(r.ops).toContainEqual({ op: 'pick', id: 'OL1W', title: 'T OL1W', author: 'A', coverId: 'ol:2' });
    expect(r.onlineOnly).toHaveLength(2);
  });

  it('sends a renamed work even when its cover is unchanged', () => {
    const r = draftDelta({ title: 'X', intro: '', works: [{ id: 'OL1W', title: 'Calligrams', author: 'A', coverId: 'ol:1' }] }, { title: 'X', intro: '', works: [{ id: 'OL1W', title: 'Calligrammes', author: 'A', coverId: 'ol:1' }] });
    expect(r.ops).toEqual([{ op: 'pick', id: 'OL1W', title: 'Calligrammes', author: 'A', coverId: 'ol:1' }]);
    expect(r.onlineOnly).toEqual([]);
    expect(r.summary).toBe('1 renamed');
  });

  it('leaves out what a draft cannot hold: site-served images and a second cover of the same work', () => {
    const file = [w('OL1W'), w('OL2W', 'local:vol-02'), { ...w('OL1W'), coverId: 'ol:9' }];
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL1W')] }, { title: 'X', intro: '', works: file });
    expect(r.summary).toBe('already equal');
    expect(r.onlineOnly).toEqual([]);
  });

  it('does not report the file\'s own site-image picks in a draft copied from the deployed file', () => {
    const file = [w('OL1W'), w('OL2W', 'local:vol-02')];
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL1W'), w('OL2W', 'local:vol-02')] }, { title: 'X', intro: '', works: file });
    expect(r.onlineOnly).toEqual([]);
  });
});
