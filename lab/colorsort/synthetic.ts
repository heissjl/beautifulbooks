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

/**
 * Books standing, leaning and lying, painted as turned rectangles with known
 * geometry (ROADMAP 5.16): a group standing close together, three leaning
 * against each other and a stack lying flat, as on a real shelf.
 */
export interface PaintedBook { cx: number; cy: number; angle: number; length: number; thickness: number; color: [number, number, number] }

export function orientedScene(seed = 3, width = 900, height = 520): { width: number; height: number; rgba: Uint8ClampedArray; books: PaintedBook[] } {
  const random = rng(seed);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const n = (random() - 0.5) * 8;
    rgba[i * 4] = 214 + n; rgba[i * 4 + 1] = 206 + n; rgba[i * 4 + 2] = 192 + n; rgba[i * 4 + 3] = 255;
  }
  const books: PaintedBook[] = [];
  const pick = () => PALETTE[Math.floor(random() * PALETTE.length)];
  const up = -Math.PI / 2; // foot at the bottom, head at the top
  const base = height - 40;
  // Standing, touching.
  let x = 40;
  for (let i = 0; i < 6; i++) {
    const t = 24 + Math.round(random() * 20), l = 300 + Math.round(random() * 110);
    books.push({ cx: x + t / 2, cy: base - l / 2, angle: up, length: l, thickness: t, color: pick() });
    x += t;
  }
  // Leaning to the right, each against the next: parallel, one thickness apart.
  x += 40;
  const lean = ((12 + random() * 10) * Math.PI) / 180;
  const angle = up + lean;
  const nx = Math.cos(lean), ny = Math.sin(lean); // across the books, to the right
  let prev: PaintedBook | null = null;
  for (let i = 0; i < 3; i++) {
    const t = 26 + Math.round(random() * 14), l = 320;
    const book: PaintedBook = prev
      ? { cx: prev.cx + nx * ((prev.thickness + t) / 2), cy: prev.cy + ny * ((prev.thickness + t) / 2), angle, length: l, thickness: t, color: pick() }
      : { cx: x + t / 2 + (Math.sin(lean) * l) / 2, cy: base - (Math.cos(lean) * l) / 2, angle, length: l, thickness: t, color: pick() };
    books.push(book);
    prev = book;
  }
  x = prev!.cx + 200;
  // A stack lying flat, touching.
  let y = base;
  for (let i = 0; i < 5; i++) {
    const t = 22 + Math.round(random() * 16), l = 250 + Math.round(random() * 60);
    books.push({ cx: x + l / 2, cy: y - t / 2, angle: 0, length: l, thickness: t, color: pick() });
    y -= t;
  }
  for (const b of books) paintBook(rgba, width, height, b, random);
  return { width, height, rgba, books };
}

function paintBook(rgba: Uint8ClampedArray, width: number, height: number, b: PaintedBook, random: () => number) {
  const ux = Math.cos(b.angle), uy = Math.sin(b.angle), nx = -uy, ny = ux;
  const r = Math.hypot(b.length, b.thickness) / 2 + 2;
  const letter: [number, number, number] = b.color[0] + b.color[1] + b.color[2] > 380 ? [30, 30, 30] : [235, 225, 200];
  for (let y = Math.max(0, Math.floor(b.cy - r)); y < Math.min(height, b.cy + r); y++) {
    for (let x = Math.max(0, Math.floor(b.cx - r)); x < Math.min(width, b.cx + r); x++) {
      const dx = x + 0.5 - b.cx, dy = y + 0.5 - b.cy;
      const s = dx * ux + dy * uy, d = dx * nx + dy * ny;
      if (Math.abs(s) > b.length / 2 || Math.abs(d) > b.thickness / 2) continue;
      const edge = b.thickness / 2 - Math.abs(d) < 1.5;
      const inText = Math.abs(d) < b.thickness * 0.18 && Math.abs(s) < b.length * 0.3 && ((s + 1000) % 14) < 9;
      const c = inText ? letter : b.color;
      const shade = edge ? 0.5 : 1;
      const n = (random() - 0.5) * 10;
      const i = (y * width + x) * 4;
      rgba[i] = c[0] * shade + n; rgba[i + 1] = c[1] * shade + n; rgba[i + 2] = c[2] * shade + n;
    }
  }
}
