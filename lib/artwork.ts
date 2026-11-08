/**
 * Whether two cover pictures carry the same artwork, whatever the words on
 * them say (ROADMAP 5.5; Julian, 2026-11-08: he deleted published nine-cover
 * pins that showed one picture twice, „manchmal waren es verschiedensprachige
 * editionen, aber das gleiche artwork"). Pure.
 *
 * The site's fold never crosses known languages (SPEC §2.3) and stays so: on
 * a book page a Spanish and a Polish edition are two editions. A pin of nine
 * tiles only has room for nine pictures, so this asks the other question.
 *
 * The measure is normalised cross-correlation over a small colour raster,
 * the best of the whole picture and its lower parts (the title sits on top
 * and is what a translation changes), each with a shift of up to two cells
 * (a scan's margin). A plain picture has no variance and correlates with
 * nothing, which the share-of-close-cells measure tried first got wrong.
 *
 * `SAME_ARTWORK` was set by looking, on the first 18 candidates of *Dune*,
 * *The Hobbit*, *A Game of Thrones* and *Animal Farm* (2026-11-08): the pairs
 * that are one picture scored 0.82–0.91, the highest of the rest 0.84 (two
 * red Dunes with a dune on them, an acceptable loss: spares follow) and then
 * 0.73. Not caught: *Animal Farm*'s windmill under two layouts (0.64) and a
 * photographed box beside its flat cover (0.31) — those need an eye, and
 * every pin picture gets one before a yes.
 */
export const ARTWORK_WIDTH = 24;
export const ARTWORK_HEIGHT = 36;
export const SAME_ARTWORK = 0.75;

const STARTS = [0, 8, 16];
const SHIFT = 2;

function correlate(a: ArrayLike<number>, b: ArrayLike<number>, dx: number, dy: number, top: number): number {
  let n = 0, sa = 0, sb = 0, aa = 0, bb = 0, ab = 0;
  for (let y = top; y < ARTWORK_HEIGHT; y++) {
    for (let x = 0; x < ARTWORK_WIDTH; x++) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= ARTWORK_WIDTH || Y >= ARTWORK_HEIGHT) continue;
      for (let k = 0; k < 3; k++) {
        const p = a[(y * ARTWORK_WIDTH + x) * 3 + k];
        const q = b[(Y * ARTWORK_WIDTH + X) * 3 + k];
        sa += p; sb += q; aa += p * p; bb += q * q; ab += p * q; n++;
      }
    }
  }
  const va = aa - sa * sa / n, vb = bb - sb * sb / n;
  return va < 1e-3 || vb < 1e-3 ? 0 : (ab - sa * sb / n) / Math.sqrt(va * vb);
}

/** How alike two rasters of ARTWORK_WIDTH × ARTWORK_HEIGHT RGB cells are, up to 1. */
export function artworkScore(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let best = -1;
  for (const top of STARTS) {
    for (let dx = -SHIFT; dx <= SHIFT; dx++) {
      for (let dy = -SHIFT; dy <= SHIFT; dy++) best = Math.max(best, correlate(a, b, dx, dy, top));
    }
  }
  return best;
}

/**
 * In the order given, each item unless an earlier kept one has the same
 * artwork. An item without a raster stays. Fewer than `atLeast` kept: the
 * repeats come back at the end, because a pin with an empty tile is worse
 * than one with a picture twice.
 */
export function distinctArtwork<T>(items: readonly T[], raster: (item: T) => ArrayLike<number> | undefined, atLeast = 0): T[] {
  const kept: T[] = [];
  const rasters: Array<ArrayLike<number>> = [];
  for (const item of items) {
    const r = raster(item);
    if (r && rasters.some(k => artworkScore(k, r) >= SAME_ARTWORK)) continue;
    kept.push(item);
    if (r) rasters.push(r);
  }
  if (kept.length < atLeast) kept.push(...items.filter(i => !kept.includes(i)).slice(0, atLeast - kept.length));
  return kept;
}
