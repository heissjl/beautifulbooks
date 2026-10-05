import { describe, expect, it } from 'vitest';
import { posterLayout, type PosterFormat, type Rect } from '../layout';

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe.each(['story', 'feed'] as PosterFormat[])('%s poster', format => {
  const L = posterLayout(format);

  it('has nine 2:3 tiles inside the canvas, none overlapping', () => {
    expect(L.tiles).toHaveLength(9);
    for (const t of L.tiles) {
      expect(t.width * 3).toBe(t.height * 2);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(L.width);
      expect(t.y + t.height).toBeLessThanOrEqual(L.height);
    }
    for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) expect(overlaps(L.tiles[i], L.tiles[j])).toBe(false);
  });

  it('runs row by row and is centred', () => {
    expect(L.tiles[1].x).toBeGreaterThan(L.tiles[0].x);
    expect(L.tiles[3].y).toBeGreaterThan(L.tiles[0].y);
    const left = L.tiles[0].x;
    const right = L.width - (L.tiles[2].x + L.tiles[2].width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it('leaves the head and foot their room', () => {
    expect(L.tiles[0].y).toBe(L.head.height);
    expect(L.foot.y).toBe(L.tiles[8].y + L.tiles[8].height);
    expect(L.head.height).toBeGreaterThanOrEqual(L.type.title + L.type.byline);
    expect(L.foot.height).toBeGreaterThanOrEqual(2 * L.type.foot);
  });
});

it('a story gives bigger tiles than a feed post (why the story comes first)', () => {
  expect(posterLayout('story').tiles[0].width).toBeGreaterThan(posterLayout('feed').tiles[0].width);
});
