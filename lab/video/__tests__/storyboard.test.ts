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
import { captionOf, splitFrames, spread, storyboard, type CoverShot } from '../storyboard';

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
  const board = storyboard({ work: gatsbyWork, ...gatsby, signatures }, { count: 30, seconds: 15 });
  const shots = coverShots(board.shots);

  it('has enough designs to cap at thirty', () => {
    expect(board.designs).toBeGreaterThan(30);
    expect(shots).toHaveLength(30);
  });

  it('sums to the target length exactly', () => {
    expect(board.totalFrames).toBe(15 * 30);
    expect(board.shots.reduce((s, x) => s + x.frames, 0)).toBe(450);
  });

  it('opens with a title card and ends with the site', () => {
    expect(board.shots[0]).toMatchObject({ kind: 'title' });
    expect(board.shots[0].kind === 'title' && board.shots[0].lines).toContain('The Great Gatsby');
    expect(board.shots.at(-1)).toMatchObject({ kind: 'end', lines: ['Beautiful Books', 'Covers: Open Library'] });
  });

  it('never claims completeness in the title', () => {
    const text = board.shots.flatMap(s => ('lines' in s ? s.lines : [])).join(' ');
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
      { work: gatsbyWork, ...gatsby, signatures }, { count: 1000, seconds: 600 },
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

  it('shows a folded design once, dated by its earliest edition', () => {
    const shots = coverShots(storyboard({ work, editions, covers, signatures }).shots);
    const ids = shots.map(s => s.coverId);
    expect(ids.filter(id => id === 'a' || id === 'b')).toHaveLength(1);
    const folded = shots.find(s => s.coverId === 'a' || s.coverId === 'b')!;
    expect(folded.year).toBe(1970);
    expect(folded.caption).toBe('1970 · Pan');
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
      { count: 100, seconds: 5, requireSignature: false, minShotSeconds: 0.25 },
    );
    const shots = coverShots(board.shots);
    // 150 frames - 90 for the cards = 60; at 8 frames minimum that is 7 covers.
    expect(shots).toHaveLength(7);
    for (const s of shots) expect(s.frames).toBeGreaterThanOrEqual(8);
    expect(board.totalFrames).toBe(150);
  });

  it('leaves the cards out when asked', () => {
    const board = storyboard({ work, editions, covers, signatures }, { titleSeconds: 0, endSeconds: 0, seconds: 3 });
    expect(board.shots.every(s => s.kind === 'cover')).toBe(true);
    expect(board.totalFrames).toBe(90);
  });

  it('throws when nothing is left to show', () => {
    expect(() => storyboard({ work, editions, covers: [], signatures })).toThrow(/no covers/);
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

  it('captionOf joins what is known', () => {
    expect(captionOf(1965, 'Chilton Books')).toBe('1965 · Chilton Books');
    expect(captionOf(undefined, 'Ace')).toBe('Ace');
    expect(captionOf(1965, undefined)).toBe('1965');
    expect(captionOf(undefined, undefined)).toBe('');
  });
});
