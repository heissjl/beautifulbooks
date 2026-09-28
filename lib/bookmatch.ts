/**
 * From a book as a photo reads it — {title, author} — to the work it most
 * probably is (ROADMAP 5.11, moved here for the site's photo import, 5.13a).
 * Pure and tested; the search itself is the caller's.
 */
import type { WorkSummary } from './model';
import { normalizeAuthor, normalizeTitle } from './normalize';

export type WorkReason = 'author+title' | 'author' | 'title-only' | 'first-result';

function authorWords(name: string): string[] {
  // normalizeAuthor turns "Orwell, George" into "george orwell".
  return normalizeAuthor(name).split(' ').filter(Boolean);
}

/**
 * Same person, as far as a spine can tell: the surnames agree. A spine often
 * prints only "ORWELL", and the model then gives just that, so the first name
 * is compared only when both sides have one.
 */
export function sameAuthor(a: string, b: string): boolean {
  const wa = authorWords(a);
  const wb = authorWords(b);
  if (wa.length === 0 || wb.length === 0) return false;
  const lastA = wa[wa.length - 1];
  const lastB = wb[wb.length - 1];
  if (lastA !== lastB) return false;
  // Both with a first word: the initials must agree, or one first word must be
  // inside the other name ("García Márquez" against "Gabriel García Márquez").
  if (wa.length > 1 && wb.length > 1) return wa[0][0] === wb[0][0] || wa.includes(wb[0]) || wb.includes(wa[0]);
  return true;
}

/** 2 = same title, 1 = one contains the other (a subtitle, a series prefix), 0 = neither. */
export function titleScore(recognized: string, work: string): number {
  const a = normalizeTitle(recognized);
  const b = normalizeTitle(work);
  if (!a || !b) return 0;
  if (a === b) return 2;
  if (` ${b} `.includes(` ${a} `) || ` ${a} `.includes(` ${b} `)) return 1;
  return 0;
}

/**
 * The work a recognised book most probably is. The search's own order is
 * already ranked (`rankWorks` with its `rankContext`: Open Library's position,
 * popularity relative to the rest, derivatives pushed down), so it breaks
 * every tie; a matching primary author weighs more than a matching title,
 * because a study guide shares the title and never the author.
 */
export function pickWork(
  works: readonly Pick<WorkSummary, 'id' | 'title' | 'authors'>[],
  book: { title: string; author: string },
): { index: number; reason: WorkReason } | null {
  if (works.length === 0) return null;
  let best = -1;
  let bestScore = -1;
  let bestReason: WorkReason = 'first-result';
  works.forEach((w, i) => {
    const author = !!book.author && sameAuthor(book.author, w.authors[0] ?? '');
    const title = titleScore(book.title, w.title);
    const score = (author ? 4 : 0) + title * 2;
    if (score > bestScore) {
      best = i;
      bestScore = score;
      bestReason = author && title > 0 ? 'author+title' : author ? 'author' : title > 0 ? 'title-only' : 'first-result';
    }
  });
  return { index: best, reason: bestReason };
}

/** Open Library cover id from a cover URL (`…/b/id/123-M.jpg`). */
export function coverIdFromUrl(url: string | undefined): number | undefined {
  const m = url ? /\/b\/id\/(\d+)-[SML]\.jpg/.exec(url) : null;
  return m ? Number(m[1]) : undefined;
}
