import { describe, expect, it } from 'vitest';
import { cardLayout, posterLayout, type PosterFormat, type Rect } from '../inspiration/layout';

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

// Three wide in a story too since 2026-10-06: two wide left a third of the width empty and the covers as small as nine.
it('six covers stand three wide and two high, larger than nine, with titles or without', () => {
  for (const format of ['story', 'feed'] as const) {
    for (const titles of [false, true]) {
      const six = posterLayout(format, 6, titles);
      expect(new Set(six.tiles.map(t => t.x)).size).toBe(3);
      expect(new Set(six.tiles.map(t => t.y)).size).toBe(2);
      expect(six.tiles[0].width).toBeGreaterThan(posterLayout(format, 9, titles).tiles[0].width);
    }
  }
  expect(posterLayout('story', 6, true).tiles[0]).toMatchObject({ width: 304, height: 456 });
});

it('keeps two lines of title and the next row apart', () => {
  for (const format of ['story', 'feed'] as const) {
    const L = posterLayout(format, 9, true);
    const cap = L.caption!;
    // Ten pixels above the caption, two title lines at 1.15, one author line at 1.25.
    expect(10 + 2 * cap.title * 1.15 + cap.author * 1.25).toBeLessThanOrEqual(cap.height);
    const [a, , , b] = L.tiles;
    expect(b.y - (a.y + a.height)).toBe(cap.height + cap.rowGap);
  }
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

// The link card shows the board as it stands (Julian, 2026-10-18: „dass es auch das grid zeigt").
describe.each([9, 6, 3] as const)('the link card of %i', count => {
  const C = cardLayout(count);
  const rows = count / 3;

  it('stands its covers three across in the board\'s order, 2:3, inside the card, apart from the words', () => {
    expect(C).toMatchObject({ width: 1200, height: 630 });
    expect(C.covers).toHaveLength(count);
    C.covers.forEach((t, i) => {
      expect(t.width * 3).toBe(t.height * 2);
      expect(t.x).toBe(C.covers[i % 3].x);
      expect(t.y).toBe(C.covers[Math.floor(i / 3) * 3].y);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(C.width);
      expect(t.y + t.height).toBeLessThanOrEqual(C.height);
      expect(overlaps(t, C.words)).toBe(false);
    });
    expect(new Set(C.covers.map(t => t.x)).size).toBe(3);
    expect(new Set(C.covers.map(t => t.y)).size).toBe(rows);
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) expect(overlaps(C.covers[i], C.covers[j])).toBe(false);
  });

  it('keeps the words left of the covers and out of the bottom left corner X lays the page title over', () => {
    expect(C.words.x + C.words.width).toBeLessThan(Math.min(...C.covers.map(t => t.x)));
    expect(C.words.x).toBeGreaterThanOrEqual(40);
    // A column set in its middle ends well above its foot; one set from the top ends at three quarters.
    if (C.align === 'start') expect(C.words.y + C.words.height).toBeLessThanOrEqual(0.75 * C.height);
  });
});

it('nine on a board\'s card take the places of the empty board on /shelfportrait\'s card', () => {
  const nine = cardLayout(9);
  expect(nine.covers[0]).toEqual({ x: 728, y: 22, width: 124, height: 186 });
  expect(nine.covers[8]).toEqual({ x: 1004, y: 422, width: 124, height: 186 });
  expect(nine.words).toEqual({ x: 72, y: 72, width: 592, height: 380 });
  // Six and three are larger, as before.
  expect(cardLayout(6).covers[0]).toMatchObject({ width: 186, height: 279 });
  expect(cardLayout(3).covers[0]).toMatchObject({ width: 264, height: 396 });
});
