import { mosaicTileSrc } from '@/lib/coverurl';
import { dhash, luminanceOf, pickDistinct, toGray } from '@/lib/dhash';
import { fitsMosaicTile } from '@/lib/imagesig';
import { SAME_COVER_MAX_DISTANCE } from '@/lib/works';

/** How long one image may take before it counts as unreadable. */
const HASH_TIMEOUT_MS = 4000;

/** What a card needs to know about one candidate image. */
export interface TileReading {
  /** Structure hash, or null when the image could not be read. */
  hash: string | null;
  /** False for an image that does not fill an upright tile, or looks like a blank page (ROADMAP 6.70). */
  fits: boolean;
}

/**
 * The structure hash of one image, read through a canvas (ROADMAP 6.34), and
 * whether it belongs at the front of a mosaic (6.70).
 *
 * The images come through our own `/img` route, so they are same-origin and a
 * canvas may read them; a foreign address taints the canvas, `getImageData`
 * throws, and the answer is `{ hash: null, fits: true }` — which keeps the
 * image where it was. The address is the one the tile will ask for, so the
 * tile then finds the image in the browser's cache and nothing is fetched
 * twice.
 */
export function readCoverImage(src: string): Promise<TileReading> {
  const unread: TileReading = { hash: null, fits: true };
  return new Promise(resolve => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(unread), HASH_TIMEOUT_MS);
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context || canvas.width < 2 || canvas.height < 2) return resolve(unread);
        context.drawImage(img, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        const gray = toGray({ width: canvas.width, height: canvas.height, rgba: data });
        const hash = dhash(gray);
        const fits = fitsMosaicTile(canvas.width, canvas.height, { hash, ...luminanceOf(gray) });
        resolve({ hash, fits });
      } catch {
        resolve(unread);
      }
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(unread);
    };
    img.src = src;
  });
}

/**
 * The first `limit` covers of `urls` that are not repeats of each other by
 * image (ROADMAP 6.34, the wall's own threshold), images that fit a tile
 * first (6.70). Images are read in order, only as many as it takes: the
 * first `limit` at once, then one more for each repeat or misfit. A misfit
 * is used only when the list runs out — a card with three good covers and a
 * spine still shows four.
 */
export async function distinctCovers(urls: readonly string[], limit: number): Promise<string[]> {
  const readings = new Map<number, TileReading>();
  let next = 0;
  const readUpTo = async (end: number) => {
    const jobs: Promise<void>[] = [];
    for (; next < Math.min(end, urls.length); next++) {
      const i = next;
      jobs.push(readCoverImage(mosaicTileSrc(urls[i], i)).then(r => { readings.set(i, r); }));
    }
    await Promise.all(jobs);
  };
  await readUpTo(limit);
  for (;;) {
    const items = urls.slice(0, next).map((url, i) => ({ url, ...(readings.get(i) ?? { hash: null, fits: true }) }));
    const good = pickDistinct(items.filter(item => item.fits), limit, SAME_COVER_MAX_DISTANCE);
    if (good.length >= limit) return good;
    if (next < urls.length) {
      await readUpTo(next + (limit - good.length));
      continue;
    }
    // Out of candidates: fill with the misfits, still without repeats.
    return pickDistinct([...items.filter(item => item.fits), ...items.filter(item => !item.fits)], limit, SAME_COVER_MAX_DISTANCE);
  }
}
