import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { createAlbums, type AlbumState } from '../album';
import { foldSleeves } from '../fold';
import { labelsFrom, toPressing, type FullRelease } from '../pressing';
import { mbQuery, rankGroups, type MbReleaseGroup } from '../rank';
import { createSources, SourceError } from '../sources';

// Hand-made answers in the shape MusicBrainz and the Cover Art Archive give
// (ws/2 JSON, CAA listing). No network in tests (lab rule 4).
const RG = '11111111-1111-1111-1111-111111111111';
const id = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const release = (n: number, over: Partial<FullRelease> = {}): FullRelease => ({
  id: id(n), title: 'Kind of Blue', date: `${1958 + n}-08-17`, country: 'US',
  media: [{ format: '12" Vinyl' }],
  'cover-art-archive': { artwork: true, count: 3, front: true, back: true },
  'label-info': [{ 'catalog-number': `CL ${1354 + n}`, label: { name: 'Columbia' } }],
  ...over,
});

describe('toPressing', () => {
  it('takes vinyl only and builds the fixed archive addresses for front and back', () => {
    expect(toPressing(release(1, { media: [{ format: 'CD' }] }))).toBeNull();
    const p = toPressing(release(1))!;
    expect(p.front).toBe(`https://coverartarchive.org/release/${id(1)}/front-250`);
    expect(p.backXL).toBe(`https://coverartarchive.org/release/${id(1)}/back-1200`);
    expect(p.catno).toBe('CL 1355');
    expect(p.labels).toBeNull(); // has artwork: the listing still has to be read
  });

  it('says "none on record" only when the release has no artwork at all', () => {
    const p = toPressing(release(2, { 'cover-art-archive': { artwork: false, count: 0, front: false, back: false } }))!;
    expect(p.front).toBeNull();
    expect(p.back).toBeNull();
    expect(p.labels).toEqual([]);
  });

  it('drops "[none]" and repeated catalogue numbers', () => {
    const p = toPressing(release(3, { 'label-info': [{ 'catalog-number': '[none]', label: { name: 'CBS' } }, { 'catalog-number': 'S 62066' }, { 'catalog-number': 'S 62066' }] }))!;
    expect(p.catno).toBe('S 62066');
    expect(p.label).toBe('CBS');
  });
});

describe('labelsFrom', () => {
  it('takes Medium images, leaves out the CD of a box, at most two, over https', () => {
    const img = (types: string[], n: number, comment = '') => ({ types, comment, image: `http://x/${n}.jpg`, thumbnails: { 250: `http://x/${n}-250.jpg`, 500: `http://x/${n}-500.jpg`, 1200: `http://x/${n}-1200.jpg` } });
    const labels = labelsFrom([img(['Front'], 1), img(['Medium'], 2, 'CD 1'), img(['Medium'], 3, 'side A'), img(['Medium'], 4), img(['Medium'], 5)]);
    expect(labels.map(l => l.small)).toEqual(['https://x/3-250.jpg', 'https://x/4-250.jpg']);
    expect(labels[0].xl).toBe('https://x/3-1200.jpg');
  });
});

describe('foldSleeves', () => {
  const p = (n: number, hash: string | null, front = true) => ({ id: `p${n}`, date: `19${50 + n}`, front: front ? 'f' : null, hash });
  it('joins by single linkage at ≤ 20 and orders by the first pressing', () => {
    // a–b at 16, b–c at 16, a–c at 32: one sleeve through b.
    const a = '0000000000000000', b = '000000000000ffff', c = '00000000ffffffff', far = 'ffffffffffffffff';
    expect(foldSleeves([p(3, c), p(1, a), p(5, far), p(2, b)])).toEqual([{ ids: ['p1', 'p2', 'p3'] }, { ids: ['p5'] }]);
  });

  it('keeps a pressing without a hash on its own and leaves out one without a front', () => {
    expect(foldSleeves([p(1, '0000000000000000'), p(2, null), p(3, '0000000000000000', false)])).toEqual([{ ids: ['p1'] }, { ids: ['p2'] }]);
  });
});

