/**
 * The shape of a cover tile on a collection wall (Julian, 2026-10-09: „wir
 * können die kachel ja auch leicht dynamisch machen?“). Pure and client-safe:
 * CoverWall runs in the browser and must not import lib/collections.ts, which
 * would ship the whole data file with it.
 */

/** Shapes a tile may take: a scan with a wide margin or a square audiobook cover must not stretch a row. */
export const TILE_RATIO = { min: 1.3, max: 1.75, fallback: 1.5 } as const;

/** The height over width a wall tile shows for a scan of this shape; 2:3 when the shape is unknown. */
export function tileRatio(ratio: number | undefined): number {
  if (!ratio || !Number.isFinite(ratio)) return TILE_RATIO.fallback;
  return Math.min(TILE_RATIO.max, Math.max(TILE_RATIO.min, ratio));
}
