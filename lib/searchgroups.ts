/**
 * The result list in two parts: the first card's author, and everyone else
 * (ROADMAP 6.81, SPEC F1.11).
 *
 * Measured on 2026-09-29 over ten searches: for "the great gatsby" 12 of 15
 * cards are books by other authors, most of them study guides that are called
 * plainly "The Great Gatsby" (Matterson, Lehan, Parkinson). A label saying
 * which card is *about* the novel cannot be given honestly — nothing in those
 * titles says so, and the derivative rule the ranking uses also catches books
 * that merely share words ("Flora & Ulysses", "H.M.S. Ulysses"). Who wrote a
 * book is a fact the record states, so the list is split by that instead, and
 * says nothing it does not know (N12).
 *
 * Pure and client-safe; the ranking is not touched, each part keeps its order.
 */
import { authorMatchKey } from './normalize';
import type { Work } from './model';

/**
 * A book by another author stays in the upper part when it has at least a
 * tenth of the first card's editions: Beccaria's *Dei delitti e delle pene*
 * under "crime and punishment" (164 against 1,178), Fénelon under "ulysses".
 * Such a book is no footnote to the first one, and hiding it would be a
 * judgement the list has no grounds for.
 */
export const OTHER_AUTHOR_SHARE = 10;

/**
 * …and at least this many editions of its own (Julian, 2026-09-29: „ja, bau
 * das ein"). A tenth alone failed on small works: Reed's *Mumbo Jumbo* has 23
 * editions, so 3 were enough, and Wheen's unrelated *How Mumbo-jumbo
 * Conquered the World* stood beside the novel. 30 is the line the typo
 * correction already draws for a work worth the name (`WEAK_BEST_EDITIONS`
 * in `lib/spelling.ts`); Beccaria's 164 and Fénelon's 102 clear it.
 */
export const OTHER_AUTHOR_MIN_EDITIONS = 30;

export interface ResultGroups<W> {
  /** The first card, its author's other books, and large books by others. */
  main: W[];
  /** Books whose first author is someone else, in their ranked order. */
  others: W[];
}

type Grouped = Pick<Work, 'authors' | 'authorKeys' | 'editionCount'>;

/** Surnames this long may differ by this many letters and still name one person. */
const LOOSE_SURNAME_LENGTH = 6;
const LOOSE_SURNAME_EDITS = 2;

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Two name keys (`authorMatchKey`: initial and surname) for one person, allowing
 * for transliteration. Open Library keeps Dostoevsky under two people with two
 * keys — "Fiódor Dostoievski" (OL22242A) and "Fyodor Dostoevsky"
 * (OL16224933A) — and on 2026-09-29 his 19-edition *Crime and Punishment* stood
 * under "By other authors" because neither the key nor the name matched. A
 * false "same" only keeps a book on top; a false "other" puts a wrong heading
 * over it, so the match leans towards same.
 */
function sameName(a: string, b: string): boolean {
  if (a === b) return true;
  const [ia, ...ra] = a.split(' ');
  const [ib, ...rb] = b.split(' ');
  const sa = ra.join(' ');
  const sb = rb.join(' ');
  if (!sa || !sb || ia !== ib) return false;
  return Math.min(sa.length, sb.length) >= LOOSE_SURNAME_LENGTH && editDistance(sa, sb) <= LOOSE_SURNAME_EDITS;
}

export function groupByAuthor<W extends Grouped>(works: readonly W[]): ResultGroups<W> {
  const [first] = works;
  const author = first?.authors[0];
  // Nothing to anchor on: one card, or a first card without a known author.
  if (!first || works.length < 2 || !author || author === 'Unknown') return { main: [...works], others: [] };

  /*
    Two identities, as in `derivativeIds`: the Open Library key survives a
    different spelling ("Фёдор Достоевский" is OL22242A too), the name
    survives a record without keys or a person Open Library keeps twice.
  */
  const name = authorMatchKey(author);
  const key = first.authorKeys?.[0];
  const sameAuthor = (w: W) =>
    (!!key && w.authorKeys?.[0] === key) || (!!w.authors[0] && sameName(name, authorMatchKey(w.authors[0])));
  const lead = first.editionCount ?? 0;
  const large = (w: W) => {
    const editions = w.editionCount ?? 0;
    return editions >= OTHER_AUTHOR_MIN_EDITIONS && editions * OTHER_AUTHOR_SHARE >= lead;
  };

  const main: W[] = [];
  const others: W[] = [];
  for (const w of works) (w === first || sameAuthor(w) || large(w) ? main : others).push(w);
  return { main, others };
}
