import { describe, expect, it } from 'vitest';
import { PIN_MARGIN, PIN_SIZE, pinCount, pinLayout, pinTitleLines, pinTitleSize, type Rect } from '../pinlayout';

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe.each([9, 6] as const)('a pin with %i covers (ROADMAP 5.5a)', count => {
  const L = pinLayout(count);

  it('is 2:3 and holds 2:3 tiles inside the canvas, none overlapping', () => {
    expect(L.width).toBe(PIN_SIZE.width);
    expect(L.height).toBe(PIN_SIZE.height);
    expect(L.width * 3).toBe(L.height * 2);
    expect(L.tiles).toHaveLength(count);
    for (const t of L.tiles) {
      expect(t.width * 3).toBe(t.height * 2);
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + t.width).toBeLessThanOrEqual(L.width);
      expect(t.y).toBeGreaterThanOrEqual(L.head.y + L.head.height);
      expect(t.y + t.height).toBeLessThanOrEqual(L.foot.y);
    }
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) expect(overlaps(L.tiles[i], L.tiles[j])).toBe(false);
  });

  it('runs row by row, three across, centred', () => {
    expect(L.tiles[1].x).toBeGreaterThan(L.tiles[0].x);
    expect(L.tiles[2].y).toBe(L.tiles[0].y);
    expect(L.tiles[3].y).toBeGreaterThan(L.tiles[0].y);
    const left = L.tiles[0].x;
    const right = L.width - (L.tiles[2].x + L.tiles[2].width);
    expect(Math.abs(left - right)).toBeLessThanOrEqual(1);
  });

  it('leaves the head two lines of the title and a line under it, and the foot the site line', () => {
    expect(L.head.y).toBeGreaterThan(0);
    expect(L.titleLines).toBe(2);
    expect(L.head.height).toBeGreaterThanOrEqual(2 * L.type.title * 1.1 + L.type.line * 1.3);
    expect(L.foot.y + L.foot.height).toBe(L.height - L.head.y);
    expect(L.foot.height).toBeGreaterThanOrEqual(L.type.site * 1.4);
    expect(L.head.x).toBe(PIN_MARGIN);
    expect(L.head.width).toBe(L.width - 2 * PIN_MARGIN);
  });
});

it('a one-line title hands its second line to the covers', () => {
  const two = pinLayout(9);
  const one = pinLayout(9, { titleLines: 1 });
  expect(one.head.height).toBeLessThan(two.head.height);
  expect(one.head.height).toBeGreaterThanOrEqual(one.type.title * 1.1 + one.type.line * 1.3);
  expect(one.tiles[0].height).toBeGreaterThan(two.tiles[0].height);
  expect(one.foot.y + one.foot.height).toBe(two.foot.y + two.foot.height);
});

describe('pinTitleLines', () => {
  it('reserves one line for a short title and two for a long one, erring towards two', () => {
    expect(pinTitleLines('Dune')).toBe(1);
    expect(pinTitleLines('Nineteen Eighty-Four')).toBe(1);
    expect(pinTitleLines('The Fellowship of the Ring')).toBe(1);
    expect(pinTitleLines("Harry Potter and the Philosopher's Stone")).toBe(2);
    expect(pinTitleLines('SF Masterworks')).toBe(1);
    // 29 letters at 60 px: about 780 px in Xanh, but the estimate keeps two lines.
    expect(pinTitleLines('The Left Hand of Darkness and')).toBe(2);
  });
});

it('six covers come out larger than nine', () => {
  expect(pinLayout(6).tiles[0].width).toBeGreaterThan(pinLayout(9).tiles[0].width);
});

it('a credits line takes its room from the covers, not from the title', () => {
  const plain = pinLayout(9);
  const credited = pinLayout(9, { credits: true });
  expect(credited.foot.height).toBeGreaterThan(plain.foot.height);
  expect(credited.head.y).toBe(plain.head.y);
  expect(credited.tiles[0].height).toBeLessThan(plain.tiles[0].height);
});

describe('pinTitleSize', () => {
  it('sets a short title larger and a long one smaller, never larger than its ceiling allows', () => {
    expect(pinTitleSize('Dune')).toBe(72);
    expect(pinTitleSize('Nineteen Eighty-Four')).toBe(72);
    expect(pinTitleSize('Dune')).toBeGreaterThan(pinTitleSize("Harry Potter and the Philosopher's Stone"));
    expect(pinTitleSize("Harry Potter and the Philosopher's Stone")).toBe(60);
    expect(pinTitleSize('The Hitchhiker’s Guide to the Galaxy and Other Stories')).toBeLessThan(60);
    expect(pinTitleSize('A very long title that no cover would carry on one line, let alone two of them')).toBeLessThan(pinTitleSize('The Hitchhiker’s Guide to the Galaxy and Other Stories'));
  });
});

describe('pinCount', () => {
  it('draws nine, six, or nothing — never a half row', () => {
    expect(pinCount(14)).toBe(9);
    expect(pinCount(9)).toBe(9);
    expect(pinCount(8)).toBe(6);
    expect(pinCount(6)).toBe(6);
    expect(pinCount(5)).toBe(0);
    expect(pinCount(0)).toBe(0);
  });
});
