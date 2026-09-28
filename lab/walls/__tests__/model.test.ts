import { describe, expect, it } from 'vitest';
import {
  applyOp,
  hashVisitor,
  isOwner,
  isVisitorId,
  isWallId,
  MAX_TILES,
  newVisitorId,
  newWall,
  ownedBy,
  newWallId,
  shoppingList,
  toPublic,
  validTile,
  WallError,
  type Tile,
} from '../model';

const ME = newVisitorId(Buffer.alloc(16, 7));
const YOU = newVisitorId(Buffer.alloc(16, 8));
const tile = (coverId: string, extra: Partial<Tile> = {}): Tile => ({
  workId: 'OL468431W',
  coverId,
  title: 'The Great Gatsby',
  author: 'F. Scott Fitzgerald',
  printings: [{ isbn13: '9780743273565', publisher: 'Scribner', year: 2004 }],
  ...extra,
});
const wall = () => newWall('abcdefghij', ME, '  My   hallway ', '2026-09-28');

describe('ids and owners', () => {
  it('makes ids in the shapes it accepts', () => {
    expect(isWallId(newWallId())).toBe(true);
    expect(isVisitorId(newVisitorId())).toBe(true);
    expect(isWallId('ABCDEFGHIJ')).toBe(false);
    expect(isVisitorId('short')).toBe(false);
  });

  it('stores only the hash of the owner, and only the owner may change the wall', () => {
    const w = wall();
    expect(w.ownerHash).toBe(hashVisitor(ME));
    expect(JSON.stringify(w)).not.toContain(ME);
    expect(isOwner(w, ME)).toBe(true);
    expect(isOwner(w, YOU)).toBe(false);
    expect(isOwner(w, undefined)).toBe(false);
  });

  it('never tells a viewer whose wall it is', () => {
    expect(toPublic(wall())).not.toHaveProperty('ownerHash');
  });

  it('lists a visitor\'s own walls, newest change first', () => {
    const a = { ...wall(), id: 'aaaaaaaaaa', updatedAt: '2026-09-01' };
    const b = { ...wall(), id: 'bbbbbbbbbb', updatedAt: '2026-09-20' };
    const c = { ...newWall('cccccccccc', YOU, 'theirs', '2026-09-28') };
    expect(ownedBy([a, b, c], ME).map((w) => w.id)).toEqual(['bbbbbbbbbb', 'aaaaaaaaaa']);
    expect(ownedBy([a, b, c], 'nonsense')).toEqual([]);
  });
});

describe('operations', () => {
  it('cleans the title', () => {
    expect(wall().title).toBe('My hallway');
    expect(newWall('abcdefghij', ME, '   ', 'd').title).toBe('Untitled wall');
  });

  it('adds a cover once and keeps order', () => {
    let w = applyOp(wall(), { op: 'add', tile: tile('1') }, 't1');
    w = applyOp(w, { op: 'add', tile: tile('2') }, 't2');
    w = applyOp(w, { op: 'add', tile: tile('1') }, 't3');
    expect(w.tiles.map((t) => t.coverId)).toEqual(['1', '2']);
    expect(w.updatedAt).toBe('t2');
  });

  it('moves, removes and clamps', () => {
    let w = wall();
    for (const id of ['1', '2', '3']) w = applyOp(w, { op: 'add', tile: tile(id) }, 't');
    w = applyOp(w, { op: 'move', coverId: '3', to: 0 }, 't');
    expect(w.tiles.map((t) => t.coverId)).toEqual(['3', '1', '2']);
    w = applyOp(w, { op: 'move', coverId: '3', to: 99 }, 't');
    expect(w.tiles.map((t) => t.coverId)).toEqual(['1', '2', '3']);
    w = applyOp(w, { op: 'remove', coverId: '2' }, 't');
    expect(w.tiles.map((t) => t.coverId)).toEqual(['1', '3']);
    expect(applyOp(w, { op: 'columns', columns: 42 }, 't').columns).toBe(8);
    expect(applyOp(w, { op: 'columns', columns: 0 }, 't').columns).toBe(1);
  });

  it('refuses more than the limit', () => {
    let w = wall();
    for (let i = 0; i < MAX_TILES; i++) w = applyOp(w, { op: 'add', tile: tile(String(i)) }, 't');
    expect(() => applyOp(w, { op: 'add', tile: tile('999') }, 't')).toThrow(WallError);
  });

  it('accepts a tile only in the shape the server builds', () => {
    expect(() => validTile({ ...tile('1'), workId: 'javascript:x' })).toThrow(WallError);
    expect(() => validTile({ ...tile('1'), coverId: '../etc' })).toThrow(WallError);
    const t = validTile({ ...tile('1'), printings: [{ isbn13: 'nope', year: 3000, publisher: 'X' }] });
    expect(t.printings).toEqual([{ publisher: 'X' }]);
  });
});

describe('shopping list', () => {
  it('names every ISBN that carried the cover, and says when there is none', () => {
    let w = applyOp(wall(), { op: 'add', tile: tile('1') }, 't');
    w = applyOp(w, { op: 'add', tile: tile('2', { printings: [] }) }, 't');
    const list = shoppingList(toPublic(w));
    expect(list).toContain('ISBN 9780743273565');
    expect(list).toContain('no ISBN on record');
    expect(list.split('\n')[0]).toBe('My hallway — 2 covers, 4 columns');
  });
});
