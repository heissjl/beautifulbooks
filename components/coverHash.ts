import { mosaicTileSrc } from '@/lib/coverurl';
import { dhash, luminance, pickDistinct, resizeGray, toGray } from '@/lib/dhash';
import { coversFirst, looksLikeNonCover, type MosaicMeasure } from '@/lib/mosaic';
import { SAME_COVER_MAX_DISTANCE } from '@/lib/works';

/** How long one image may take before it counts as unreadable. */
const HASH_TIMEOUT_MS = 4000;

/** What one candidate image measured as: the hash, and the shape and blankness of 6.70. */
export type CoverMeasure = MosaicMeasure;

/**
 * The structure hash of one image, read through a canvas (ROADMAP 6.34), with
 * its size and the wall's blankness measure from the same grey pixels (6.70).
 *
 * The images come through our own `/img` route, so they are same-origin and a
 * canvas may read them; a foreign address taints the canvas, `getImageData`
 * throws, and the answer is `null` — which `pickDistinct` treats as "keep".
 * The address is the one the tile will ask for, so the tile then finds the
 * image in the browser's cache and nothing is fetched twice.
 */
export function hashCoverImage(src: string): Promise<CoverMeasure | null> {
  return new Promise(resolve => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(null), HASH_TIMEOUT_MS);
    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context || canvas.width < 2 || canvas.height < 2) return resolve(null);
        context.drawImage(img, 0, 0);
        const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
        const grey = toGray({ width: canvas.width, height: canvas.height, rgba: data });
        resolve({ width: canvas.width, height: canvas.height, signature: { hash: dhash(resizeGray(grey, 9, 8)), ...luminance(grey) } });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/**
 * The first `limit` covers of `urls` that are not repeats of each other by
 * image (ROADMAP 6.34, the wall's own threshold), covers before what looks
 * like a spine, a spread or a blank page (6.70). The first `limit` are hashed
 * at once; each repeat or non-cover costs one more image, never the whole list.
 */
export async function distinctCovers(urls: readonly string[], limit: number): Promise<string[]> {
  const measures = new Map<number, CoverMeasure | null>();
  let next = 0;
  const hashUpTo = async (end: number) => {
    const jobs: Promise<void>[] = [];
    for (; next < Math.min(end, urls.length); next++) {
      const i = next;
      jobs.push(hashCoverImage(mosaicTileSrc(urls[i], i)).then(m => { measures.set(i, m); }));
    }
    await Promise.all(jobs);
  };
  await hashUpTo(limit);
  for (;;) {
    const items = coversFirst(
      urls.slice(0, next).map((url, i) => ({ url, measure: measures.get(i) ?? null })),
      item => item.measure,
    ).map(item => ({ url: item.url, hash: item.measure?.signature.hash ?? null, doubtful: looksLikeNonCover(item.measure) }));
    const picked = pickDistinct(items, limit, SAME_COVER_MAX_DISTANCE);
    const settled = picked.length >= limit && !items.filter(i => picked.includes(i.url)).some(i => i.doubtful);
    if (settled || next >= urls.length) return picked;
    await hashUpTo(next + (limit - picked.filter(url => !items.find(i => i.url === url)?.doubtful).length));
  }
}
