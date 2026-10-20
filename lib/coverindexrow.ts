/**
 * One row of `data/cover-index.json`, and the aspect column (ROADMAP 6.70b).
 *
 * Rows are arrays, not objects: 35,000 objects with keys weigh several times
 * more. The shape is read by position everywhere — `lib/coverindex.ts`,
 * `lib/heroring.ts` and half a dozen scripts — so **a new column only ever
 * goes on the end, and it is optional**: a reader that destructures seven
 * fields keeps working on an eight-field row, and a row from before the column
 * simply has no eighth field.
 *
 * Pure and dependency-free, so the build script, the reader and the tests can
 * share it.
 */

export type CoverRow = [
  work: number, cover: string, hash: string,
  contrast: number, mean: number, saturation: number, hues: string,
  /** Width over height, two decimals; absent in rows built before 2026-10-20. */
  aspect?: number,
];

/** Where the aspect sits in a row. */
export const ROW_ASPECT = 7;

/**
 * Width over height to two decimals — the same rounding `signature` in
 * `lib/imagehash.ts` uses, so an indexed cover and a live-hashed one compare
 * on the same scale. Null for a size that is no size.
 */
export function aspectOf(width: number, height: number): number | null {
  if (!(width > 0) || !(height > 0)) return null;
  return Math.round((width / height) * 100) / 100;
}

export function rowAspect(row: readonly unknown[]): number | undefined {
  const value = row[ROW_ASPECT];
  return typeof value === 'number' && value > 0 ? value : undefined;
}

/**
 * Write an aspect into every row that lacks one and for which `lookup` knows
 * it. Returns how many rows gained one. A row that already carries an aspect
 * is left alone: the image it was measured from is the one the row describes.
 */
export function fillAspects(rows: CoverRow[], lookup: (coverId: string) => number | null | undefined): number {
  let filled = 0;
  for (const row of rows) {
    if (rowAspect(row) !== undefined) continue;
    const aspect = lookup(row[1]);
    if (aspect == null || !(aspect > 0)) continue;
    row[ROW_ASPECT] = aspect;
    filled++;
  }
  return filled;
}
