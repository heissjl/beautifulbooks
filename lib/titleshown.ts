/**
 * Which title a reader sees (ROADMAP 6.2, T13; red team 2026-10-09 U1).
 *
 * Open Library names a work after one of its records, often the original:
 * `crime and punishment` found «Преступление и наказание», `the master and
 * margarita` «Мастер и Маргарита» — the right work in a script the reader did
 * not type. Julian, 2026-10-10 („ok“): the title of the edition in the language
 * of the search, else in the reader's language, where there is one; else a
 * transliteration of Cyrillic; the catalogue's title small underneath.
 *
 * The order, first that applies:
 * 1. **The edition the search matched** (`matched`, Open Library's own best
 *    edition for the query) — the search's language: `die verwandlung` shows
 *    „Die Verwandlung“, not „Metamorphosis“. For a title in Latin script only
 *    when that edition is not English (see the note in `shownTitle`).
 * 2. **An edition whose title carries every word of the query**, on a page
 *    reached from a search — the same choice made from the editions loaded.
 * 3. Only for a title **not in Latin script**: the commonest title among the
 *    editions in the reader's languages, then English; then, for Cyrillic, a
 *    transliteration. A Latin title is left as the catalogue has it — "Der
 *    Proceß" stays "Der Proceß" on a page reached from outside.
 *
 * Pure and client-safe.
 */
import { displayTitle, normalizeTitle } from './normalize';

export interface ShownTitle {
  /** What the reader sees as the title. */
  title: string;
  /** The catalogue's own title, set only when it differs from `title`. */
  catalogueTitle?: string;
}

export interface EditionTitle {
  title: string;
  /** ISO 639-1, as on `Edition`. */
  language?: string;
}

/** True when every letter is Latin (accents included); no letters counts as Latin. */
export function isLatinScript(text: string): boolean {
  return !/[\p{L}]/u.test(text.replace(/\p{Script=Latin}/gu, ''));
}

function isCyrillic(text: string): boolean {
  return /\p{Script=Cyrillic}/u.test(text);
}

// Russian, with the Ukrainian and Belarusian letters, after the BGN/PCGN table a reader knows from English books.
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', і: 'i', ї: 'yi', є: 'ye', ґ: 'g', ў: 'w',
};

/** Cyrillic letters in Latin ones; anything else stays as it is. */
export function transliterateCyrillic(text: string): string {
  return [...text].map(ch => {
    const lower = ch.toLowerCase();
    const latin = CYRILLIC[lower];
    if (latin === undefined) return ch;
    if (ch === lower || latin === '') return latin;
    return latin.charAt(0).toUpperCase() + latin.slice(1);
  }).join('');
}

/** An author's name a reader of Latin script can read: Cyrillic transliterated, the rest as given. */
export function readableAuthor(name: string): string {
  return isCyrillic(name) && !isLatinScript(name) ? transliterateCyrillic(name) : name;
}

function words(text: string): string[] {
  return normalizeTitle(text).split(' ').filter(Boolean);
}

/** The commonest title among these editions, by normalised form; the first seen wins a tie. */
function commonest(editions: readonly EditionTitle[]): string | undefined {
  const counts = new Map<string, { title: string; n: number }>();
  for (const e of editions) {
    const shown = displayTitle(e.title);
    const key = normalizeTitle(shown);
    if (!key) continue;
    const entry = counts.get(key);
    if (entry) entry.n += 1;
    else counts.set(key, { title: shown, n: 1 });
  }
  let best: { title: string; n: number } | undefined;
  for (const entry of counts.values()) if (!best || entry.n > best.n) best = entry;
  return best?.title;
}

function differs(a: string, b: string): boolean {
  return normalizeTitle(a) !== normalizeTitle(b);
}

export function shownTitle(workTitle: string, options: {
  /** The edition Open Library matched to the search (the result card). */
  matched?: string;
  /** Its language, ISO 639-1. */
  matchedLanguage?: string;
  /** The search that led here (the book page). */
  query?: string;
  /** Editions loaded so far. */
  editions?: readonly EditionTitle[];
  /** ISO 639-1 codes in order of preference: the reader's language first. */
  languages?: readonly string[];
} = {}): ShownTitle {
  const pick = (title: string | undefined): ShownTitle | undefined =>
    title && differs(title, workTitle) ? { title: displayTitle(title), catalogueTitle: workTitle } : undefined;

  // A Latin title gives way to the match only for an edition in another language than English — the
  // searcher typed that language. An English match is often a stray record: `1984` matched Burgess's
  // *1985* to an edition called "1984-85" (2026-10-19).
  // Without a language on the edition, the query decides: the match's title is what was typed
  // (word for word, either way) and the catalogue's is not.
  const queryWords = options.query ? words(options.query) : [];
  const carries = (title: string) => { const own = new Set(words(title)); return queryWords.length > 0 && queryWords.every(w => own.has(w)); };
  const isTyped = (title: string) => carries(title) && words(title).every(w => queryWords.includes(w));
  // A match in another script never replaces anything: `1984` matched a Russian edition «1984 / Скотный двор».
  const matchCounts = options.matched && isLatinScript(options.matched) && (
    !isLatinScript(workTitle)
    || (options.matchedLanguage !== undefined ? options.matchedLanguage !== 'en' : isTyped(options.matched) && !carries(workTitle))
  );
  if (options.matched && matchCounts) {
    const chosen = pick(options.matched);
    if (chosen) return chosen;
  }
  if (options.matched && !options.editions) return { title: workTitle };

  const editions = options.editions ?? [];
  if (queryWords.length > 0) {
    const latin = isLatinScript(workTitle);
    const carrying = editions.filter(e => {
      // The same caution as for the match: a Latin title gives way only to another language.
      if (latin && (!e.language || e.language === 'en')) return false;
      const own = new Set(words(e.title));
      return queryWords.every(w => own.has(w));
    });
    const chosen = pick(commonest(carrying));
    if (chosen) return chosen;
  }

  if (isLatinScript(workTitle)) return { title: workTitle };
  for (const language of [...(options.languages ?? []), 'en']) {
    const chosen = pick(commonest(editions.filter(e => e.language === language && isLatinScript(e.title))));
    if (chosen) return chosen;
  }
  if (isCyrillic(workTitle)) return pick(transliterateCyrillic(workTitle)) ?? { title: workTitle };
  return { title: workTitle };
}
