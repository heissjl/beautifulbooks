/**
 * What the pool script measures on a cover's L image besides its size
 * (ROADMAP 5.8a). Pure: the caller decodes (lib/imagehash.ts `decode`).
 *
 * The index holds only a 64-pixel colour summary and a luminance mean, and on
 * those a minimalist white design and a scanned title page look alike, as do a
 * Reclam booklet and a yellow illustrated cover. Measured on the large image,
 * two shares separate them well enough for a game (Julian, 2026-09-11: "wir
 * brauchen noch bessere regeln gegen weiße cover, seiten-scans und wir sollten
 * klassische reclam-cover ausschließen"). Thresholds are in `pool.ts`, set by
 * looking at contact sheets sorted by these numbers.
 *
 * A third number, the count of ink bands down the page, was tried for text
 * pages and dropped: patterned designs (*Middlemarch*, *Hitchhiker*) scored as
 * high as a page of prose.
 */

export interface CoverMeasure {
  width: number;
  height: number;
  /** Share of the image that is paper: light (luminance ≥ 200) and nearly colourless (saturation ≤ 0.18). */
  white: number;
  /** Share in the yellow of Reclam's Universal-Bibliothek: hue 40–65°, saturation ≥ 0.55, value ≥ 0.7. */
  yellow: number;
  /**
   * How soft the scan is, 0 (sharp) to 1 (no edges at all): `blurOf`. Absent
   * on the measures taken before 2026-09-26, which is why the gate on it
   * applies only to covers a pool adds, never to one it keeps.
   */
  blur?: number;
}

/** Measured on a copy this many pixels tall, averaged, so a scan's grain does not count. */
const ROWS = 300;

const round3 = (x: number) => Math.round(x * 1000) / 1000;

function hueDegrees(r: number, g: number, b: number, max: number, delta: number): number {
  let hue: number;
  if (max === r) hue = ((g - b) / delta + 6) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return hue * 60;
}

/** Width of the box filter `blurOf` re-blurs with, in pixels of the L image. */
const BLUR_BOX = 9;

/**
 * The no-reference blur measure of Crete et al. (2007), on luminance at the
 * image's own resolution: blur the image once more with a 9-pixel box, and see
 * how much of the difference between neighbouring pixels survives. A sharp
 * scan loses most of it; a scan that was soft already, or blown up from a
 * small original, has little left to lose. Taken along both axes, the worse
 * one counts. 0 is sharp, 1 has no edges at all.
 *
 * Added 2026-09-26 for the covers that grew the game to 2000 (ROADMAP 5.8a):
 * the height rule lets through an L image of 500 px that was enlarged from a
 * thumbnail, and on a sample of the 1000-cover pool the softest scans, looked
 * at at full size, were exactly the ones this number put last.
 */
export function blurOf({ width, height, rgba }: { width: number; height: number; rgba: Uint8Array }): number {
  const grey = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    grey[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  const half = Math.floor(BLUR_BOX / 2);
  let worst = 0;
  for (const vertical of [true, false]) {
    const along = vertical ? height : width;
    const across = vertical ? width : height;
    const at = (a: number, c: number) => (vertical ? a * width + c : c * width + a);
    let sumF = 0;
    let sumV = 0;
    const line = new Float64Array(along);
    const blurred = new Float64Array(along);
    for (let c = 0; c < across; c++) {
      for (let a = 0; a < along; a++) line[a] = grey[at(a, c)];
      // Box blur with the edge pixel repeated, as a running sum.
      let run = 0;
      for (let k = -half; k <= half; k++) run += line[Math.min(along - 1, Math.max(0, k))];
      for (let a = 0; a < along; a++) {
        blurred[a] = run / BLUR_BOX;
        run += line[Math.min(along - 1, a + half + 1)] - line[Math.max(0, a - half)];
      }
      for (let a = 1; a < along; a++) {
        const dF = Math.abs(line[a] - line[a - 1]);
        const dB = Math.abs(blurred[a] - blurred[a - 1]);
        sumF += dF;
        sumV += Math.max(0, dF - dB);
      }
    }
    worst = Math.max(worst, sumF > 0 ? (sumF - sumV) / sumF : 1);
  }
  return worst;
}

export function measureCover({ width, height, rgba }: { width: number; height: number; rgba: Uint8Array }): CoverMeasure {
  const h = Math.min(ROWS, height);
  const w = Math.max(1, Math.round((width * h) / height));
  let white = 0;
  let yellow = 0;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / w));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = y0; sy < y1; sy++) {
        for (let sx = x0; sx < x1; sx++) {
          const p = (sy * width + sx) * 4;
          r += rgba[p];
          g += rgba[p + 1];
          b += rgba[p + 2];
        }
      }
      const n = (y1 - y0) * (x1 - x0);
      r /= n;
      g /= n;
      b /= n;
      const max = Math.max(r, g, b);
      const delta = max - Math.min(r, g, b);
      const saturation = max === 0 ? 0 : delta / max;
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminance >= 200 && saturation <= 0.18) white++;
      if (delta > 0 && saturation >= 0.55 && max >= 0.7 * 255) {
        const hue = hueDegrees(r, g, b, max, delta);
        if (hue >= 40 && hue <= 65) yellow++;
      }
    }
  }
  const total = w * h;
  return { width, height, white: round3(white / total), yellow: round3(yellow / total), blur: round3(blurOf({ width, height, rgba })) };
}
