import { mosaicTileSrc } from '@/lib/coverurl';
import { dhashFromRgba, pickDistinct } from '@/lib/dhash';
import { SAME_COVER_MAX_DISTANCE } from '@/lib/works';

/** How long one image may take before it counts as unreadable. */
const HASH_TIMEOUT_MS = 4000;

/**
 * The structure hash of one image, read through a canvas (ROADMAP 6.34).
 *
 * The images come through our own `/img` route, so they are same-origin and a
 * canvas may read them; a foreign address taints the canvas, `getImageData`
 * throws, and the answer is `null` — which `pickDistinct` treats as "keep".
 * The address is the one the tile will ask for, so the tile then finds the
 * image in the browser's cache and nothing is fetched twice.
 */
export function hashCoverImage(src: string): Promise<string | null> {
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
        resolve(dhashFromRgba(canvas.width, canvas.height, data));
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
 * image (ROADMAP 6.34, the wall's own threshold). The first `limit` are hashed
 * at once; each repeat costs one more image, never the whole list.
 */
export async function distinctCovers(urls: readonly string[], limit: number): Promise<string[]> {
  const hashes = new Map<number, string | null>();
  let next = 0;
  const hashUpTo = async (end: number) => {
    const jobs: Promise<void>[] = [];
    for (; next < Math.min(end, urls.length); next++) {
      const i = next;
      jobs.push(hashCoverImage(mosaicTileSrc(urls[i], i)).then(h => { hashes.set(i, h); }));
    }
    await Promise.all(jobs);
  };
  await hashUpTo(limit);
  for (;;) {
    const items = urls.slice(0, next).map((url, i) => ({ url, hash: hashes.get(i) ?? null }));
    const picked = pickDistinct(items, limit, SAME_COVER_MAX_DISTANCE);
    if (picked.length >= limit || next >= urls.length) return picked;
    await hashUpTo(next + (limit - picked.length));
  }
}
