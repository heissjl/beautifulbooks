import { describe, expect, it } from 'vitest';
import {
  applyOp,
  isVisitorId,
  isWallId,
  MAX_TILES,
  MIN_SHOWCASE_TILES,
  moderate,
  shoppingList,
  toPublic,
  validTile,
  WallError,
  type Tile,
} from '../walls/model';
import { hashVisitor, isOwner, newVisitorId, newWall, newWallId, ownedBy } from '../walls/owner';

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
    expect(newVisitorId(Buffer.alloc(16, 0xff))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(isVisitorId('1e87ecdf-1a23-4775-803f-b43f3ec29c14')).toBe(true);
    expect(isVisitorId('1E87ECDF-1A23-4775-803F-B43F3EC29C14')).toBe(false);
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
    expect(newWall('abcdefghij', ME, '   ', 'd').title).toBe('My collection');
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

describe('showcase (5.13d)', () => {
  const full = () => {
    let w = applyOp(wall(), { op: 'save' }, 't');
    for (let i = 0; i < MIN_SHOWCASE_TILES; i++) w = applyOp(w, { op: 'add', tile: tile(String(i)) }, 't');
    return w;
  };

  it('starts every new collection unsaved, and shows none that is not saved (5.13j)', () => {
    expect(wall().unsaved).toBe(true);
    let w = wall();
    for (let i = 0; i < MIN_SHOWCASE_TILES; i++) w = applyOp(w, { op: 'add', tile: tile(String(i)) }, 't');
    expect(() => applyOp(w, { op: 'submit' }, 't')).toThrow('Save the collection first.');
    const saved = applyOp(w, { op: 'save' }, 't');
    expect(saved).not.toHaveProperty('unsaved');
    expect(toPublic(w).unsaved).toBe(true);
    expect(applyOp(saved, { op: 'submit' }, 't').showcase).toBe('shown');
  });

  it('keeps a short paragraph, cleaned, and drops an empty one', () => {
    const w = applyOp(wall(), { op: 'intro', intro: '  Six   books\n\n\n\nfrom my hallway ' }, 't');
    expect(w.intro).toBe('Six books\n\nfrom my hallway');
    expect(applyOp(w, { op: 'intro', intro: '  ' }, 't')).not.toHaveProperty('intro');
    expect(applyOp(wall(), { op: 'intro', intro: 'x'.repeat(2000) }, 't').intro).toHaveLength(600);
  });

  it('keeps a name the owner chose, trimmed and short, and drops an empty one', () => {
    const w = applyOp(wall(), { op: 'by', by: '  Julian   H. ' }, 't');
    expect(w.by).toBe('Julian H.');
    expect(toPublic(w).by).toBe('Julian H.');
    expect(applyOp(w, { op: 'by', by: ' ' }, 't')).not.toHaveProperty('by');
    expect(applyOp(wall(), { op: 'by', by: 'x'.repeat(200) }, 't').by).toHaveLength(60);
  });

  it('shows a saved wall at once, without review, from one cover on', () => {
    expect(() => applyOp(applyOp(wall(), { op: 'save' }, 't'), { op: 'submit' }, 't')).toThrow('An empty collection cannot be shown.');
    const shown = applyOp(full(), { op: 'submit' }, 't');
    expect(shown.showcase).toBe('shown');
    expect(applyOp(shown, { op: 'intro', intro: 'new words' }, 't').showcase).toBe('shown');
    expect(applyOp(shown, { op: 'withdraw' }, 't')).not.toHaveProperty('showcase');
  });

  it('keeps a wall Julian took down hidden, whatever its owner sends', () => {
    const hidden = moderate(applyOp(full(), { op: 'submit' }, 't'), 'hidden', 't');
    expect(() => applyOp(hidden, { op: 'submit' }, 't')).toThrow(WallError);
    expect(applyOp(hidden, { op: 'withdraw' }, 't').showcase).toBe('hidden');
    expect(moderate(hidden, 'shown', 't').showcase).toBe('shown');
    expect(() => moderate(wall(), 'hidden', 't')).toThrow(WallError);
  });

  it('shows the paragraph and status to viewers, never the owner', () => {
    const pub = toPublic({ ...applyOp(full(), { op: 'intro', intro: 'hi' }, 't'), showcase: 'shown' });
    expect(pub).toMatchObject({ intro: 'hi', showcase: 'shown' });
    expect(pub).not.toHaveProperty('ownerHash');
  });
});

