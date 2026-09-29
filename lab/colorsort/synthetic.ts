/**
 * A painted shelf with known answers (ROADMAP 5.16): the tests measure the
 * detection against it, and the page offers it as a sample until a real
 * photo is at hand. It is kinder than a photo — straight spines, even light —
 * so passing on it is a floor, not a result.
 */

export interface SyntheticShelf {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  /** Per row: its band and the true lines between books, left to right. */
  rows: Array<{ y0: number; y1: number; cuts: number[]; colors: Array<[number, number, number]> }>;
}

const PALETTE: Array<[number, number, number]> = [
  [196, 40, 44], [226, 112, 36], [236, 196, 58], [66, 140, 72], [32, 92, 150],
  [96, 58, 140], [232, 128, 160], [240, 236, 224], [34, 32, 36], [128, 124, 120],
  [120, 72, 40], [20, 120, 130], [180, 200, 90], [150, 30, 70], [70, 90, 110],
];

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function syntheticShelf(width = 900, height = 620, rowCount = 2, seed = 7): SyntheticShelf {
  const random = rng(seed);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const put = (x: number, y: number, [r, g, b]: [number, number, number], shade = 1) => {
    const i = (y * width + x) * 4;
    const n = (random() - 0.5) * 10;
    rgba[i] = r * shade + n; rgba[i + 1] = g * shade + n; rgba[i + 2] = b * shade + n; rgba[i + 3] = 255;
  };
  const wall: [number, number, number] = [214, 206, 192];
  const board: [number, number, number] = [150, 110, 72];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) put(x, y, wall);

  const boardH = Math.round(height * 0.04);
  const rowH = Math.floor((height - boardH * (rowCount + 1)) / rowCount);
  const rows: SyntheticShelf['rows'] = [];
  for (let r = 0; r < rowCount; r++) {
    const y0 = boardH + r * (rowH + boardH), y1 = y0 + rowH;
    for (let y = y1; y < y1 + boardH && y < height; y++) for (let x = 0; x < width; x++) put(x, y, board);
    if (r === 0) for (let y = 0; y < boardH; y++) for (let x = 0; x < width; x++) put(x, y, board);
    const cuts: number[] = [];
    const colors: Array<[number, number, number]> = [];
    let x = Math.round(width * 0.02);
    cuts.push(x);
    while (x < width * 0.95) {
      const w = Math.round(rowH * (0.07 + random() * 0.12));
      if (x + w > width * 0.97) break;
      const color = PALETTE[Math.floor(random() * PALETTE.length)];
      const top = y1 - Math.round(rowH * (0.72 + random() * 0.26));
      const letter: [number, number, number] = color[0] + color[1] + color[2] > 380 ? [30, 30, 30] : [235, 225, 200];
      for (let yy = top; yy < y1; yy++) {
        for (let xx = x; xx < x + w; xx++) {
          // A dark seam between books, light falling off towards the edges,
          // and a line of "lettering" down the middle.
          const edge = xx - x < 2 || x + w - xx <= 2;
          const shade = edge ? 0.45 : 0.9 + 0.1 * Math.sin(((xx - x) / w) * Math.PI);
          const inText = Math.abs(xx - (x + w / 2)) < w * 0.18 && (yy - top) % 14 < 9 && yy > top + rowH * 0.15 && yy < y1 - rowH * 0.2;
          put(xx, yy, inText ? letter : color, shade);
        }
      }
      colors.push(color);
      x += w;
      cuts.push(x);
    }
    rows.push({ y0, y1, cuts, colors });
  }
  return { width, height, rgba, rows };
}
