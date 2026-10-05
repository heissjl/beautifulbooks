import { describe, expect, it } from 'vitest';
import { posterLayout, type PosterFormat, type Rect } from '../inspiration/layout';

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
    expect(L.tiles[0].y).toBe(L.head.y + L.head.height);
    expect(L.foot.y).toBe(L.tiles[8].y + L.tiles[8].height);
    expect(L.head.height).toBeGreaterThanOrEqual(2 * L.type.title);
    // Two lines with their leading, and the address's descenders stay on the canvas.
    expect(L.foot.height).toBeGreaterThanOrEqual(L.type.site + 1.6 * L.type.address);
    // A story keeps its words out of the bands the app lays its controls over; a post has none.
    expect(L.head.y).toBe(format === 'story' ? 250 : 0);
    expect(L.foot.y + L.foot.height).toBe(format === 'story' ? L.height - 250 : L.height);
  });
});

it('a story gives bigger tiles than a feed post (why the story comes first)', () => {
  expect(posterLayout('story').tiles[0].width).toBeGreaterThan(posterLayout('feed').tiles[0].width);
});

describe.each(['story', 'feed'] as PosterFormat[])('%s poster with six covers', format => {
  const L = posterLayout(format, 6);

  it('has six 2:3 tiles inside the canvas, between head and foot', () => {
    expect(L.tiles).toHaveLength(6);
    for (const t of L.tiles) {
      expect(t.width * 3).toBe(t.height * 2);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(L.width);
    }
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) expect(overlaps(L.tiles[i], L.tiles[j])).toBe(false);
    expect(L.tiles[0].y).toBe(L.head.y + L.head.height);
    expect(L.foot.y).toBe(L.tiles[5].y + L.tiles[5].height);
  });
});

it('six covers stand two wide in a story and three wide in a post, where they are larger than nine', () => {
  const story = posterLayout('story', 6);
  const feed = posterLayout('feed', 6);
  expect(new Set(story.tiles.map(t => t.x)).size).toBe(2);
  expect(new Set(feed.tiles.map(t => t.x)).size).toBe(3);
  expect(feed.tiles[0].width).toBeGreaterThan(posterLayout('feed', 9).tiles[0].width);
  expect(story.tiles[0].width).toBe(posterLayout('story', 9).tiles[0].width);
});

it('three covers stand one above and two below, in a story and in a post', () => {
  for (const format of ['story', 'feed'] as const) {
    const L = posterLayout(format, 3);
    const [top, left, right] = L.tiles;
    expect(L.tiles).toHaveLength(3);
    expect(left.y).toBe(right.y);
    expect(top.y).toBeLessThan(left.y);
    // The one above is centred over the two below.
    expect(top.x * 2 + top.width).toBe(left.x + right.x + right.width);
    expect(top.x * 2 + top.width).toBe(L.width);
    for (const t of L.tiles) {
      expect(t.width * 3).toBe(t.height * 2);
      expect(t.y).toBeGreaterThanOrEqual(L.head.y + L.head.height);
      expect(t.y + t.height).toBeLessThanOrEqual(L.foot.y);
    }
  }
  expect(posterLayout('feed', 3).tiles[0].width).toBeGreaterThan(posterLayout('feed', 6).tiles[0].width);
});
