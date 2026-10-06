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
import type { CollectionRing, HeroRing } from './heroring';
import { isHiddenCover } from './hiddencovers';

const file = ringsFile as { rings: HeroRing[]; collectionRings?: CollectionRing[] };

/**
 * A ring with a cover taken off the site (2.18k) is left out whole rather than
 * drawn with six: the rings were chosen as sets of seven at build time.
 */
export const HERO_RINGS: readonly HeroRing[] = file.rings.filter(r => !r.coverIds.some(isHiddenCover));

/**
 * **Collection rings (ROADMAP 6.59):** seven books of one published
 * collection, chosen by the rules in `lib/heroring.ts` at build time. They
 * take one visit in three; the other two keep the book ring, which is the
 * site's promise ("one book, many faces") and stays the usual picture.
 * Random per visit rather than a strict alternation, because remembering
 * which kind came last would mean keeping something in the reader's browser
 * that the reader did not ask for (privacy notice, § 25 TDDDG).
 */
export const COLLECTION_RINGS: readonly CollectionRing[] = (file.collectionRings ?? []).filter(r => !r.covers.some(c => isHiddenCover(c.coverId)));

/** The share of visits that show a collection ring, when one is live. */
export const COLLECTION_RING_SHARE = 1 / 3;

export type HeroPick = { kind: 'work'; ring: HeroRing } | { kind: 'collection'; ring: CollectionRing };

function draw<T>(list: readonly T[], random: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

/** The book ring for this visit; `random` is a parameter so a test can pin it. */
export function pickHeroRing(random: () => number = Math.random): HeroRing {
  return draw(HERO_RINGS, random);
}

/**
 * The ring for this visit, of either kind. A collection ring is drawn only
 * among `liveSlugs`, the collections published on the running site now: the
 * rings are built from data/collections.json, and a collection switched off
 * on /curate must not be linked from the home page.
 */
export function pickHeroPick(liveSlugs: readonly string[], random: () => number = Math.random): HeroPick {
  const live = COLLECTION_RINGS.filter(r => liveSlugs.includes(r.slug));
  if (live.length > 0 && random() < COLLECTION_RING_SHARE) return { kind: 'collection', ring: draw(live, random) };
  return { kind: 'work', ring: pickHeroRing(random) };
}