describe('rankGroups', () => {
  const g = (over: Partial<MbReleaseGroup>): MbReleaseGroup => ({ id: 'x', title: 'Kind of Blue', score: 100, count: 1, 'primary-type': 'Album', 'artist-credit': [{ name: 'Miles Davis' }], ...over });
  it('puts the much-pressed album above a tribute with the same title and a compilation, and drops neither', () => {
    const hits = rankGroups([
      g({ id: 'tribute', count: 2, 'artist-credit': [{ name: 'Various Artists' }] }),
      g({ id: 'comp', count: 40, 'secondary-types': ['Compilation'], title: 'Kind of Blue / Sketches' }),
      g({ id: 'canon', count: 136, score: 92 }),
    ], 'kind of blue');
    expect(hits[0].id).toBe('canon');
    expect(hits.map(h => h.id).sort()).toEqual(['canon', 'comp', 'tribute']);
  });

  it('prefers the artist the reader named', () => {
    const hits = rankGroups([
      g({ id: 'other', title: 'Blue', count: 30, 'artist-credit': [{ name: 'Weezer' }] }),
      g({ id: 'joni', title: 'Blue', count: 25, 'artist-credit': [{ name: 'Joni Mitchell' }] }),
    ], 'blue joni mitchell');
    expect(hits[0].id).toBe('joni');
  });
});

describe('mbQuery', () => {
  it('requires every word in title or artist and escapes Lucene syntax', () => {
    expect(mbQuery('Help! AC/DC')).toBe('(releasegroup:Help\\! OR artist:Help\\!) AND (releasegroup:AC\\/DC OR artist:AC\\/DC)');
  });
});

