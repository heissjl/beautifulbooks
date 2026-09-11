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
  return { width, height, white: round3(white / total), yellow: round3(yellow / total) };
}
