/**
 * The clip's storyboard (lab/video), on the recorded Gatsby editions and on
 * small inline data. No network: the editions come from lib/__fixtures__,
 * the signatures are made up so that folding can be steered.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ImageSignature } from '../../../lib/imagesig';
import type { Cover, Edition, Work } from '../../../lib/model';
import { parseEditions, type OlEditionEntry } from '../../../lib/sources/openlibrary-parse';
import { assembleEditions } from '../../../lib/works';
import {
  accelerating, captionOf, gridLayout, splitFrames, spread, storyboard, weightedFrames,
  type CoverMeasure, type CoverShot, type GridShot,
} from '../storyboard';

const FIXTURES = path.join(__dirname, '..', '..', '..', 'lib', '__fixtures__', 'the-great-gatsby');
const entries = (file: string) =>
  (JSON.parse(readFileSync(path.join(FIXTURES, file), 'utf8')) as { entries: OlEditionEntry[] }).entries;

const gatsbyWork: Work = { id: 'OL468431W', title: 'The Great Gatsby', authors: ['F. Scott Fitzgerald'] };
const gatsby = assembleEditions(
  ['openlibrary-editions.json', 'openlibrary-editions-100.json', 'openlibrary-editions-200.json']
    .flatMap(f => parseEditions(entries(f), gatsbyWork)),
);

/** A distinct, well-contrasted signature per cover: nothing folds. */
function distinctSignatures(covers: readonly Cover[]): Map<string, ImageSignature> {
  return new Map(covers.map((c, i) => {
    // A cheap integer hash per index, so no two hashes are within the fold distances.
    let x = (i + 1) * 2654435761;
    const words: string[] = [];
    for (let k = 0; k < 2; k++) {
      x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0;
      x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0;
      words.push(x.toString(16).padStart(8, '0'));
    }
    const h = words.join('');
    return [c.id, { hash: h, contrast: 60, mean: 120 }];
  }));
}

const coverShots = (shots: ReturnType<typeof storyboard>['shots']) =>
  shots.filter((s): s is CoverShot => s.kind === 'cover');

