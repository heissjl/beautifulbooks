/**
 * Books as turned rectangles (ROADMAP 5.16, Julian 2026-09-29: „teilweise
 * liegen die bücher ja auch oder sind schief im regal. die segmentierung
 * sollte hier deutlich genauer sein").
 *
 * An upright box cannot describe a book that leans or lies: it takes in the
 * neighbours and the wall, and a search for vertical lines finds nothing on
 * a slanted spine. So a book is its centre line — foot to head — and its
 * thickness across that line, as the image model gives it, and the two long
 * edges are searched *across the book's own direction*, trying small turns
 * of the line as well. Pure; runs in the browser and in tests.
 */
import { kmeans, hex, rgbToOklab, toLch, type Oklab, type SpineColor } from './color';
import type { LabImage } from './spines';

/** In pixels. `angle` is the direction of the long side, in radians (either way along it). */
export interface OrientedBox { cx: number; cy: number; angle: number; length: number; thickness: number }

export function fromAxis(ax: number, ay: number, bx: number, by: number, thickness: number): OrientedBox {
  return {
    cx: (ax + bx) / 2, cy: (ay + by) / 2,
    angle: Math.atan2(by - ay, bx - ax),
    length: Math.hypot(bx - ax, by - ay),
    thickness,
  };
}

/** The four corners, for drawing and for the enclosing upright box. */
export function corners(b: OrientedBox): Array<[number, number]> {
  const ux = Math.cos(b.angle), uy = Math.sin(b.angle);
  const nx = -uy, ny = ux;
  const hl = b.length / 2, ht = b.thickness / 2;
  return [[-hl, -ht], [hl, -ht], [hl, ht], [-hl, ht]].map(([s, d]) => [b.cx + ux * s + nx * d, b.cy + uy * s + ny * d]);
}

/** Degrees from upright: 0 standing, 90 lying. */
export function tilt(b: OrientedBox): number {
  const deg = Math.abs((b.angle * 180) / Math.PI) % 180;
  return Math.abs(90 - deg);
}

