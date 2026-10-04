/**
 * Where the numbered pins of a photo go so that none hides another (ROADMAP
 * 5.11a). Pure and client-safe.
 *
 * The model puts a point on each book; on a shelf of thin spines or a pile
 * of thin books the points of neighbours lie closer together than a pin is
 * wide (Julian's two stacks, 2026-10-01: fifteen pins, six visible). A pin
 * that would cover an earlier one steps aside — across the direction its
 * neighbour lies in, so pins on a shelf fan out up and down and pins on a
 * pile fan out left and right, and the row or the stack stays readable.
 */
export type Point = [number, number];

/** How far a pin may step, in pins, before it gives up and overlaps. */
const STEPS = [1, -1, 2, -2, 3, -3];

/**
 * Pixel positions for pins of `size` px on a picture shown `width` × `height`
 * px; `points` are fractions of the picture, in the order the books were read.
 * A missing point gives no pin.
 */
export function spreadPins(points: readonly (Point | undefined)[], width: number, height: number, size: number): (Point | undefined)[] {
  const placed: Point[] = [];
  const hits = (x: number, y: number) => placed.find(([px, py]) => Math.abs(px - x) < size && Math.abs(py - y) < size);
  return points.map((p) => {
    if (!p) return undefined;
    const x = p[0] * width;
    const y = p[1] * height;
    let at: Point = [x, y];
    const first = hits(x, y);
    if (first) {
      // Beside each other → step up or down; above each other → step sideways.
      const sideBySide = Math.abs(first[0] - x) >= Math.abs(first[1] - y);
      for (const k of STEPS) {
        const tryAt: Point = sideBySide ? [x, y + k * size] : [x + k * size, y];
        if (tryAt[0] < 0 || tryAt[1] < 0 || tryAt[0] > width || tryAt[1] > height) continue;
        if (!hits(tryAt[0], tryAt[1])) {
          at = tryAt;
          break;
        }
      }
    }
    placed.push(at);
    return at;
  });
}