describe('storyboard on the Gatsby fixtures', () => {
  const signatures = distinctSignatures(gatsby.covers);
  const board = storyboard({ work: gatsbyWork, ...gatsby, signatures }, { count: 30, seconds: 20 });
  const shots = coverShots(board.shots);

  it('has enough designs to cap at thirty', () => {
    expect(board.designs).toBeGreaterThan(30);
    expect(shots).toHaveLength(30);
  });

  it('sums to the target length exactly', () => {
    expect(board.totalFrames).toBe(20 * 30);
    expect(board.shots.reduce((s, x) => s + x.frames, 0)).toBe(600);
  });

  it('opens with a title card, closes on the wall of every cover shown, ends with the site', () => {
    expect(board.shots[0]).toMatchObject({ kind: 'title', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' });
    const grid = board.shots.at(-2) as GridShot;
    expect(grid.kind).toBe('grid');
    expect(grid.coverIds).toEqual(shots.map(s => s.coverId));
    expect(board.shots.at(-1)).toMatchObject({ kind: 'end', wordmark: 'Beautiful Books', url: 'beautifulcovers.vercel.app' });
  });

  it('starts slow and accelerates', () => {
    expect(shots[0].frames).toBeGreaterThan(shots.at(-1)!.frames * 2);
    for (let i = 1; i < shots.length; i++) expect(shots[i].frames).toBeLessThanOrEqual(shots[i - 1].frames + 1);
    for (const s of shots) {
      expect(s.transition).toBeLessThan(s.frames);
      // No dissolve shorter than 0.15 s: it would flicker.
      expect(s.transition / board.fps).toBeGreaterThanOrEqual(0.15);
    }
  });

  it('lets every tile of the wall arrive before the wall is held', () => {
    const grid = board.shots.at(-2) as GridShot;
    expect((grid.coverIds.length - 1) * grid.stagger + grid.tileFrames).toBeLessThan(grid.frames * 0.6);
  });

  it('never claims completeness in the title', () => {
    const text = board.shots.flatMap(s => (s.kind === 'title' ? [s.kicker, s.title] : s.kind === 'end' ? [s.tagline, s.credit] : [])).join(' ');
    expect(text).not.toMatch(/\b(all|every|complete)\b/i);
    expect(text).toContain('30 covers of');
  });

  it('shows no design twice and keeps year order', () => {
    expect(new Set(shots.map(s => s.coverId)).size).toBe(shots.length);
    const years = shots.map(s => s.year).filter((y): y is number => y !== undefined);
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it('spans the years it has rather than the first thirty', () => {
    const everything = coverShots(storyboard(
      { work: gatsbyWork, ...gatsby, signatures }, { count: 1000, seconds: 900, minShotSeconds: 0.1 },
    ).shots).map(s => s.year).filter((y): y is number => y !== undefined);
    const years = shots.map(s => s.year!);
    expect(years[0]).toBe(everything[0]);
    expect(years.at(-1)).toBe(everything.at(-1));
  });

  it('uses the L-size image', () => {
    for (const s of shots) expect(s.url).toMatch(/-L\.jpg$/);
  });
});

describe('folding and filtering', () => {
  const work = { title: 'Test', authors: ['A. Author'] };
  const ed = (id: string, year: number, publisher: string, language = 'en'): Edition =>
    ({ id, workId: 'OL1W', source: 'openlibrary', title: 'Test', year, publisher, language });
  const cover = (id: string, editionIds: string[]): Cover =>
    ({ id, url: `https://covers.openlibrary.org/b/id/${id}-L.jpg`, source: 'openlibrary', editionIds });
  const editions = [ed('e1', 1990, 'Pan'), ed('e2', 1970, 'Pan'), ed('e3', 2001, 'Vintage'), ed('e4', 1985, 'Heyne', 'de'), ed('e5', 1995, 'Blank')];
  const covers = [cover('a', ['e1']), cover('b', ['e2']), cover('c', ['e3']), cover('d', ['e4']), cover('e', ['e5'])];
  const signatures = new Map<string, ImageSignature>([
    ['a', { hash: 'f0f0f0f0f0f0f0f0', contrast: 50, mean: 120 }],
    // One bit away from a: the same jacket scanned twice, folds always.
    ['b', { hash: 'f0f0f0f0f0f0f0f1', contrast: 50, mean: 120 }],
    ['c', { hash: '0123456789abcdef', contrast: 50, mean: 120 }],
    ['d', { hash: 'fedcba9876543210', contrast: 50, mean: 120 }],
    // A blank white page: left out.
    ['e', { hash: '0000000000000000', contrast: 3, mean: 250 }],
  ]);

  it('shows a folded design once, captioned by the edition of the image shown', () => {
    const shots = coverShots(storyboard({ work, editions, covers, signatures }).shots);
    const ids = shots.map(s => s.coverId);
    expect(ids.filter(id => id === 'a' || id === 'b')).toHaveLength(1);
    const folded = shots.find(s => s.coverId === 'a' || s.coverId === 'b')!;
    // a carries e1 (1990), b carries e2 (1970): the caption belongs to whichever image is shown.
    expect(folded.caption).toBe(folded.coverId === 'a' ? '1990 · Pan' : '1970 · Pan');
  });

  it('lends a folded scan\'s year only when the shown image has no dated edition', () => {
    const undated: Edition = { id: 'u', workId: 'OL1W', source: 'openlibrary', title: 'Test', publisher: 'Pan', language: 'en' };
    const lone = [cover('a', ['u']), cover('b', ['e2'])];
    const shots = coverShots(storyboard({ work, editions: [...editions, undated], covers: lone, signatures }).shots);
    expect(shots).toHaveLength(1);
    expect(shots[0].year).toBe(1970);
  });

  it('leaves out a scanned page', () => {
    const shots = coverShots(storyboard({ work, editions, covers, signatures }).shots);
    expect(shots.map(s => s.coverId)).not.toContain('e');
    expect(shots).toHaveLength(3);
  });

  it('leaves out covers without a signature unless told otherwise', () => {
    const partial = new Map([...signatures].filter(([id]) => id !== 'c'));
    expect(coverShots(storyboard({ work, editions, covers, signatures: partial }).shots).map(s => s.coverId)).not.toContain('c');
    const kept = storyboard({ work, editions, covers, signatures: partial }, { requireSignature: false });
    expect(coverShots(kept.shots).map(s => s.coverId)).toContain('c');
  });

  it('filters by language', () => {
    const shots = coverShots(storyboard({ work, editions, covers, signatures }, { language: 'de' }).shots);
    expect(shots.map(s => s.coverId)).toEqual(['d']);
  });

  it('shows fewer covers rather than flashing them', () => {
    const many = Array.from({ length: 100 }, (_, i) => cover(`x${i}`, [`y${i}`]));
    const manyEditions = many.map((c, i) => ed(`y${i}`, 1900 + i, 'P'));
    const board = storyboard(
      { work, editions: manyEditions, covers: many, signatures: new Map() },
      { count: 100, seconds: 5, requireSignature: false, minShotSeconds: 0.25, titleSeconds: 1.5, endSeconds: 1.5, gridSeconds: 0 },
    );
    const shots = coverShots(board.shots);
    // 150 frames - 90 for the cards = 60; at 8 frames minimum that is 7 covers.
    expect(shots).toHaveLength(7);
    for (const s of shots) expect(s.frames).toBeGreaterThanOrEqual(8);
    expect(board.totalFrames).toBe(150);
  });

  it('leaves the cards out when asked', () => {
    const board = storyboard({ work, editions, covers, signatures }, { titleSeconds: 0, endSeconds: 0, gridSeconds: 0, seconds: 3 });
    expect(board.shots.every(s => s.kind === 'cover')).toBe(true);
    expect(board.totalFrames).toBe(90);
  });

  it('throws when nothing is left to show', () => {
    expect(() => storyboard({ work, editions, covers: [], signatures })).toThrow(/no covers/);
  });
});


describe('the clip rules on measured covers', () => {
  const work = { title: 'Test', authors: ['A. Author'] };
  const ed = (id: string, year: number, publisher: string): Edition =>
    ({ id, workId: 'OL1W', source: 'openlibrary', title: 'Test', year, publisher, language: 'en' });
  const cover = (id: string, editionIds: string[]): Cover =>
    ({ id, url: `https://covers.openlibrary.org/b/id/${id}-L.jpg`, source: 'openlibrary', editionIds });
  const designed: CoverMeasure = { width: 400, height: 600, mean: 120, contrast: 60, saturation: 80 };
  const hues = '/wAAAAAAAAAAAAAAAAAAAA==';

  it('drops a title on plain paper, a spread and a small scan when enough others remain', () => {
    const editions = ['p', 'w', 's', 'k1', 'k2'].map((id, i) => ed(`e${id}`, 1960 + i, `P${i}`));
    const covers = ['p', 'w', 's', 'k1', 'k2'].map(id => cover(id, [`e${id}`]));
    const hashes = ['0f0f0f0f0f0f0f0f', 'ff00ff00ff00ff00', '0123456789abcdef', 'fedcba9876543210', 'aaaa5555aaaa5555'];
    const signatures = new Map(covers.map((c, i) => [c.id, { hash: hashes[i], contrast: 50, mean: 120 }]));
    const measures = new Map<string, CoverMeasure>([
      ['p', { width: 400, height: 600, mean: 230, contrast: 10, saturation: 5 }],
      ['w', { width: 800, height: 500, mean: 120, contrast: 60, saturation: 80 }],
      ['s', { width: 114, height: 180, mean: 120, contrast: 60, saturation: 80 }],
      ['k1', designed],
      ['k2', designed],
    ]);
    const board = storyboard({ work, editions, covers, signatures, measures }, { count: 2 });
    expect(coverShots(board.shots).map(s => s.coverId)).toEqual(['k1', 'k2']);
    expect(board.excluded).toMatchObject({ plain: 1, wide: 1, small: 1 });
    // With too few large ones left, the small scan stays in.
    const three = storyboard({ work, editions, covers, signatures, measures }, { count: 3 });
    expect(coverShots(three.shots).map(s => s.coverId)).toContain('s');
  });

  it('shows one printing of the same artwork, preferring a large image', () => {
    const editions = [ed('e1', 1999, 'Ace'), ed('e2', 2005, 'Ace Trade'), ed('e3', 2010, 'Ace'), ed('e4', 1970, 'Other')];
    const covers = [cover('a1', ['e1']), cover('a2', ['e2']), cover('a3', ['e3']), cover('b', ['e4'])];
    // Sixteen bits apart and the same colour world: one jacket to the game's
    // rule, but beyond every tier the wall folds across publishers or years.
    const signatures = new Map<string, ImageSignature>([
      ['a1', { hash: 'f000000000000000', contrast: 50, saturation: 60, hues }],
      ['a2', { hash: 'f00000000000ffff', contrast: 50, saturation: 60, hues }],
      ['a3', { hash: 'f000000000ffff00', contrast: 50, saturation: 60, hues }],
      ['b', { hash: 'ffffffffffff0000', contrast: 50, saturation: 60, hues }],
    ]);
    const measures = new Map<string, CoverMeasure>([
      ['a1', { ...designed, width: 200, height: 300 }], ['a2', designed], ['a3', designed], ['b', designed],
    ]);
    const board = storyboard({ work, editions, covers, signatures, measures }, { minWidth: 300 });
    const shots = coverShots(board.shots);
    expect(shots.map(s => s.coverId)).toEqual(['b', 'a2']);
    expect(shots[1].caption).toBe('2005 · Ace Trade');
    expect(board.excluded.sameJacket).toBe(2);
  });
});

describe('helpers', () => {
  it('spread keeps both ends', () => {
    expect(spread([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4)).toEqual([1, 4, 7, 10]);
    expect(spread([1, 2], 5)).toEqual([1, 2]);
    expect(spread([1, 2, 3], 1)).toEqual([1]);
  });

  it('splitFrames differs by at most one and sums', () => {
    const parts = splitFrames(360, 29);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(360);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });

  it('weightedFrames sums exactly and respects the minimum', () => {
    const parts = weightedFrames(300, accelerating(30, 3), 6);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(300);
    expect(Math.min(...parts)).toBeGreaterThanOrEqual(6);
    expect(() => weightedFrames(10, [1, 1, 1], 4)).toThrow();
  });

  it('gridLayout fits thirty 2:3 tiles inside the area', () => {
    const g = gridLayout(30);
    expect(g.cols * g.rows).toBeGreaterThanOrEqual(30);
    expect(g.left).toBeGreaterThanOrEqual(0);
    expect(g.left * 2 + g.cols * g.tileWidth + (g.cols - 1) * g.gap).toBeLessThanOrEqual(1081);
    expect(g.top + g.rows * g.tileHeight + (g.rows - 1) * g.gap).toBeLessThanOrEqual(1640);
    expect(Math.abs(g.tileHeight / g.tileWidth - 1.5)).toBeLessThan(0.02);
  });

  it('captionOf joins what is known', () => {
    expect(captionOf(1965, 'Chilton Books')).toBe('1965 · Chilton Books');
    expect(captionOf(undefined, 'Ace')).toBe('Ace');
    expect(captionOf(1965, undefined)).toBe('1965');
    expect(captionOf(undefined, undefined)).toBe('');
  });
});
