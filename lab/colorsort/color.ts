/**
 * The colour of one spine (ROADMAP 5.16). Pure, runs in the browser and in
 * tests.
 *
 * Colours are compared in OKLab, where equal distances look roughly equally
 * different, and sorted in its polar form OKLCh (lightness, chroma, hue).
 * A spine's colour is the largest of three k-means clusters over its pixels:
 * lettering and a publisher's logo are small, the cloth or paper around them
 * is large. That is a rule set, not measured — see README, open points.
 */

export interface Oklab { L: number; a: number; b: number }
export interface Oklch { L: number; C: number; h: number }

export interface SpineColor {
  hex: string;
  lab: Oklab;
  lch: Oklch;
  /** Share of the sampled pixels in the winning cluster, 0..1. */
  share: number;
  /** Every cluster, largest first — the second one shows a two-colour spine. */
  clusters: Array<{ hex: string; lab: Oklab; share: number }>;
}

function toLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function fromLinear(v: number): number {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

/** sRGB bytes to OKLab (Björn Ottosson's matrices). */
export function rgbToOklab(r: number, g: number, b: number): Oklab {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToRgb({ L, a, b }: Oklab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export function toLch({ L, a, b }: Oklab): Oklch {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

export function hex(lab: Oklab): string {
  return `#${oklabToRgb(lab).map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

export function distance(p: Oklab, q: Oklab): number {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b);
}

/** Small deterministic generator, so the same photo always gives the same order. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** k-means with k-means++ seeding; returns centres and sizes, largest first. */
export function kmeans(points: Oklab[], k: number, iterations = 12, seed = 1): Array<{ centre: Oklab; size: number }> {
  if (points.length === 0) return [];
  const random = rng(seed);
  const centres: Oklab[] = [points[Math.floor(random() * points.length)]];
  while (centres.length < Math.min(k, points.length)) {
    const d2 = points.map(p => Math.min(...centres.map(c => distance(p, c) ** 2)));
    const total = d2.reduce((s, v) => s + v, 0);
    if (total === 0) break;
    let pick = random() * total;
    let i = 0;
    while (pick > d2[i] && i < points.length - 1) pick -= d2[i++];
    centres.push(points[i]);
  }
  const assign = new Int32Array(points.length);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < points.length; i++) {
      let best = 0, bestD = Infinity;
      for (let c = 0; c < centres.length; c++) {
        const d = distance(points[i], centres[c]);
        if (d < bestD) { bestD = d; best = c; }
      }
      assign[i] = best;
    }
    const sums = centres.map(() => ({ L: 0, a: 0, b: 0, n: 0 }));
    for (let i = 0; i < points.length; i++) {
      const s = sums[assign[i]];
      s.L += points[i].L; s.a += points[i].a; s.b += points[i].b; s.n++;
    }
    for (let c = 0; c < centres.length; c++) {
      const s = sums[c];
      if (s.n > 0) centres[c] = { L: s.L / s.n, a: s.a / s.n, b: s.b / s.n };
    }
  }
  const sizes = centres.map(() => 0);
  for (let i = 0; i < points.length; i++) sizes[assign[i]]++;
  return centres.map((centre, i) => ({ centre, size: sizes[i] })).filter(c => c.size > 0).sort((p, q) => q.size - p.size);
}

export interface Region { x0: number; y0: number; x1: number; y1: number }

/**
 * The colour of a spine inside `region` of an RGBA image. The outer 15 % on
 * each side and 8 % at top and bottom are left out: that is where the gap to
 * the neighbour, its shadow and the shelf board fall.
 */
export function spineColor(rgba: Uint8Array | Uint8ClampedArray, width: number, region: Region, maxSamples = 1500): SpineColor {
  const w = region.x1 - region.x0, h = region.y1 - region.y0;
  const x0 = Math.round(region.x0 + w * 0.15), x1 = Math.max(x0 + 1, Math.round(region.x1 - w * 0.15));
  const y0 = Math.round(region.y0 + h * 0.08), y1 = Math.max(y0 + 1, Math.round(region.y1 - h * 0.08));
  const area = (x1 - x0) * (y1 - y0);
  const step = Math.max(1, Math.round(Math.sqrt(area / maxSamples)));
  const points: Oklab[] = [];
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const i = (y * width + x) * 4;
      points.push(rgbToOklab(rgba[i], rgba[i + 1], rgba[i + 2]));
    }
  }
  const clusters = kmeans(points, 3);
  const total = points.length || 1;
  const main = clusters[0]?.centre ?? { L: 0, a: 0, b: 0 };
  return {
    hex: hex(main),
    lab: main,
    lch: toLch(main),
    share: (clusters[0]?.size ?? 0) / total,
    clusters: clusters.map(c => ({ hex: hex(c.centre), lab: c.centre, share: c.size / total })),
  };
}
