import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyBoard, place } from '../board';
import { fileLinkStore, ID, shortId } from '../links';

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const board = () => ({ ...place(place(emptyBoard(), 0, { workId: 'OL1W', coverId: 'ol:1' }), 4, { workId: 'OL2W', coverId: 'ol:2' }), by: 'Julian' });

describe('short ids', () => {
  it('are eight readable characters, the same for the same board, different for a different one', () => {
    const id = shortId(board());
    expect(id).toMatch(ID);
    expect(shortId(board())).toBe(id);
    expect(shortId({ ...board(), by: 'Caitlin' })).not.toBe(id);
    expect(shortId(place(board(), 0, { workId: 'OL1W', coverId: 'ol:3' }))).not.toBe(id);
  });

  it('are stored once and read back as the same board; an empty board gets none', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'favlinks-'));
    dirs.push(dir);
    const store = fileLinkStore(join(dir, 'links.json'));
    const id = await store.put(board());
    expect(await store.put(board())).toBe(id);
    expect(await store.get(id)).toEqual(board());
    expect(await store.get('zzzzzzzz')).toBeNull();
    expect(await store.get('../etc')).toBeNull();
    await expect(store.put(emptyBoard())).rejects.toThrow(/empty/);
  });
});
