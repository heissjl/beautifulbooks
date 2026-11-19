/**
 * How many works a hub card's grid reads (ROADMAP 6.114). Its own module, not
 * `CollectionGrid.tsx`: a value imported from a 'use client' file into a
 * server page arrives as a client reference, not a number — the hub sliced to
 * nothing in a production build while `next dev` worked (2026-11-19).
 */
/** Covers a card can show before the mosaic: two rows of five. */
export const GRID_SHOWN = 9;
/** Minis in the mosaic tile, a 3 × 3 square of the covers that come next. */
export const MOSAIC = 9;
/** The most works a grid ever reads: the rows and the mosaic after them. */
export const GRID_WORKS = GRID_SHOWN + MOSAIC;
