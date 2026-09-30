import { describe, expect, it } from 'vitest';
import { draftDelta } from '../draftdelta';

const w = (id: string, coverId = `ol:${id.length}`) => ({ id, title: `T ${id}`, author: 'A', coverId });

describe('draftDelta', () => {
  it('is empty when draft and file agree', () => {
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL1W'), w('OL2W')] }, { title: 'X', intro: '', works: [w('OL1W'), w('OL2W')] });
    expect(r.ops).toEqual([]);
    expect(r.summary).toBe('already equal');
  });
  it('lists the order step when the orders differ, but reports it as online-only (pushed only with --force)', () => {
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL1W'), w('OL2W')] }, { title: 'X', intro: '', works: [w('OL2W'), w('OL1W')] });
    expect(r.ops).toEqual([{ op: 'order', ids: ['OL2W|ol:4', 'OL1W|ol:4'] }]);
    expect(r.onlineOnly).toEqual(['the order of the works differs from the file']);
  });
  it('reports what only the online draft has, and still lists the steps', () => {
    const r = draftDelta(
      { title: 'Old, title', intro: '', works: [w('OL1W', 'ol:1'), w('OL9W')] },
      { title: 'New — title', intro: 'Hi', works: [w('OL1W', 'ol:2'), w('OL3W')] },
    );
    expect(r.ops[0]).toEqual({ op: 'meta', title: 'New — title', intro: 'Hi' });
    expect(r.ops).toContainEqual({ op: 'remove', id: 'OL9W' });
    expect(r.ops).toContainEqual({ op: 'pick', id: 'OL1W', title: 'T OL1W', author: 'A', coverId: 'ol:2', was: 'ol:1' });
    expect(r.onlineOnly).toHaveLength(2);
  });

  it('sends a renamed work even when its cover is unchanged', () => {
    const r = draftDelta({ title: 'X', intro: '', works: [{ id: 'OL1W', title: 'Calligrams', author: 'A', coverId: 'ol:1' }] }, { title: 'X', intro: '', works: [{ id: 'OL1W', title: 'Calligrammes', author: 'A', coverId: 'ol:1' }] });
    expect(r.ops).toEqual([{ op: 'pick', id: 'OL1W', title: 'Calligrammes', author: 'A', coverId: 'ol:1' }]);
    expect(r.onlineOnly).toEqual([]);
    expect(r.summary).toBe('1 renamed');
  });

  it('leaves out site-served images, but sends a second cover of the same work as a further tile', () => {
    const file = [w('OL1W'), w('OL2W', 'local:vol-02'), { ...w('OL1W'), coverId: 'ol:9' }];
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL1W')] }, { title: 'X', intro: '', works: file });
    expect(r.ops).toEqual([{ op: 'pick', id: 'OL1W', title: 'T OL1W', author: 'A', coverId: 'ol:9', again: true }]);
    expect(r.summary).toBe('1 added');
    expect(r.onlineOnly).toEqual([]);
  });

  it('puts both Lone Star covers next to each other in a draft that held one', () => {
    const file = [w('OL1W', 'ol:1'), w('OL2W', 'ol:21'), w('OL2W', 'ol:22'), w('OL3W', 'ol:3')];
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL1W', 'ol:1'), w('OL2W', 'ol:21'), w('OL3W', 'ol:3')] }, { title: 'X', intro: '', works: file });
    expect(r.ops).toEqual([
      { op: 'pick', id: 'OL2W', title: 'T OL2W', author: 'A', coverId: 'ol:22', again: true },
      { op: 'order', ids: ['OL1W|ol:1', 'OL2W|ol:21', 'OL2W|ol:22', 'OL3W|ol:3'] },
    ]);
    expect(r.onlineOnly).toEqual([]);
  });

  it('reports a further cover that only the online draft shows', () => {
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL1W', 'ol:1'), w('OL1W', 'ol:2')] }, { title: 'X', intro: '', works: [w('OL1W', 'ol:1')] });
    expect(r.ops).toEqual([{ op: 'remove', id: 'OL1W', coverId: 'ol:2' }]);
    expect(r.onlineOnly).toEqual(['T OL1W: online also ol:2']);
  });

  it('does not report the file\'s own site-image picks in a draft copied from the deployed file', () => {
    const file = [w('OL1W'), w('OL2W', 'local:vol-02')];
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL1W'), w('OL2W', 'local:vol-02')] }, { title: 'X', intro: '', works: file });
    expect(r.onlineOnly).toEqual([]);
  });

  it('reads a draft copied from a wall of sets by the first cover of each work, as the file does', () => {
    const file = [w('OL1W', 'ol:1'), w('OL2W', 'ol:2'), w('OL1W', 'ol:3'), w('OL2W', 'ol:4')];
    const r = draftDelta({ title: 'X', intro: '', works: file }, { title: 'X', intro: '', works: file });
    expect(r.summary).toBe('already equal');
    expect(r.onlineOnly).toEqual([]);
  });

  it('stops on an order changed online, so a push never undoes it', () => {
    const r = draftDelta({ title: 'X', intro: '', works: [w('OL2W'), w('OL1W')] }, { title: 'X', intro: '', works: [w('OL1W'), w('OL2W')] });
    expect(r.onlineOnly).toEqual(['the order of the works differs from the file']);
  });
});