/** A 64 × 64 PNG whose dHash is set by `pattern` (columns brighter to the right, or stripes). */
function png(pattern: 'ramp' | 'ramp2' | 'stripes'): Uint8Array {
  const img = new PNG({ width: 64, height: 64 });
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = pattern === 'stripes' ? ((x >> 3) % 2 ? 240 : 20) : pattern === 'ramp' ? x * 4 : Math.min(255, x * 4 + (y === 5 ? 9 : 0));
    const i = (y * 64 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  return new Uint8Array(PNG.sync.write(img));
}

/** A fake upstream: answers by URL; a function answer can count calls or fail. */
function upstream(routes: Record<string, unknown | (() => Response)>) {
  const calls: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const hit = Object.entries(routes).find(([k]) => url.startsWith(k));
    if (!hit) return new Response('', { status: 404 });
    const v = hit[1];
    if (typeof v === 'function') return (v as () => Response)();
    if (v instanceof Uint8Array) return new Response(v as unknown as BodyInit, { status: 200 });
    return new Response(JSON.stringify(v), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { f, calls };
}

describe('createSources', () => {
  it('caches an answer and a 404, but never a failure', async () => {
    let n = 0;
    const { f, calls } = upstream({
      'https://musicbrainz.org/ws/2/ok': { a: 1 },
      'https://musicbrainz.org/ws/2/down': () => { n++; return new Response('', { status: 503 }); },
    });
    const s = createSources({ cacheDir: mkdtempSync(join(tmpdir(), 'vinyl-')), fetch: f, mbGapMs: 0, retryMs: 0 });
    expect(await s.json('https://musicbrainz.org/ws/2/ok', 'musicbrainz')).toEqual({ a: 1 });
    expect(await s.json('https://musicbrainz.org/ws/2/ok', 'musicbrainz')).toEqual({ a: 1 });
    expect(await s.json('https://musicbrainz.org/ws/2/gone', 'musicbrainz')).toBeNull();
    expect(await s.json('https://musicbrainz.org/ws/2/gone', 'musicbrainz')).toBeNull();
    expect(calls.filter(c => c.endsWith('/ok')).length).toBe(1);
    expect(calls.filter(c => c.endsWith('/gone')).length).toBe(1);
    await expect(s.json('https://musicbrainz.org/ws/2/down', 'musicbrainz')).rejects.toBeInstanceOf(SourceError);
    await expect(s.json('https://musicbrainz.org/ws/2/down', 'musicbrainz')).rejects.toBeInstanceOf(SourceError);
    expect(n).toBe(6); // three tries each, nothing cached
  });

  it('spaces MusicBrainz requests, even when they are asked for at once', async () => {
    const starts: number[] = [];
    const f = (async () => { starts.push(Date.now()); return new Response('{}', { status: 200 }); }) as typeof fetch;
    const s = createSources({ cacheDir: mkdtempSync(join(tmpdir(), 'vinyl-')), fetch: f, mbGapMs: 60 });
    await Promise.all([1, 2, 3].map(n => s.json(`https://musicbrainz.org/ws/2/x${n}`, 'musicbrainz')));
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(55);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(55);
  });
});

async function until(get: () => AlbumState, done: (s: AlbumState) => boolean): Promise<AlbumState> {
  for (let i = 0; i < 200; i++) { const s = get(); if (done(s)) return s; await new Promise(r => setTimeout(r, 10)); }
  throw new Error('album did not finish');
}

describe('createAlbums', () => {
  const MB = 'https://musicbrainz.org/ws/2';
  const CAA = 'https://coverartarchive.org/release';
  const listing = (n: number) => ({ images: [
    { types: ['Front'], image: `http://x/${n}f.jpg`, thumbnails: { 250: `http://x/${n}f-250.jpg` } },
    { types: ['Medium'], image: `http://x/${n}m.jpg`, thumbnails: { 250: `http://x/${n}m-250.jpg`, 500: `http://x/${n}m-500.jpg` } },
  ] });
  const routes = (over: Record<string, unknown> = {}) => ({
    [`${MB}/release-group/${RG}`]: { id: RG, title: 'Kind of Blue', 'first-release-date': '1959-08-17', 'artist-credit': [{ name: 'Miles Davis' }],
      relations: [{ type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q731170' } }] },
    [`${MB}/release?release-group=${RG}`]: { 'release-count': 5, releases: [
      release(1), release(2), release(3), release(4, { media: [{ format: 'CD' }] }),
      release(5, { 'cover-art-archive': { artwork: false, count: 0, front: false, back: false } }),
    ] },
    [`${CAA}/${id(1)}/front-250`]: png('ramp'),
    [`${CAA}/${id(2)}/front-250`]: png('ramp2'),
    [`${CAA}/${id(3)}/front-250`]: png('stripes'),
    [`${CAA}/${id(1)}`]: listing(1),
    [`${CAA}/${id(2)}`]: listing(2),
    [`${CAA}/${id(3)}`]: { images: [] },
    ...over,
  });
  // Longer keys first, so `${CAA}/<id>/front-250` wins over `${CAA}/<id>`.
  const sorted = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).sort((a, b) => b[0].length - a[0].length));
  const story = async () => ({ article: 'Kind of Blue', url: 'https://en.wikipedia.org/wiki/Kind_of_Blue', excerpt: 'The cover photograph is by Jay Maisel.' });

  it('lists vinyl pressings, folds their fronts, reads their labels and keeps the finished album', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vinyl-'));
    const { f, calls } = upstream(sorted(routes()));
    const albums = createAlbums({ sources: createSources({ cacheDir: join(dir, 'c'), fetch: f, mbGapMs: 0, retryMs: 0 }), dir, story });
    const a = await until(() => albums.snapshot(RG), s => s.status !== 'loading');
    expect(a.status).toBe('done');
    expect(a.title).toBe('Kind of Blue');
    expect(a.artist).toBe('Miles Davis');
    expect(a.pressings.map(p => p.id)).toEqual([id(1), id(2), id(3), id(5)]);
    expect(a.sleeves.map(s => s.ids)).toEqual([[id(1), id(2)], [id(3)]]);
    expect(a.sleeves[0].line).toBe('Columbia · 1959–1960 · 2 pressings with a photo, 1 country');
    expect(a.pressings[0].labels?.[0].large).toBe('https://x/1m-500.jpg');
    expect(a.pressings[2].labels).toEqual([]);
    expect(a.pressings[3].labels).toEqual([]); // no artwork: no listing asked
    expect(a.pressings[0].front).toMatch(/^\/img\/[0-9a-f]{40}$/);
    expect(a.story?.excerpt).toContain('Jay Maisel');
    expect(calls.some(c => c === `${CAA}/${id(5)}`)).toBe(false);
    expect(existsSync(join(dir, 'albums', `${RG}.json`))).toBe(true);
    expect(readFileSync(join(dir, 'mvp-timings.jsonl'), 'utf8')).toContain('"sleeves":2');
  });

  it('keeps a failed front unfolded and a failed listing apart from "no label", and does not keep the album', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vinyl-'));
    const fail = () => new Response('', { status: 503 });
    const { f } = upstream(sorted(routes({ [`${CAA}/${id(2)}/front-250`]: fail, [`${CAA}/${id(1)}`]: fail })));
    const albums = createAlbums({ sources: createSources({ cacheDir: join(dir, 'c'), fetch: f, mbGapMs: 0, retryMs: 0 }), dir, story });
    const a = await until(() => albums.snapshot(RG), s => s.status !== 'loading');
    expect(a.sleeves.map(s => s.ids)).toEqual([[id(1)], [id(2)], [id(3)]]);
    expect(a.pressings[1].hashFailed).toBe(true);
    expect(a.pressings[0].labels).toBeNull();
    expect(a.pressings[0].labelsFailed).toBe(true);
    expect(a.steps.fronts.failed).toBe(1);
    expect(a.steps.labels.failed).toBe(1);
    expect(existsSync(join(dir, 'albums', `${RG}.json`))).toBe(false);
    // "Try again" asks only for what failed; everything else comes from the cache.
    const { f: f2, calls } = upstream(sorted(routes()));
    const again = createAlbums({ sources: createSources({ cacheDir: join(dir, 'c'), fetch: f2, mbGapMs: 0, retryMs: 0 }), dir, story });
    const b = await until(() => again.snapshot(RG), s => s.status !== 'loading');
    expect(b.sleeves.map(s => s.ids)).toEqual([[id(1), id(2)], [id(3)]]);
    expect(calls.sort()).toEqual([`${CAA}/${id(1)}`, `${CAA}/${id(2)}/front-250`]);
  });

  it('runs a finished album with failed parts again when the reader asks, and only then', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vinyl-'));
    let n = 0;
    const { f } = upstream(sorted(routes({ [`${CAA}/${id(1)}`]: () => { n++; return new Response('', { status: 503 }); } })));
    const albums = createAlbums({ sources: createSources({ cacheDir: join(dir, 'c'), fetch: f, mbGapMs: 0, retryMs: 0 }), dir, story });
    await until(() => albums.snapshot(RG), s => s.status !== 'loading');
    expect(n).toBe(3);
    albums.snapshot(RG);
    expect(n).toBe(3);
    albums.snapshot(RG, true);
    await until(() => albums.snapshot(RG), s => s.status !== 'loading');
    expect(n).toBe(6);
  });

  it('reports MusicBrainz down as a failure, not as an album without pressings, and retries only when asked', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vinyl-'));
    let up = false;
    const { f, calls } = upstream(sorted(routes({ [`${MB}/release-group/${RG}`]: () => up
      ? new Response(JSON.stringify({ id: RG, title: 'Kind of Blue', 'artist-credit': [{ name: 'Miles Davis' }] }), { status: 200 })
      : new Response('', { status: 503 }) })));
    const albums = createAlbums({ sources: createSources({ cacheDir: join(dir, 'c'), fetch: f, mbGapMs: 0, retryMs: 0 }), dir, story });
    const a = await until(() => albums.snapshot(RG), s => s.status !== 'loading');
    expect(a.status).toBe('failed');
    expect(a.error).toMatch(/MusicBrainz did not answer/);
    const before = calls.length;
    albums.snapshot(RG);
    expect(calls.length).toBe(before); // polling a failed album asks nothing
    up = true;
    const b = await until(() => albums.snapshot(RG, true), s => s.status === 'done');
    expect(b.pressings.length).toBe(4);
  });
});
