/**
 * Typo handling for the search box (ROADMAP 6.60, SPEC F1.9).
 *
 * Open Library has no spelling help of its own: measured 2026-09-27, its
 * `search.json` returns no suggestion field, ignores Solr's `~` fuzzy
 * operator (`gatsbee~` and `title:gatsbee~` both find nothing), and a
 * misspelling only finds a book when some record carries the same
 * misspelling (`gatbsy` works because one record is called "Learn German with
 * the Great Gatbsy"). `gatsbee` and `pride and prejudise` return nothing at
 * all; `Tolkein` and `Hemmingway` return books *about* the author or by
 * namesakes, the best of them with eleven editions.
 *
 * So the correction is ours, against a local word list built from the works
 * this site already knows (`lib/lexicon.ts`: the index, the curated wall, the
 * collections). Pure, no I/O, runs on the server only because the word list
 * is large.
 *
 * **It never replaces a strong answer.** A correction is only looked for when
 * Open Library's answer is empty or weak (`isWeakResult`), and a weak answer
 * is replaced only when the corrected query is clearly better
 * (`correctionIsBetter`). An unknown word next to a strong answer is a book
 * we do not know, not a typo.
 */
import type { WorkSummary } from './model';

/** Words shorter than this are left alone: too many real words are one edit apart. */
export const MIN_CORRECTABLE_LENGTH = 4;

/**
 * How many edits a word of this length may be away from its correction.
 * One for four- and five-letter words (`poter` → `potter`), two from six up
 * (`gatsbee` → `gatsby`). A swap of two neighbours counts as one edit
 * (`tolkein` → `tolkien`, `gatbsy` → `gatsby`).
 */
export function maxEdits(length: number): number {
  if (length < MIN_CORRECTABLE_LENGTH) return 0;
  return length < 6 ? 1 : 2;
}

/**
 * An answer this weak is worth a second look: nothing at all, or no work with
 * more than this many edition records (after `mergeWorks`). Measured
 * 2026-09-27: `Tolkein` 26, `Hemmingway` 8. It is not a quality bar — *Mumbo
 * Jumbo* (23), *Piranesi* (23) and *Austerlitz* (25) are weak by it too; they
 * are left alone because every word of them is known or out of reach, and 13
 * weak answers among 30 ordinary queries produced no correction (history).
 */
export const WEAK_BEST_EDITIONS = 30;

/**
 * A corrected answer replaces a weak one only if its best work has at least
 * this many times the editions of the original's best — and at least
 * `WEAK_BEST_EDITIONS`. `Tolkein` → `Tolkien`: 11 against 481.
 */
export const BETTER_FACTOR = 5;

/** Lowercase, without diacritics and apostrophes, letters and digits only. */
export function normalizeWord(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/** Words of a phrase, normalized, empty ones dropped. */
export function wordsOf(phrase: string): string[] {
  return phrase
    .split(/[\s\-–—/:;,.!?()[\]"„“”«»]+/)
    .map(normalizeWord)
    .filter(Boolean);
}

/**
 * Edit distance with adjacent swaps (optimal string alignment), giving up as
 * soon as it must exceed `limit` — then it returns `limit + 1`. Most words of
 * the list differ in length by more than the limit and cost nothing.
 */
export function editDistance(a: string, b: string, limit = Infinity): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  if (a === b) return 0;
  const n = b.length;
  let prev2 = new Array<number>(n + 1).fill(0);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(n + 1);
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > limit) return limit + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n];
}

/** The words the site knows, with how often each occurs and how it is spelled. */
export interface Vocabulary {
  /** Normalized word → occurrences across titles and names. */
  counts: ReadonlyMap<string, number>;
  /** Normalized word → the spelling it most often has in the sources ("Gatsby", "Tolkien"). */
  display: ReadonlyMap<string, string>;
  /** Words grouped by length, so a lookup scans only lengths within reach. */
  byLength: ReadonlyMap<number, readonly string[]>;
}

