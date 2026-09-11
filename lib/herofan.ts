/**
 * The covers on the ring beside the home page's headline (ROADMAP 1.9).
 *
 * Julian, 2026-09-07: „der Platz oben rechts ist perfekt für noch ein
 * Design-Element." The first screen said what the site does in a sentence
 * and showed none of it; this is the promise as a picture — one book, many
 * faces. It began on 2026-09-10 as a fan of four in the loading stage's tiles
 * and became a ring of seven on 2026-09-11 (Julian: „das Rondell … 7 ist aber
 * eine gute Zahl"): at an odd count the far covers stand between the near
 * ones instead of hidden right behind them.
 *
 * **Fixed ids, no request.** The covers are named here, like `lib/curated.ts`
 * names the wall's, so the first render costs nothing beyond seven images
 * from `/img`, which the CDN holds after the first reader.
 *
 * **Picked by distance, not by eye.** From the 133 Dune covers in the built
 * index by greedy farthest-point over colour distance and dHash, after
 * dropping blank-looking scans and the lowest quarter in saturation and
 * contrast: the fan's four on 2026-09-10, three more on 2026-09-11 seeded with
 * them. Every pair is at least 0.39 apart in colour (the "looks like this"
 * gate is 0.055) and 26 bits apart in structure. Julian asked that the ring's
 * covers differ by more than any threshold the site uses elsewhere, so a
 * test holds them above the loosest one — a swapped id cannot quietly put two
 * near-identical jackets on the ring, which would make the picture say the
 * opposite of what it is for.
 *
 * **The caption names the book, not a count** (Julian, 2026-09-11): title and
 * author. The number of covers on the ring is plain to see, and a count of
 * the catalogue would move with it and the folding (§1, N12).
 */
export interface HeroBook {
  workId: string;
  title: string;
  author: string;
  /** The four covers the first fan showed and the ring was seeded with, in the index's `ol:<id>` form. */
  coverIds: readonly [string, string, string, string];
}

export const HERO_FAN: HeroBook = {
  workId: 'OL893414W',
  title: 'Dune',
  author: 'Frank Herbert',
  coverIds: ['ol:8570801', 'ol:12780703', 'ol:11481225', 'ol:11481333'],
};

/**
 * The seven on the ring, in order round it: the fan's four and the three
 * next-farthest taking turns, so the fan's covers are spread round the ring.
 * The film jacket comes first because it faces the reader first.
 */
export const HERO_RING_IDS = [
  'ol:11481333', 'ol:15202652', 'ol:8570801', 'ol:291296',
  'ol:12780703', 'ol:9256648', 'ol:11481225',
] as const;
