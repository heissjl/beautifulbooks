import { describe, expect, it } from 'vitest';
import { addRequests, defaultTitle, editHref, OPS_PER_REQUEST, readEditState, standingOf } from '../walls/edit';
import type { Tile } from '../walls/model';

const tile = (coverId: string, workId = `OL${coverId}W`): Tile => ({ workId, coverId, title: `T${coverId}`, printings: [] });

describe('the editor address (5.13m)', () => {
  it('leaves defaults out and keeps search and book', () => {
    expect(editHref('abcdefghij')).toBe('/c/abcdefghij/edit');
    expect(editHref('abcdefghij', { mode: 'add', add: 'search' })).toBe('/c/abcdefghij/edit');
    expect(editHref('abcdefghij', { add: 'photo' })).toBe('/c/abcdefghij/edit?add=photo');
    expect(editHref('abcdefghij', { q: 'rebecca du maurier', work: 'OL45W' })).toBe('/c/abcdefghij/edit?q=rebecca+du+maurier&work=OL45W');
    expect(editHref('abcdefghij', { mode: 'arrange' })).toBe('/c/abcdefghij/edit?mode=arrange');
  });

  it('reads it back, and anything unknown as the default', () => {
    const read = (qs: string) => {
      const p = new URLSearchParams(qs);
      return readEditState((k) => p.get(k));
    };
    expect(read('')).toEqual({ mode: 'add', add: 'search' });
    expect(read('mode=arrange&add=ideas')).toEqual({ mode: 'arrange', add: 'ideas' });
    expect(read('mode=x&add=../&work=nope&q=%20%20')).toEqual({ mode: 'add', add: 'search' });
    expect(read('q=rebecca&work=OL45W')).toEqual({ mode: 'add', add: 'search', q: 'rebecca', work: 'OL45W' });
  });
});

describe('a proposed cover against the open collection', () => {
  const wall = { tiles: [tile('1', 'OL9W')] };
  it('tells this cover, the same book with another cover, and a new one apart', () => {
    expect(standingOf(tile('1', 'OL9W'), wall)).toBe('in');
    expect(standingOf(tile('2', 'OL9W'), wall)).toBe('work');
    expect(standingOf(tile('3'), wall)).toBe('new');
    expect(standingOf(tile('3'), undefined)).toBe('new');
  });
});

describe('adding many covers at once', () => {
  it('skips covers already in and repeats, and cuts at what one request applies', () => {
    const many = Array.from({ length: 120 }, (_, i) => tile(String(i + 1)));
    const requests = addRequests([...many, tile('5')], { tiles: [tile('1'), tile('2')] });
    expect(requests.map((r) => r.length)).toEqual([OPS_PER_REQUEST, OPS_PER_REQUEST, 18]);
    const ids = requests.flat().map((op) => (op.op === 'add' ? op.tile.coverId : ''));
    expect(ids[0]).toBe('3');
    expect(new Set(ids).size).toBe(118);
  });

  it('asks nothing when nothing is new', () => {
    expect(addRequests([tile('1')], { tiles: [tile('1')] })).toEqual([]);
  });
});

it('names a new collection after the ones there are', () => {
  expect(defaultTitle([])).toBe('My collection');
  expect(defaultTitle([1, 2])).toBe('Collection 3');
});
