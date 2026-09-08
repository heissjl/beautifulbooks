/**
 * The pure half of the mosaic experiment, on synthetic pictures only.
 *
 * Everything here is built in memory: a gradient stands in for a portrait and
 * flat rectangles stand in for covers, so the assertions are about the
 * algorithm and never about a book. No network, no fixtures, no decoding.
 */
import { describe, expect, it } from 'vitest';
import { assign, compose, paletteReport, patchesOf, resizeRgba, tileOf, type Tile } from '../mosaic';

interface Img { width: number; height: number; rgba: Uint8Array }

function flat(width: number, height: number, r: number, g = r, b = r): Img {
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) { rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255; }
  return { width, height, rgba };
}

/** Left-to-right ramp from `from` to `to`, the stand-in for a picture. */
function gradient(width: number, height: number, from = 0, to = 255): Img {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = Math.round(from + ((to - from) * x) / Math.max(1, width - 1));
      const p = (y * width + x) * 4;
      rgba[p] = v; rgba[p + 1] = v; rgba[p + 2] = v; rgba[p + 3] = 255;
    }
  }
  return { width, height, rgba };
}

/** `n` grey covers spread over [from, to]. */
function greyTiles(n: number, from: number, to: number, patch = 1): Tile[] {
  return Array.from({ length: n }, (_, i) => {
    const v = Math.round(from + ((to - from) * i) / Math.max(1, n - 1));
    return tileOf(`grey-${v}-${i}`, flat(4, 6, v), patch, patch);
  });
}

/** Mean luminance of the cover that landed in a cell. */
function chosen(tiles: readonly Tile[], id: string): number {
  return tiles.find(t => t.id === id)!.mean;
}

describe('reading a picture as cells', () => {
  it('measures each cell where it actually is', () => {
    const img: Img = { width: 2, height: 1, rgba: new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]) };
    const target = patchesOf(img, 2, 1, 1, 1);
    expect(target.cells).toHaveLength(2);
    expect(target.cells[0].mean).toBe(0);
    expect(target.cells[1].mean).toBe(255);
  });

  it('keeps the sub-grid, so a cell knows its own light and dark half', () => {
    const img: Img = { width: 2, height: 1, rgba: new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]) };
    const target = patchesOf(img, 1, 1, 2, 1);
    expect(Array.from(target.cells[0].lum)).toEqual([0, 255]);
    expect(target.cells[0].mean).toBeCloseTo(127.5, 5);
  });

  it('reads a cover as one patch on the same grid', () => {
    const tile = tileOf('red', flat(8, 12, 200, 40, 40), 1, 1);
    expect(Array.from(tile.rgb)).toEqual([200, 40, 40]);
    expect(tile.mean).toBeCloseTo((200 * 299 + 40 * 587 + 40 * 114) / 1000, 5);
  });
});

describe('assigning covers to cells', () => {
  it('follows the picture: darker cells get darker covers', () => {
    const target = patchesOf(gradient(64, 8), 8, 1, 1, 1);
    const tiles = greyTiles(8, 0, 255);
    const mosaic = assign(target, tiles, { minGap: 1, colourWeight: 0 });

    const means = mosaic.tiles.map(id => chosen(tiles, id));
    for (let i = 1; i < means.length; i++) expect(means[i]).toBeGreaterThan(means[i - 1]);
    expect(mosaic.relaxed).toBe(0);
  });

  it('never repeats a cover inside the gap', () => {
    const target = patchesOf(gradient(48, 48), 6, 6, 1, 1);
    const tiles = greyTiles(40, 0, 255);
    const mosaic = assign(target, tiles, { minGap: 1, colourWeight: 0 });

    for (let row = 0; row < mosaic.rows; row++) {
      for (let col = 0; col < mosaic.cols; col++) {
        const here = mosaic.tiles[row * mosaic.cols + col];
        for (const [dy, dx] of [[0, 1], [1, -1], [1, 0], [1, 1]]) {
          const y = row + dy, x = col + dx;
          if (y >= mosaic.rows || x < 0 || x >= mosaic.cols) continue;
          expect(mosaic.tiles[y * mosaic.cols + x]).not.toBe(here);
        }
      }
    }
  });

  it('fills every cell even when the gap leaves nothing, and says so', () => {
    const target = patchesOf(gradient(16, 16), 4, 4, 1, 1);
    const mosaic = assign(target, greyTiles(1, 128, 128), { minGap: 1 });

    expect(mosaic.tiles).toHaveLength(16);
    expect(mosaic.tiles.every(id => id.length > 0)).toBe(true);
    expect(mosaic.relaxed).toBeGreaterThan(0);
  });

  it('spreads the work: no cover carries the picture on its own', () => {
    const target = patchesOf(gradient(40, 40), 10, 10, 1, 1);
    const tiles = greyTiles(20, 0, 255);
    const mosaic = assign(target, tiles, { minGap: 1, colourWeight: 0, reusePenalty: 300 });

    const most = Math.max(...mosaic.usage.values());
    // A fair share is 5 cells of 100; without the penalty one grey takes dozens.
    expect(most).toBeLessThanOrEqual(12);
  });

  it('stretches a narrow palette onto the picture instead of flattening it', () => {
    // Every cover in this book is dark: 20 to 60 of 255, the awkward case.
    const target = patchesOf(gradient(64, 8), 16, 1, 1, 1);
    const tiles = greyTiles(8, 20, 60);
    // No reuse penalty, so only the picture decides. Without normalising,
    // every cell brighter than the palette wants the same brightest cover.
    const options = { minGap: 0, colourWeight: 0, reusePenalty: 0 };

    const plain = assign(target, tiles, { ...options, normalise: false });
    const stretched = assign(target, tiles, { ...options, normalise: true });

    // Half the book goes unused when the palette cannot reach the picture:
    // every cell brighter than 68 takes the same brightest cover.
    expect(new Set(plain.tiles).size).toBeLessThan(new Set(stretched.tiles).size);
    expect(new Set(stretched.tiles).size).toBe(8);

    const plainMeans = plain.tiles.map(id => chosen(tiles, id));
    const stretchedMeans = stretched.tiles.map(id => chosen(tiles, id));
    expect(plainMeans.at(-1)).toBe(plainMeans[plainMeans.length / 2]);
    expect(stretchedMeans.at(-1)).toBeGreaterThan(stretchedMeans[stretchedMeans.length / 2]);
  });

  it('refuses a target and tiles measured on different grids', () => {
    const target = patchesOf(gradient(16, 16), 4, 4, 2, 3);
    expect(() => assign(target, greyTiles(4, 0, 255, 1))).toThrow(/patch grid/);
  });

  it('refuses to build a mosaic out of nothing', () => {
    expect(() => assign(patchesOf(gradient(8, 8), 2, 2), [])).toThrow(/at least one tile/);
  });
});

