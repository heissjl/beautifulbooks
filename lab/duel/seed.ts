/**
 * The same round for two people, from one link (ROADMAP 5.8, Spielart 2).
 *
 * Pure and deterministic: a seed decides which books appear, in which order,
 * and which covers are offered for each. Two people opening the same link
 * therefore see exactly the same thing without anything being stored — which
 * is what makes the comparison possible at all, and what keeps the whole
 * game out of the storage question E6 defers.
 *
 * No I/O; the caller supplies the books.
 */

export interface DuelBook {
  id: string;
  title: string;
  author: string;
  /** Every cover the round may offer for this book. */
  coverIds: string[];
}

export interface DuelRound {
  seed: string;
  books: Array<{ id: string; title: string; author: string; choices: string[] }>;
}

/**
 * A small, fast, seeded generator (mulberry32).
 *
 * Not for anything that must be unguessable: this decides which books two
 * friends are shown. It must be **stable across machines and versions**,
 * which `Math.random` is not, and that is the whole requirement.
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed string to a number, so a link can carry a word instead of digits. */
export function seedNumber(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates against a seeded generator; does not touch the input. */
export function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface RoundOptions {
  /** How many books a round asks about. */
  books?: number;
  /** How many covers are offered per book. */
  choices?: number;
}

/**
 * Builds the round.
 *
 * Books with fewer covers than `choices` are skipped rather than padded: a
 * question with two answers is not the same game as one with six, and mixing
 * them would make the agreement rate meaningless.
 */
export function buildRound(seed: string, pool: readonly DuelBook[], options: RoundOptions = {}): DuelRound {
  const wanted = options.books ?? 10;
  const choices = options.choices ?? 6;
  const next = rng(seedNumber(seed));

  const usable = pool.filter(b => b.coverIds.length >= choices);
  const books = shuffled(usable, next)
    .slice(0, wanted)
    .map(b => ({
      id: b.id,
      title: b.title,
      author: b.author,
      choices: shuffled(b.coverIds, next).slice(0, choices),
    }));

  return { seed, books };
}

export interface Agreement {
  /** Books both answered. */
  answered: number;
  same: number;
  /** Share of answered books where both picked the same cover. */
  rate: number;
  /**
   * What two people picking at random would have reached, for the same
   * questions. The number that matters is the distance from this, not the
   * rate itself: at six covers a round, chance alone agrees one time in six.
   */
  chance: number;
  sameBooks: string[];
}

export function compare(
  round: DuelRound,
  a: Record<string, string>,
  b: Record<string, string>,
): Agreement {
  let answered = 0;
  let same = 0;
  let chanceSum = 0;
  const sameBooks: string[] = [];
  for (const book of round.books) {
    const pa = a[book.id];
    const pb = b[book.id];
    if (!pa || !pb) continue;
    answered += 1;
    chanceSum += 1 / Math.max(1, book.choices.length);
    if (pa === pb) {
      same += 1;
      sameBooks.push(book.id);
    }
  }
  return {
    answered,
    same,
    rate: answered ? same / answered : 0,
    chance: answered ? chanceSum / answered : 0,
    sameBooks,
  };
}