/** Builds the vocabulary from titles and author names. */
export function buildVocabulary(phrases: Iterable<string>): Vocabulary {
  const counts = new Map<string, number>();
  const spellings = new Map<string, Map<string, number>>();
  for (const phrase of phrases) {
    for (const raw of phrase.split(/[\s\-–—/:;,.!?()[\]"„“”«»]+/)) {
      const word = normalizeWord(raw);
      if (!word) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
      const shown = raw.replace(/[^\p{L}\p{N}'’]/gu, '');
      const forms = spellings.get(word) ?? new Map<string, number>();
      forms.set(shown, (forms.get(shown) ?? 0) + 1);
      spellings.set(word, forms);
    }
  }
  const display = new Map<string, string>();
  for (const [word, forms] of spellings) {
    display.set(word, [...forms.entries()].sort((x, y) => y[1] - x[1])[0][0]);
  }
  const byLength = new Map<number, string[]>();
  for (const word of counts.keys()) {
    const list = byLength.get(word.length) ?? [];
    list.push(word);
    byLength.set(word.length, list);
  }
  return { counts, display, byLength };
}

/**
 * The nearest known word, or undefined. Nearest means fewest edits; among
 * equals, one that keeps the first letter (people rarely mistype the first
 * letter), then the more frequent one, then alphabetical so the answer is
 * stable.
 */
export function nearestWord(word: string, vocabulary: Vocabulary): string | undefined {
  const limit = maxEdits(word.length);
  if (limit === 0 || /^\d+$/.test(word)) return undefined;
  let best: { word: string; d: number; first: number; count: number } | undefined;
  for (let len = word.length - limit; len <= word.length + limit; len++) {
    for (const candidate of vocabulary.byLength.get(len) ?? []) {
      if (candidate.length < MIN_CORRECTABLE_LENGTH) continue;
      const d = editDistance(word, candidate, limit);
      if (d > limit || d === 0) continue;
      const entry = { word: candidate, d, first: candidate[0] === word[0] ? 0 : 1, count: vocabulary.counts.get(candidate) ?? 0 };
      if (
        !best ||
        entry.d < best.d ||
        (entry.d === best.d && entry.first < best.first) ||
        (entry.d === best.d && entry.first === best.first && entry.count > best.count) ||
        (entry.d === best.d && entry.first === best.first && entry.count === best.count && entry.word < best.word)
      ) {
        best = entry;
      }
    }
  }
  return best?.word;
}

export interface Correction {
  /** What was typed. */
  from: string;
  /** The query with each unknown word replaced by its nearest known word. */
  to: string;
}

/**
 * A corrected query, or null when every word is known, too short, a number,
 * or has no known word within reach. Words that are fine stay exactly as
 * typed; a corrected word takes the spelling of the sources.
 */
export function correctQuery(query: string, vocabulary: Vocabulary): Correction | null {
  let changed = false;
  const pieces = query.trim().split(/\s+/).map(piece => {
    const word = normalizeWord(piece);
    if (word.length < MIN_CORRECTABLE_LENGTH || vocabulary.counts.has(word)) return piece;
    const nearest = nearestWord(word, vocabulary);
    if (!nearest) return piece;
    changed = true;
    const shown = vocabulary.display.get(nearest) ?? nearest;
    // Typed in lower case, corrected in lower case: "harry poter" → "harry potter".
    return piece === piece.toLowerCase() ? shown.toLowerCase() : shown;
  });
  if (!changed) return null;
  return { from: query, to: pieces.join(' ') };
}

function bestEditions(works: readonly WorkSummary[]): number {
  return works.reduce((n, w) => Math.max(n, w.editionCount ?? 0), 0);
}

/** Empty, or no work above `WEAK_BEST_EDITIONS` edition records. */
export function isWeakResult(works: readonly WorkSummary[]): boolean {
  return bestEditions(works) <= WEAK_BEST_EDITIONS;
}

/** Whether the corrected answer should be shown instead of the original. */
export function correctionIsBetter(original: readonly WorkSummary[], corrected: readonly WorkSummary[]): boolean {
  const before = bestEditions(original);
  const after = bestEditions(corrected);
  if (corrected.length === 0) return false;
  if (original.length === 0) return true;
  return after > WEAK_BEST_EDITIONS && after >= BETTER_FACTOR * Math.max(1, before);
}