function at(img: LabImage, x: number, y: number): number {
  const xi = Math.min(img.width - 1, Math.max(0, Math.round(x)));
  const yi = Math.min(img.height - 1, Math.max(0, Math.round(y)));
  return (yi * img.width + xi) * 3;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((p, r) => p - r);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

/** As in spines.ts: a line between books must be there along four fifths of the book. */
const LINE_QUANTILE = 0.2;

/**
 * How strongly the colour changes across a line parallel to the book's axis,
 * `offset` pixels to the side of its centre line, turned by `angle`.
 */
function lineStrength(img: LabImage, b: OrientedBox, angle: number, offset: number): number {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const nx = -uy, ny = ux;
  const hl = b.length * 0.4;
  const step = Math.max(1, hl / 60);
  const values: number[] = [];
  const d = img.data;
  for (let s = -hl; s <= hl; s += step) {
    const x = b.cx + ux * s + nx * offset, y = b.cy + uy * s + ny * offset;
    if (x < 1 || y < 1 || x > img.width - 2 || y > img.height - 2) continue;
    const p = at(img, x - nx * 1.5, y - ny * 1.5), q = at(img, x + nx * 1.5, y + ny * 1.5);
    values.push(Math.hypot(d[p] - d[q], d[p + 1] - d[q + 1], d[p + 2] - d[q + 2]));
  }
  return quantile(values, LINE_QUANTILE);
}

export interface Refined { box: OrientedBox; moved: boolean; edges: 0 | 1 | 2 }

/**
 * Moves the two long edges onto lines across the book. Every line within
 * `reach` thicknesses of the model's rectangle is a candidate; the pair that
 * is strong and keeps closest to the model's centre and thickness wins —
 * searching each edge on its own failed when the model drew the book too
 * thin, because the far edge then lay outside its window. The model's angle
 * and turns of it up to ±8° are tried. Without a pair, one strong edge and
 * the model's thickness; without either, the model's rectangle unchanged.
 */
export function refineOriented(img: LabImage, b: OrientedBox, reach = 0.6): Refined {
  const t = b.thickness;
  if (t < 3 || b.length < 10) return { box: b, moved: false, edges: 0 };
  const r = Math.max(4, t * reach);
  type Pick = { angle: number; left: number; right: number; score: number; edges: 0 | 1 | 2 };
  let best: Pick | null = null;
  // ±8°: on a painted test shelf with real titles the model gave leaning books 6–7° too little lean.
  for (const turn of [-8, -6, -4, -2, 0, 2, 4, 6, 8]) {
    const angle = b.angle + (turn * Math.PI) / 180;
    const offsets: number[] = [], raw: number[] = [];
    for (let o = -t / 2 - r; o <= t / 2 + r; o += 1) { offsets.push(o); raw.push(lineStrength(img, b, angle, o)); }
    const prof = raw.map((v, i) => (raw[Math.max(0, i - 1)] + 2 * v + raw[Math.min(raw.length - 1, i + 1)]) / 4);
    const m = quantile(prof, 0.5);
    const mad = quantile(prof.map(v => Math.abs(v - m)), 0.5);
    const threshold = Math.max(0.02, m + 3 * Math.max(mad, 0.002));
    const lines: number[] = [];
    for (let i = 1; i < prof.length - 1; i++) {
      if (prof[i] >= threshold && prof[i] >= prof[i - 1] && prof[i] >= prof[i + 1]) lines.push(i);
    }
    // How far a candidate strays from the model, in thicknesses; strength buys some of it back.
    const penalty = (left: number, right: number) => Math.abs((left + right) / 2) / t + Math.abs(right - left - t) / t;
    const consider = (p: Pick) => { if (!best || p.score > best.score) best = p; };
    for (const i of lines) for (const j of lines) {
      const left = offsets[i], right = offsets[j];
      if (right - left < t * 0.5 || right - left > t * 1.6) continue;
      consider({ angle, left, right, edges: 2, score: 2 + (prof[i] + prof[j]) * 4 - penalty(left, right) - Math.abs(turn) * 0.01 });
    }
    for (const i of lines) {
      const o = offsets[i];
      // One edge: keep the model's thickness on the side away from it.
      const [left, right] = o < 0 ? [o, o + t] : [o - t, o];
      if (Math.abs(o) < t * 0.2) continue;
      consider({ angle, left, right, edges: 1, score: 1 + prof[i] * 4 - penalty(left, right) - Math.abs(turn) * 0.01 });
    }
  }
  const chosen = best as Pick | null;
  if (!chosen) return { box: b, moved: false, edges: 0 };
  const shift = (chosen.left + chosen.right) / 2;
  const nx = -Math.sin(chosen.angle), ny = Math.cos(chosen.angle);
  return {
    box: { cx: b.cx + nx * shift, cy: b.cy + ny * shift, angle: chosen.angle, length: b.length, thickness: chosen.right - chosen.left },
    moved: true,
    edges: chosen.edges,
  };
}

/**
 * The book's colour from inside its turned rectangle: the inner 70 % across
 * (the edges carry the seam and the shadow) and 84 % along (foot and head
 * carry the board and the gap above), three clusters, the largest wins.
 */
export function orientedColor(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, b: OrientedBox, samples = 1500): SpineColor {
  const ux = Math.cos(b.angle), uy = Math.sin(b.angle);
  const nx = -uy, ny = ux;
  const hl = b.length * 0.42, ht = b.thickness * 0.35;
  const ratio = Math.max(1, hl / Math.max(ht, 0.5));
  const across = Math.max(2, Math.round(Math.sqrt(samples / ratio)));
  const along = Math.max(2, Math.round(samples / across));
  const points: Oklab[] = [];
  for (let i = 0; i < along; i++) {
    const s = -hl + (2 * hl * i) / (along - 1);
    for (let j = 0; j < across; j++) {
      const d = -ht + (2 * ht * j) / (across - 1);
      const x = Math.round(b.cx + ux * s + nx * d), y = Math.round(b.cy + uy * s + ny * d);
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const k = (y * width + x) * 4;
      points.push(rgbToOklab(rgba[k], rgba[k + 1], rgba[k + 2]));
    }
  }
  const clusters = kmeans(points, 3);
  const total = points.length || 1;
  const main = clusters[0]?.centre ?? { L: 0, a: 0, b: 0 };
  return {
    hex: hex(main), lab: main, lch: toLch(main),
    share: (clusters[0]?.size ?? 0) / total,
    clusters: clusters.map(c => ({ hex: hex(c.centre), lab: c.centre, share: c.size / total })),
  };
}
