/**
 * The mark (ROADMAP 6.61, direction A in docs/identitaet.md, Julian
 * 2026-09-29): a wall of book-shaped tiles with one picked out — many
 * editions, the one you want. No real cover, so it can be a trademark.
 *
 * The tiles take the text colour, the picked one the accent, so it follows
 * light and dark mode. `app/icon.svg` is the same drawing, and
 * `scripts/build-icons.py` draws the raster icons from the same numbers.
 */
const TILE_W = 10;
const TILE_H = 15;
const GAP = 3;
const PICK = 1.3;

export const MARK_WIDTH = 3 * TILE_W + 2 * GAP;
export const MARK_HEIGHT = 3 * TILE_H + 2 * GAP;

export default function BrandMark({ className = '' }: { className?: string }) {
  const tiles = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 1 && col === 1) continue;
      tiles.push(
        <rect key={`${row}-${col}`} x={col * (TILE_W + GAP)} y={row * (TILE_H + GAP)} width={TILE_W} height={TILE_H} rx={0.6} />,
      );
    }
  }
  const pickedW = TILE_W * PICK;
  const pickedH = TILE_H * PICK;
  return (
    <svg viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`} aria-hidden="true" focusable="false" className={className}>
      <g fill="currentColor">{tiles}</g>
      <rect
        x={(MARK_WIDTH - pickedW) / 2}
        y={(MARK_HEIGHT - pickedH) / 2}
        width={pickedW}
        height={pickedH}
        rx={0.8}
        fill="var(--accent)"
      />
    </svg>
  );
}
