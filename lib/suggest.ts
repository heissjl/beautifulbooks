/**
 * Suggestions while typing (ROADMAP 6.69): the published works that match
 * what is in the field, from a list built into the page
 * (`data/suggest-works.json`, `scripts/build-suggest-works.ts`) — no request,
 * so it can answer every keystroke. Open Library is far too slow for that
 * (2–7 s a search). A work outside the list is found by the search as before.
 *
 * A work matches when every typed word begins a word of its title or of its
 * author's name, accents and case aside ("garcia marq" finds García Márquez,
 * "gatsb" finds Gatsby). Order: a title that begins with the typed words,
 * then a title that has them, then the author; the list's own order breaks
 * ties (curated works first). Pure and client-safe.
 */

export interface SuggestedWork {
  id: string;
  title: string;
  author: string;
  /** `ol:<n>`, for `coverProxyPath`. */
  coverId: string;
}

/** Fewest characters before suggesting: one letter matches half the list. */
export const MIN_SUGGEST_CHARS = 2;
export const MAX_SUGGESTIONS = 6;

export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[’']/g, '');
}

function wordsOf(text: string): string[] {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Rows `[id, title, author, coverId]` as the build script writes them; a short row is dropped. */
export function parseSuggestRows(rows: ReadonlyArray<ReadonlyArray<string>>): SuggestedWork[] {
  return rows.filter(r => r.length >= 4).map(([id, title, author, coverId]) => ({ id, title, author, coverId }));
}

export function suggestWorks(query: string, works: readonly SuggestedWork[], limit = MAX_SUGGESTIONS): SuggestedWork[] {
  const typed = wordsOf(query);
  if (fold(query).trim().length < MIN_SUGGEST_CHARS || typed.length === 0) return [];
  const scored: Array<{ work: SuggestedWork; score: number; at: number }> = [];
  works.forEach((work, at) => {
    const title = wordsOf(work.title);
    const author = wordsOf(work.author);
    const both = [...title, ...author];
    if (!typed.every(w => both.some(own => own.startsWith(w)))) return;
    const inTitle = typed.every(w => title.some(own => own.startsWith(w)));
    const titleStarts = inTitle && typed.every((w, i) => title[i]?.startsWith(w));
    scored.push({ work, at, score: titleStarts ? 0 : inTitle ? 1 : 2 });
  });
  return scored.sort((a, b) => a.score - b.score || a.at - b.at).slice(0, limit).map(s => s.work);
}
