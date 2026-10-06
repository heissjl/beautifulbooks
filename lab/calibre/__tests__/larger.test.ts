import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Catalogue, CataloguePage } from '../catalogue';
import type { PickCover } from '../covers';
import { FileMap } from '../filemap';
import { LargerError, largerScan, largestOf, sameDesign } from '../larger';

/** Sixteen hex digits, as the site's dHash; `flip` changes that many bits of the first. */
const BASE = '0f0f0f0f0f0f0f0f';
const flip = (bits: number): string => {
  let n = BigInt(`0x${BASE}`);
  for (let i = 0; i < bits; i++) n ^= BigInt(1) << BigInt(i * 2);
  return n.toString(16).padStart(16, '0');
};
const cover = (coverId: string): PickCover => ({ coverId, thumb: '', languages: [], publishers: [], isbns: [] });
const page = (ids: string[], editions: number, next: number | null): CataloguePage => ({ work: { id: 'OL1W', title: 'Rendezvous with Rama', authors: ['Arthur C. Clarke'] }, covers: ids.map(cover), editions, next });
const catalogueOf = (pages: Record<number, CataloguePage | null | Error>): Catalogue & { asked: number[] } => {
  const asked: number[] = [];
  return {
    asked,
    search: async () => [],
    page: async (_id, offset) => {
      asked.push(offset);
      const p = pages[offset];
      if (p instanceof Error) throw p;
      return p ?? null;
    },
  };
};
const table = <T>(facts: Record<string, T | null>) => ({ get: async (id: string) => facts[id] ?? null });
const pick = { workId: 'OL1W', coverId: 'ol:1' };

describe('scans of one design', () => {
  it('are the covers within the fold’s unconditional distance, and no further', () => {
    expect(sameDesign(BASE, [
      { coverId: 'ol:2', hash: BASE },
      { coverId: 'ol:3', hash: flip(8) },
      { coverId: 'ol:4', hash: flip(9) },
      { coverId: 'ol:5', hash: null },
    ])).toEqual(['ol:2', 'ol:3']);
  });

  it('give way to the largest only when it has a tenth more pixels', () => {
    const own = { coverId: 'ol:1', size: { width: 300, height: 500 } };
    expect(largestOf(own, [{ coverId: 'ol:2', size: { width: 310, height: 510 } }])).toBe(own);
    expect(largestOf(own, []).coverId).toBe('ol:1');
    expect(largestOf(own, [{ coverId: 'ol:2', size: { width: 400, height: 640 } }, { coverId: 'ol:3', size: { width: 2002, height: 3401 } }]).coverId).toBe('ol:3');
  });
});

