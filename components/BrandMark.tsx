/**
 * The mark (ROADMAP 6.61, docs/identitaet.md §3): a wall of book-shaped
 * tiles in the tones of a shelf, with one picked out in the accent — many
 * editions, the one you want. No real cover, so it can be a trademark.
 * Julian chose direction A on 2026-09-29 and, the same day, its mix with C:
 * A's wall and picked tile in C's varied tones, as on the site card.
 *
 * The tones are `--mark-0` … `--mark-6` (app/globals.css), which turn round
 * in dark mode. `app/icon.svg` is the same drawing, and
 * `scripts/build-icons.py` draws the raster icons from the same numbers.
 */
const TILE_W = 10;
const TILE_H = 15;
const GAP = 3;
const PICK = 1.3;
/** Tone per tile, row by row; the middle one is the picked tile. */
export const MARK_TONES = [[2, 6, 3], [5, -1, 3], [2, 0, 1]];

export const MARK_WIDTH = 3 * TILE_W + 2 * GAP;
export const MARK_HEIGHT = 3 * TILE_H + 2 * GAP;

export default function BrandMark({ className = '' }: { className?: string }) {
  const tiles = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      if (row === 1 && col === 1) continue;
      tiles.push(
        <rect
          key={`${row}-${col}`}
          x={col * (TILE_W + GAP)}
          y={row * (TILE_H + GAP)}
          width={TILE_W}
          height={TILE_H}
          rx={0.6}
          fill={`var(--mark-${MARK_TONES[row][col]})`}
        />,
      );
    }
  }
  const pickedW = TILE_W * PICK;
  const pickedH = TILE_H * PICK;
  return (
    <svg viewBox={`0 0 ${MARK_WIDTH} ${MARK_HEIGHT}`} aria-hidden="true" focusable="false" className={className}>
      {tiles}
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
