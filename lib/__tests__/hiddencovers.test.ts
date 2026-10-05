/**
 * A cover taken off the site on request (ROADMAP 2.18k): one test per path a
 * cover takes to a reader. If a new path appears — a new card, a new wall —
 * it needs a line here, or a hidden cover comes back through it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import ringsFile from '@/data/hero-rings.json';
import { isHiddenCover, isHiddenCoverUrl, parseHiddenCovers, setHiddenCoversForTest, withoutHiddenCovers } from '../hiddencovers';
import { assembleEditions, mosaicCovers, withRetailCovers } from '../works';
import type { Cover, SourceEdition, WorkSummary } from '../model';
import { similarTo } from '../coverindex';
import { parseCollections, type CollectionRecord } from '../collections';
import { readyPairs, type VersusPool } from '../hotornot/game';
import { pairSecret } from '../hotornot/token';
import { visibleTiles, type Tile } from '../walls/model';
import { rng } from '../loading';

afterEach(() => {
  setHiddenCoversForTest(null);
  vi.restoreAllMocks();
});

describe('the list', () => {
  it('takes well-formed ids and skips anything else', () => {
    const ids = parseHiddenCovers({ covers: [
      { id: 'ol:123', hidden: '2026-10-05' },
      { id: 'gb:AbC_d-1', hidden: '2026-10-05' },
      { id: 'local:no-04', hidden: '2026-10-05' },
      { id: 'https://covers.openlibrary.org/b/id/1-M.jpg' },
      { id: 42 },
      null,
    ] });
    expect([...ids].sort()).toEqual(['gb:AbC_d-1', 'local:no-04', 'ol:123']);
    expect(parseHiddenCovers(null).size).toBe(0);
    expect(parseHiddenCovers({ covers: 'ol:1' }).size).toBe(0);
  });

  it('ships empty or well-formed', async () => {
    const file = (await import('@/data/hidden-covers.json')).default as { covers: unknown[] };
    expect(parseHiddenCovers(file).size).toBe(file.covers.length);
  });

  it('reads an id back out of every address the site builds', () => {
    setHiddenCoversForTest(['ol:123', 'gb:AbC']);
    expect(isHiddenCover('ol:123')).toBe(true);
    expect(isHiddenCover('ol:1234')).toBe(false);
    expect(isHiddenCoverUrl('https://covers.openlibrary.org/b/id/123-L.jpg')).toBe(true);
    expect(isHiddenCoverUrl('/img/S/ol-123')).toBe(true);
    expect(isHiddenCoverUrl('/img/M/ol-123?retry=1')).toBe(true);
    expect(isHiddenCoverUrl('https://books.google.com/books/content?id=AbC&printsec=frontcover&img=1&zoom=1&source=gbs_api&fife=w300')).toBe(true);
    expect(isHiddenCoverUrl('https://covers.openlibrary.org/b/id/1234-L.jpg')).toBe(false);
    expect(withoutHiddenCovers([{ id: 'ol:123' }, { id: 'ol:9' }])).toEqual([{ id: 'ol:9' }]);
  });
});

describe('every path a cover takes', () => {
  it('the image route refuses it without asking upstream', async () => {
    setHiddenCoversForTest(['ol:123']);
    const upstream = vi.spyOn(globalThis, 'fetch');
    const { GET } = await import('@/app/img/[size]/[cover]/route');
    const res = await GET(new NextRequest('http://localhost/img/M/ol-123'), { params: Promise.resolve({ size: 'M', cover: 'ol-123' }) });
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('the wall: the cover goes, the edition stays', () => {
    setHiddenCoversForTest(['ol:gone']);
    const edition = (id: string, covers: string[]): SourceEdition => ({
      id, workId: 'OL1W', title: 'T', source: 'openlibrary', languages: ['eng'], covers: covers.map(c => ({ id: `ol:${c}`, url: `https://covers.openlibrary.org/b/id/${c}-M.jpg` })),
    } as unknown as SourceEdition);
    const { editions, covers } = assembleEditions([edition('a', ['gone', 'kept']), edition('b', ['gone'])]);
    expect(editions.map(e => e.id).sort()).toEqual(['a', 'b']);
    expect(covers.map(c => c.id)).toEqual(['ol:kept']);
  });

  it("a shop's image joins the wall only when it is not hidden", () => {
    setHiddenCoversForTest(['gb:gone']);
    const cover = (id: string): Cover => ({ id, url: `https://x/${id}`, source: 'googlebooks', editionIds: ['e'] });
    expect(withRetailCovers([cover('ol:1')], [cover('gb:gone'), cover('gb:kept')]).map(c => c.id)).toEqual(['ol:1', 'gb:kept']);
  });

  it("a search card's mosaic", () => {
    setHiddenCoversForTest(['ol:2']);
    const work = { coverUrls: [1, 2, 3].map(n => `https://covers.openlibrary.org/b/id/${n}-M.jpg`) } as WorkSummary;
    expect(mosaicCovers(work)).toEqual([1, 3].map(n => `https://covers.openlibrary.org/b/id/${n}-M.jpg`));
  });

  it('similar covers, asked from it or found for another', () => {
    const ids = (ringsFile as { rings: Array<{ coverIds: string[] }> }).rings.flatMap(r => r.coverIds);
    const from = ids.find(id => similarTo(id).length > 0);
    expect(from).toBeDefined();
    const found = similarTo(from!).map(s => s.coverId);
    setHiddenCoversForTest([found[0]]);
    expect(similarTo(from!).map(s => s.coverId)).not.toContain(found[0]);
    setHiddenCoversForTest([from!]);
    expect(similarTo(from!)).toEqual([]);
  });

  it('a collection', () => {
    setHiddenCoversForTest(['ol:12273691']);
    const record: CollectionRecord = {
      slug: 'women-writers', title: 'Women writers', kind: 'authors', intro: 'Intro.', published: true,
      authors: [{ name: 'Mary Shelley', keys: ['OL25342A'] }, { name: 'Ingeborg Bachmann', keys: ['OL27744A'] }],
      works: [
        { id: 'OL472971W', title: 'Malina', author: 'Ingeborg Bachmann', coverId: 'ol:12273691' },
        { id: 'OL450063W', title: 'Frankenstein', author: 'Mary Shelley', coverId: 'ol:13498737' },
      ],
    };
    const [c] = parseCollections([record], { includeDrafts: false });
    expect(c.works.map(w => w.id)).toEqual(['OL450063W']);
  });

  it('the cover game, from the first pairs on', () => {
    const pool: VersusPool = {
      name: 'test', builtAt: '2026-09-11', indexBuiltAt: '2026-09-09', excluded: [],
      covers: Array.from({ length: 8 }, (_, i) => ({ id: `ol:${i + 1}`, workId: `OL${i + 1}W`, title: `Book ${i + 1}`, author: 'A' })),
    };
    setHiddenCoversForTest(['ol:1', 'ol:2']);
    const pairs = readyPairs(pairSecret('test-token'), 3, { pool, random: rng(7), now: 1_700_000_000_000, store: 'memory' });
    const shown = pairs.flatMap(p => [p.a.id, p.b.id]);
    expect(shown).toHaveLength(6);
    expect(shown).not.toContain('ol:1');
    expect(shown).not.toContain('ol:2');
    expect(pairs[0].covers).toBe(6);
  });

  it("a reader's collection shows the rest and keeps the tile stored", () => {
    setHiddenCoversForTest(['ol:5']);
    const tiles = [{ coverId: '5' }, { coverId: '6' }, { coverId: 'gb:x' }] as Tile[];
    expect(visibleTiles(tiles).map(t => t.coverId)).toEqual(['6', 'gb:x']);
    expect(tiles).toHaveLength(3);
  });

  it('a share card does not fetch it', async () => {
    setHiddenCoversForTest(['ol:7']);
    const fetched = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x'.repeat(2048), { headers: { 'content-type': 'image/jpeg' } }));
    const { loadCovers } = await import('@/app/og');
    const out = await loadCovers(['https://covers.openlibrary.org/b/id/7-M.jpg', 'https://covers.openlibrary.org/b/id/8-M.jpg'], 2);
    expect(out).toHaveLength(1);
    expect(fetched.mock.calls.map(c => String(c[0]))).toEqual(['https://covers.openlibrary.org/b/id/8-M.jpg']);
  });

  it('the home ring leaves out a ring that holds it', async () => {
    const first = (ringsFile as { rings: Array<{ coverIds: string[] }> }).rings[0].coverIds[0];
    vi.resetModules();
    vi.doMock('@/data/hidden-covers.json', () => ({ default: { covers: [{ id: first, hidden: '2026-10-05' }] } }));
    const { HERO_RINGS } = await import('../herofan');
    expect(HERO_RINGS.length).toBeGreaterThan(0);
    expect(HERO_RINGS.some(r => r.coverIds.includes(first))).toBe(false);
    vi.doUnmock('@/data/hidden-covers.json');
    vi.resetModules();
  });
});
