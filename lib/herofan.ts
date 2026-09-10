/**
 * The four covers fanned out beside the home page's headline (ROADMAP 1.9).
 *
 * Julian, 2026-09-07: „der Platz oben rechts ist perfekt für noch ein
 * Design-Element." The first screen said what the site does in a sentence
 * and showed none of it; this is the promise as a picture — one book, four
 * faces — in the visual language the loading stage already uses (`.stage-tile`).
 *
 * **Fixed ids, no request.** The covers are named here, like `lib/curated.ts`
 * names the wall's, so the first render costs nothing beyond four images
 * from `/img`, which the CDN holds after the first reader.
 *
 * **Picked by distance, not by eye.** Chosen on 2026-09-10 from the 133 Dune
 * covers in the built index by greedy farthest-point over colour distance and
 * dHash, after dropping blank-looking, low-saturation and low-contrast scans:
 * the four are at least 0.53 apart in colour (the "looks like this" gate is
 * 0.055) and 26 bits apart in structure (same-design folds at 8). A test
 * holds that, so a swapped id cannot quietly put two near-identical jackets
 * side by side — which would make the picture say the opposite of what it
 * is for.
 *
 * **The caption promises no number.** "four of its covers", not "four of
 * 133": the count moves with the catalogue and the folding, and §1 forbids
 * a figure the page cannot stand behind.
 */
export interface HeroFan {
  workId: string;
  title: string;
  author: string;
  /** Four cover ids, left to right, in the index's `ol:<id>` form. */
  coverIds: readonly [string, string, string, string];
}

export const HERO_FAN: HeroFan = {
  workId: 'OL893414W',
  title: 'Dune',
  author: 'Frank Herbert',
  coverIds: ['ol:8570801', 'ol:12780703', 'ol:11481225', 'ol:11481333'],
};

/** Degrees of tilt per tile, outer ones more, so the fan reads as held in a hand. */
export const HERO_FAN_TILTS = [-10, -3, 4, 11] as const;