describe('whether a book can carry a picture at all', () => {
  it('counts the cells no cover in the book can reach', () => {
    const target = patchesOf(gradient(64, 8), 32, 1, 1, 1);
    const report = paletteReport(target, greyTiles(8, 100, 150));

    expect(report.tiles).toBe(8);
    expect(report.cells).toBe(32);
    expect(report.tileLum.min).toBeCloseTo(100, 0);
    expect(report.tileLum.max).toBeCloseTo(150, 0);
    expect(report.outOfRange).toBeGreaterThan(0.5);
    // Stretching the palette is exactly what buys those cells back.
    expect(report.outOfRangeNormalised).toBeLessThan(report.outOfRange);
  });
});

describe('drawing the result', () => {
  it('averages when it scales a cover down', () => {
    const img: Img = { width: 2, height: 1, rgba: new Uint8Array([0, 0, 0, 255, 100, 100, 100, 255]) };
    const small = resizeRgba(img, 1, 1);
    expect(Array.from(small.rgba)).toEqual([50, 50, 50, 255]);
  });

  it('puts each chosen cover in its own cell', () => {
    const target = patchesOf(gradient(4, 2), 2, 1, 1, 1);
    const tiles = [tileOf('black', flat(4, 6, 0), 1, 1), tileOf('white', flat(4, 6, 255), 1, 1)];
    const mosaic = assign(target, tiles, { minGap: 1, colourWeight: 0 });
    const images = new Map([['black', flat(4, 6, 0)], ['white', flat(4, 6, 255)]]);

    const out = compose(mosaic, images, { cellWidth: 3, cellHeight: 5 });
    expect(out.width).toBe(6);
    expect(out.height).toBe(5);
    expect(out.rgba[0]).toBe(0);
    expect(out.rgba[3 * 4]).toBe(255);
  });

  it('lays the picture over the tiles only as far as it is told to', () => {
    const target = patchesOf(gradient(4, 2), 2, 1, 1, 1);
    const tiles = [tileOf('black', flat(4, 6, 0), 1, 1), tileOf('white', flat(4, 6, 255), 1, 1)];
    const mosaic = assign(target, tiles, { minGap: 1, colourWeight: 0 });
    const images = new Map([['black', flat(4, 6, 0)], ['white', flat(4, 6, 255)]]);

    const none = compose(mosaic, images, { cellWidth: 2, cellHeight: 2, blend: 0, target: flat(4, 4, 128) });
    const half = compose(mosaic, images, { cellWidth: 2, cellHeight: 2, blend: 0.5, target: flat(4, 4, 128) });
    expect(none.rgba[0]).toBe(0);
    expect(half.rgba[0]).toBe(64);
  });

  it('says which cover it is missing rather than drawing a hole', () => {
    const target = patchesOf(gradient(4, 2), 2, 1, 1, 1);
    const tiles = [tileOf('black', flat(4, 6, 0), 1, 1), tileOf('white', flat(4, 6, 255), 1, 1)];
    const mosaic = assign(target, tiles, { minGap: 1, colourWeight: 0 });

    expect(() => compose(mosaic, new Map([['black', flat(4, 6, 0)]]), { cellWidth: 2, cellHeight: 2 }))
      .toThrow(/no image for tile/);
  });
});