describe('looking through a work for a larger scan', () => {
  const hashes = table({ 'ol:1': BASE, 'ol:2': flip(3), 'ol:3': flip(30), 'ol:4': flip(5), 'ol:6': flip(2) });
  const sizes = table({ 'ol:1': { width: 287, height: 500 }, 'ol:2': { width: 2002, height: 3401 }, 'ol:3': { width: 4000, height: 6000 }, 'ol:4': { width: 200, height: 320 } });

  it('names the largest scan of the same design and leaves a larger scan of another design alone', async () => {
    const c = catalogueOf({ 0: page(['ol:1', 'ol:2', 'ol:3'], 130, 100), 100: page(['ol:4', 'gb:abc'], 130, null) });
    const found = await largerScan(pick, { catalogue: c, hashes, sizes });
    expect(found).toMatchObject({ larger: true, use: { coverId: 'ol:2', size: { width: 2002, height: 3401 } }, own: { coverId: 'ol:1' }, same: 2, covers: 4, seen: 130, editions: 130, notCompared: 0 });
    expect(found.incomplete).toBeUndefined();
    expect(c.asked).toEqual([0, 100]);
  });

  it('keeps the collection’s scan when no other of its design is clearly larger', async () => {
    const found = await largerScan(pick, { catalogue: catalogueOf({ 0: page(['ol:1', 'ol:3', 'ol:4'], 40, null) }), hashes, sizes });
    expect(found).toMatchObject({ larger: false, use: { coverId: 'ol:1' }, same: 1, covers: 3, seen: 40 });
  });

  it('counts what it could not compare instead of calling it "none"', async () => {
    // ol:5 has no hash; ol:6 is the same design but its size never came.
    const found = await largerScan(pick, { catalogue: catalogueOf({ 0: page(['ol:5', 'ol:6'], 12, null) }), hashes, sizes });
    expect(found).toMatchObject({ larger: false, same: 1, notCompared: 2 });
  });

  it('stops after three pages and says when a later page did not come', async () => {
    const long = catalogueOf({ 0: page(['ol:3'], 900, 100), 100: page([], 900, 200), 200: page([], 900, 300), 300: page(['ol:2'], 900, 400) });
    expect(await largerScan(pick, { catalogue: long, hashes, sizes })).toMatchObject({ larger: false, seen: 300, editions: 900 });
    expect(long.asked).toEqual([0, 100, 200]);
    const broken = await largerScan(pick, { catalogue: catalogueOf({ 0: page(['ol:2'], 250, 100), 100: new Error('silent') }), hashes, sizes });
    expect(broken).toMatchObject({ larger: true, seen: 100, editions: 250, incomplete: 'The catalogue did not answer for every page of editions.' });
  });

  it('fails in words where there is nothing to say', async () => {
    const c = catalogueOf({ 0: page(['ol:2'], 10, null) });
    await expect(largerScan({ workId: 'OL1W', coverId: 'gb:abcDEF' }, { catalogue: c, hashes, sizes })).rejects.toThrow(LargerError);
    await expect(largerScan({ workId: 't:ubik::a:dick', coverId: 'ol:1' }, { catalogue: c, hashes, sizes })).rejects.toThrow(/no work/);
    await expect(largerScan({ workId: 'OL1W', coverId: 'ol:99' }, { catalogue: c, hashes, sizes })).rejects.toThrow(/own scan could not be fetched/);
    await expect(largerScan(pick, { catalogue: catalogueOf({}), hashes, sizes })).rejects.toThrow('The catalogue does not know this work.');
    // The catalogue's own failure on the first page stays the catalogue's.
    await expect(largerScan(pick, { catalogue: catalogueOf({ 0: new Error('silent') }), hashes, sizes })).rejects.toThrow('silent');
    expect(c.asked).toEqual([]);
  });
});

describe('a few names in a file', () => {
  it('remembers, forgets, and is there in the next run', () => {
    const dir = mkdtempSync(join(tmpdir(), 'calibre-map-'));
    try {
      const file = join(dir, 'deep/larger-scans.json');
      const map = new FileMap(file);
      map.set('ol:1', 'ol:2');
      map.set(7, 'ol:9');
      map.delete('ol:404');
      expect(new FileMap(file).all()).toEqual({ 'ol:1': 'ol:2', 7: 'ol:9' });
      map.delete('ol:1');
      expect(new FileMap(file).get('ol:1')).toBeUndefined();
      expect(new FileMap(file).get(7)).toBe('ol:9');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('the size a cover record states', () => {
  it('is taken when width and height are whole and positive, and nothing else is', async () => {
    const { sizeFromRecord } = await import('../download');
    const record = (r: unknown) => Buffer.from(JSON.stringify(r));
    expect(sizeFromRecord(record({ id: 6557353, width: 2002, height: 3401, filename: 'covers_0006_55.tar' }))).toEqual({ width: 2002, height: 3401 });
    expect(sizeFromRecord(record({ id: 1008445, width: null, height: null }))).toBeNull();
    expect(sizeFromRecord(record({ width: 0, height: 475 }))).toBeNull();
    expect(sizeFromRecord(record({ width: '300', height: 475 }))).toBeNull();
    expect(sizeFromRecord(Buffer.from('<html>502 Bad Gateway</html>'))).toBeNull();
  });
});
