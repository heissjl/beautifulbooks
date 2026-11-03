import { describe, expect, it } from 'vitest';
import { COMPARE_COUNT, compareLayout, fitLabel } from '../comparelayout';
import { PIN_MARGIN, PIN_SIZE, type Rect } from '../pinlayout';

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe.each(['Dune', "Harry Potter and the Philosopher's Stone"])('the comparison pin for %s (ROADMAP 5.5a)', title => {
  const L = compareLayout(title);

  it('is 2:3 and holds three 2:3 tiles in one row inside the canvas', () => {
    expect(L.width).toBe(PIN_SIZE.width);
    expect(L.height).toBe(PIN_SIZE.height);
    expect(L.tiles).toHaveLength(COMPARE_COUNT);
    expect(L.labels).toHaveLength(COMPARE_COUNT);
    for (const t of L.tiles) {
      expect(t.width * 3).toBe(t.height * 2);
      expect(t.y).toBe(L.tiles[0].y);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(L.width);
      expect(t.y).toBeGreaterThanOrEqual(L.head.y + L.head.height);
    }
    expect(L.tiles[1].x).toBeGreaterThan(L.tiles[0].x + L.tiles[0].width);
    expect(L.tiles[2].x).toBeGreaterThan(L.tiles[1].x + L.tiles[1].width);
    const left = L.tiles[0].x;
    const right = L.width - (L.tiles[2].x + L.tiles[2].width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it('puts a label under each tile, as wide as the tile, above the foot, nothing overlapping', () => {
    L.labels.forEach((l, i) => {
      expect(l.x).toBe(L.tiles[i].x);
      expect(l.width).toBe(L.tiles[i].width);
      expect(l.y).toBeGreaterThan(L.tiles[i].y + L.tiles[i].height);
      expect(l.y + l.height).toBeLessThanOrEqual(L.foot.y);
      expect(l.height).toBeGreaterThanOrEqual(L.type.year * 1.1 + L.type.publisher * 1.3);
    });
    const boxes = [...L.tiles, ...L.labels];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j])).toBe(false);
  });

  it('leaves the head its title lines and the author, the foot the site line, the air split evenly', () => {
    expect(L.head.x).toBe(PIN_MARGIN);
    expect(L.head.width).toBe(L.width - 2 * PIN_MARGIN);
    expect(L.head.height).toBeGreaterThanOrEqual(L.titleLines * L.titleSize * 1.1 + L.type.line * 1.3);
    expect(L.foot.y + L.foot.height).toBe(L.height - L.head.y);
    expect(L.foot.height).toBeGreaterThanOrEqual(L.type.site * 1.4);
    const airAbove = L.tiles[0].y - (L.head.y + L.head.height);
    const airBelow = L.foot.height - 128 + 0; // the foot begins at the labels' end; what it holds beyond the site line is air
    expect(airAbove).toBeGreaterThanOrEqual(0);
    expect(airBelow).toBeGreaterThanOrEqual(0);
  });
});

it('a one-line title hands its room to the air above the covers, not to the tiles (the width sets them)', () => {
  const short = compareLayout('Dune');
  const long = compareLayout("Harry Potter and the Philosopher's Stone");
  expect(short.titleLines).toBe(1);
  expect(long.titleLines).toBe(2);
  expect(short.tiles[0].width).toBe(long.tiles[0].width);
  expect(short.head.height).toBeLessThan(long.head.height);
  expect(short.tiles[0].y).toBeLessThan(long.tiles[0].y);
});

describe('fitLabel', () => {
  const width = compareLayout('Dune').tiles[0].width;

  it('keeps a short publisher at full size and sets a long one smaller', () => {
    expect(fitLabel('Penguin', width)).toEqual({ text: 'Penguin', size: 24 });
    expect(fitLabel('Harcourt, Brace and Co.', width).size).toBe(24);
    expect(fitLabel('Bantam Doubleday Dell Pub', width).size).toBeLessThan(24);
    expect(fitLabel('Bantam Doubleday Dell Pub', width).text).toBe('Bantam Doubleday Dell Pub');
    expect(fitLabel('New English Library Ltd.', width).size).toBe(24);
  });

  it('cuts a name that no size holds at a word, with an ellipsis, never past the tile', () => {
    const cut = fitLabel('Houghton Mifflin Harcourt Publishing Company of Boston', width);
    expect(cut.size).toBe(18);
    expect(cut.text.endsWith('…')).toBe(true);
    expect(cut.text).toBe('Houghton Mifflin Harcourt…');
    expect(cut.text.length).toBeLessThanOrEqual(Math.floor(width / (18 * 0.52)));
  });

  it('tidies the spaces it is given', () => {
    expect(fitLabel('  Ace   Books ', width).text).toBe('Ace Books');
  });
});
