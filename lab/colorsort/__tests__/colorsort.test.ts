import { describe, expect, it } from 'vitest';
import { hex, rgbToOklab, spineColor, toLch } from '../color';
import { findRowCuts, findSpineCuts, rowsFromCuts, spinesFromCuts, toLabImage } from '../spines';
import { DEFAULTS, groupOf, layout, sortBooks, unmoved, type Book } from '../sort';
import { syntheticShelf } from '../synthetic';

const lch = (r: number, g: number, b: number) => toLch(rgbToOklab(r, g, b));

describe('colour', () => {
  it('round-trips sRGB through OKLab', () => {
    expect(hex(rgbToOklab(196, 40, 44))).toBe('#c4282c');
    expect(hex(rgbToOklab(255, 255, 255))).toBe('#ffffff');
  });

  it('takes the cloth, not the lettering', () => {
    const w = 40, h = 200;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const text = x > 16 && x < 24 && y % 20 < 10;
      rgba.set(text ? [240, 230, 200, 255] : [32, 92, 150, 255], i);
    }
    const c = spineColor(rgba, w, { x0: 0, y0: 0, x1: w, y1: h });
    expect(c.hex).toBe('#205c96');
    expect(c.share).toBeGreaterThan(0.7);
  });
});

describe('detection on the painted shelf', () => {
  const shelf = syntheticShelf();
  const img = toLabImage(shelf.rgba, shelf.width, shelf.height);
  const rows = rowsFromCuts(findRowCuts(img), shelf.height);

  it('finds both rows', () => {
    expect(rows).toHaveLength(2);
    rows.forEach((row, r) => {
      expect(Math.abs(row.y0 - shelf.rows[r].y0)).toBeLessThan(8);
      expect(Math.abs(row.y1 - shelf.rows[r].y1)).toBeLessThan(8);
    });
  });

  it('finds the lines between books within three pixels', () => {
    rows.forEach((row, r) => {
      const found = findSpineCuts(img, row);
      const truth = shelf.rows[r].cuts;
      const hit = truth.filter(t => found.some(f => Math.abs(f - t) <= 3));
      expect(hit.length / truth.length).toBeGreaterThanOrEqual(0.95);
      expect(found.length - hit.length).toBeLessThanOrEqual(1);
    });
  });

  it('reads each book as its painted colour', () => {
    const row = rows[0];
    const boxes = spinesFromCuts(findSpineCuts(img, row), row, shelf.width)
      .filter(b => b.x0 >= shelf.rows[0].cuts[0] - 3 && b.x1 <= shelf.rows[0].cuts.at(-1)! + 3);
    boxes.forEach((box, i) => {
      const c = spineColor(shelf.rgba, shelf.width, box);
      const truth = rgbToOklab(...shelf.rows[0].colors[i]);
      // shaded by up to 10 % towards the edges, hence the tolerance
      expect(Math.hypot(c.lab.L - truth.L, c.lab.a - truth.a, c.lab.b - truth.b)).toBeLessThan(0.06);
    });
  });
});

describe('order', () => {
  const book = (id: number, rgb: [number, number, number], row = 0, width = 30): Book =>
    ({ id, row, pos: id, width, lch: lch(...rgb) });

  it('puts whites first, colours round the circle, blacks last', () => {
    const books = [
      book(0, [34, 32, 36]), book(1, [32, 92, 150]), book(2, [240, 236, 224]),
      book(3, [196, 40, 44]), book(4, [236, 196, 58]), book(5, [66, 140, 72]), book(6, [128, 124, 120]),
    ];
    expect(sortBooks(books).map(b => b.id)).toEqual([2, 3, 4, 5, 1, 6, 0]);
  });

  it('calls a grey neutral and a muted red a colour', () => {
    expect(groupOf(lch(128, 124, 120))).toBe('dark');
    expect(groupOf(lch(150, 90, 85))).toBe('colour');
  });

  it('sorts light to dark inside a hue bucket', () => {
    const books = [book(0, [90, 20, 25]), book(1, [230, 90, 95]), book(2, [196, 40, 44])];
    expect(sortBooks(books).map(b => b.id)).toEqual([1, 2, 0]);
  });

  it('refills rows up to what each held', () => {
    const books = Array.from({ length: 6 }, (_, i) => book(i, [200, 40, 40], i < 3 ? 0 : 1));
    const placed = layout(books, [90, 90]);
    expect(placed.map(p => p.row)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(unmoved(placed.map(p => ({ ...p, book: { ...p.book, pos: p.book.id % 3 } })))).toBe(6);
    expect(layout(books, [60, 60]).map(p => p.row)).toEqual([0, 0, 1, 1, 1, 1]);
  });

  it('light-dark ignores hue', () => {
    const books = [book(0, [34, 32, 36]), book(1, [236, 196, 58]), book(2, [32, 92, 150])];
    expect(sortBooks(books, { ...DEFAULTS, mode: 'light-dark' }).map(b => b.id)).toEqual([1, 2, 0]);
  });
});
