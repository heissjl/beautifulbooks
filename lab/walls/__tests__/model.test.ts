import { describe, expect, it } from 'vitest';
import {
  applyOp,
  decodeKeyRing,
  encodeKeyRing,
  hashKey,
  isEditKey,
  isWallId,
  keyOpens,
  MAX_TILES,
  mergeKeyRings,
  newEditKey,
  newWall,
  newWallId,
  shoppingList,
  toPublic,
  validTile,
  WallError,
  type Tile,
} from '../model';

const KEY = newEditKey(Buffer.alloc(16, 7));
const tile = (coverId: string, extra: Partial<Tile> = {}): Tile => ({
  workId: 'OL468431W',
  coverId,
  title: 'The Great Gatsby',
  author: 'F. Scott Fitzgerald',
  printings: [{ isbn13: '9780743273565', publisher: 'Scribner', year: 2004 }],
  ...extra,
});
const wall = () => newWall('abcdefghij', KEY, '  My   hallway ', '2026-09-28');

describe('ids and keys', () => {
  it('makes ids and keys in the shapes it accepts', () => {
    expect(isWallId(newWallId())).toBe(true);
    expect(isEditKey(newEditKey())).toBe(true);
    expect(isWallId('ABCDEFGHIJ')).toBe(false);
    expect(isEditKey('short')).toBe(false);
  });

  it('stores only the hash, and only the right key opens the wall', () => {
    const w = wall();
    expect(w.keyHash).toBe(hashKey(KEY));
    expect(JSON.stringify(w)).not.toContain(KEY);
    expect(keyOpens(w, KEY)).toBe(true);
    expect(keyOpens(w, newEditKey(Buffer.alloc(16, 8)))).toBe(false);
    expect(keyOpens(w, undefined)).toBe(false);
  });

  it('never gives the hash to a viewer', () => {
    expect(toPublic(wall())).not.toHaveProperty('keyHash');
  });
});

describe('operations', () => {
  it('cleans the title', () => {
    expect(wall().title).toBe('My hallway');
    expect(newWall('abcdefghij', KEY, '   ', 'd').title).toBe('Untitled wall');
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

describe('key ring', () => {
  it('round-trips and drops what it cannot read', () => {
    const ring = [{ id: 'abcdefghij', key: KEY }, { id: 'bad', key: KEY }];
    const text = encodeKeyRing(ring);
    expect(decodeKeyRing(text)).toEqual([{ id: 'abcdefghij', key: KEY }]);
    expect(decodeKeyRing(`${text}~garbage~`)).toEqual([{ id: 'abcdefghij', key: KEY }]);
    expect(decodeKeyRing('hello')).toEqual([]);
  });

  it('merges with the incoming key winning', () => {
    const other = newEditKey(Buffer.alloc(16, 9));
    const merged = mergeKeyRings([{ id: 'abcdefghij', key: KEY }], [{ id: 'abcdefghij', key: other }, { id: 'klmnopqrst', key: KEY }]);
    expect(merged).toEqual([{ id: 'abcdefghij', key: other }, { id: 'klmnopqrst', key: KEY }]);
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
