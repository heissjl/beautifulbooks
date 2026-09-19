/**
 * The ring of covers beside the home page's headline (ROADMAP 1.9).
 *
 * Julian, 2026-09-07: „der Platz oben rechts ist perfekt für noch ein
 * Design-Element." The first screen said what the site does in a sentence
 * and showed none of it; this is the promise as a picture — one book, many
 * faces. It began on 2026-09-10 as a fan of four *Dune* covers and became a
 * ring of seven on 2026-09-11 (Julian: „7 ist aber eine gute Zahl"): at an
 * odd count the far covers stand between the near ones instead of hidden
 * right behind them.
 *
 * **Which book: a curated one, drawn anew on every visit** (Julian,
 * 2026-09-11: „es sollte wechseln zwischen werken aus der kuratierten liste,
 * die mehr als 7 cover über der entsprechenden schwelle haben", and „nur pro
 * Besuch"). The candidates are every curated work the cover index can fill
 * with seven covers that clear the rules in `lib/heroring.ts`. Those rings are
 * computed at build time into `data/hero-rings.json`
 * (`scripts/build-hero-rings.ts`), so the browser gets ids and names, never
 * the index, and a visit costs nothing beyond seven images from `/img`.
 *
 * **The caption names the book, not a count** (Julian, 2026-09-11): title and
 * author. The number of covers on the ring is plain to see, and a count of
 * the catalogue would move with it and the folding (§1, N12).
 */
import ringsFile from '@/data/hero-rings.json';
import type { HeroRing } from './heroring';

export const HERO_RINGS: readonly HeroRing[] = (ringsFile as { rings: HeroRing[] }).rings;

/** The ring for this visit; `random` is a parameter so a test can pin it. */
export function pickHeroRing(random: () => number = Math.random): HeroRing {
  return HERO_RINGS[Math.min(HERO_RINGS.length - 1, Math.floor(random() * HERO_RINGS.length))];
}
