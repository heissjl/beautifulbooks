/**
 * Which of a card's candidate images look like covers (ROADMAP 6.70).
 *
 * The review from outside (2026-09-28) found spines, blank endpapers and
 * half scans in the mosaics of search cards. The mosaic path fetches no
 * signatures — a result page of twenty cards is not worth hashing on the
 * server — so the browser, which already reads each candidate through a
 * canvas to drop repeats (6.34), measures two more things while it is at it:
 * the shape and the blankness. Client-safe: nothing here decodes a file.
 *
 * Both rules are borrowed, not invented: the shape from the cover game
 * (`MIN_ASPECT`/`MAX_ASPECT`, SPEC F7.2, measured on a hundred covers), the
 * blankness from the wall (`looksLikeScannedPage`). And as on the wall, a
 * flagged image is **sorted to the end, never dropped**: the numbers that
 * describe a blurb scan also describe a plain white cover, and a card with
 * an empty tile is worse than a card with a doubtful one.
 */
import { looksLikeScannedPage, type ImageSignature } from './imagesig';
import { MAX_ASPECT, MIN_ASPECT } from './hotornot/pool';

export interface MosaicMeasure {
  width: number;
  height: number;
  /** As the wall measures them, from the same grey image as the hash. */
  signature: Pick<ImageSignature, 'hash' | 'contrast' | 'mean'>;
}

/** Width over height within the game's cover shape: a spine or a spread is not. */
export function coverShaped(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const aspect = width / height;
  return aspect >= MIN_ASPECT && aspect <= MAX_ASPECT;
}

/** True when the image looks like something other than a cover. Unmeasured images pass. */
export function looksLikeNonCover(measure: MosaicMeasure | null | undefined): boolean {
  if (!measure) return false;
  return !coverShaped(measure.width, measure.height) || looksLikeScannedPage(measure.signature);
}

/**
 * The candidates in the order the card should try them: covers first, in
 * their given order; what looks like a non-cover after them, so it fills a
 * tile only when nothing better is left.
 */
export function coversFirst<T>(items: readonly T[], measureOf: (item: T) => MosaicMeasure | null | undefined): T[] {
  const covers: T[] = [];
  const rest: T[] = [];
  for (const item of items) (looksLikeNonCover(measureOf(item)) ? rest : covers).push(item);
  return [...covers, ...rest];
}
