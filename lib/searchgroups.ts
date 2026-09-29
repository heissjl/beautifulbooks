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

export interface ResultGroups<W> {
  /** The first card, its author's other books, and large books by others. */
  main: W[];
  /** Books whose first author is someone else, in their ranked order. */
  others: W[];
}

type Grouped = Pick<Work, 'authors' | 'authorKeys' | 'editionCount'>;

export function groupByAuthor<W extends Grouped>(works: readonly W[]): ResultGroups<W> {
  const [first] = works;
  const author = first?.authors[0];
  // Nothing to anchor on: one card, or a first card without a known author.
  if (!first || works.length < 2 || !author || author === 'Unknown') return { main: [...works], others: [] };

  /*
    Two identities, as in `derivativeIds`: the name key alone misses a
    transliteration ("Fyodor Dostoevsky" beside "Fiódor Dostoievski"), the
    Open Library key alone misses a record that carries none.
  */
  const ids = new Set([authorMatchKey(author), first.authorKeys?.[0]].filter((id): id is string => !!id));
  const sameAuthor = (w: W) =>
    ids.has(authorMatchKey(w.authors[0] ?? '')) || (!!w.authorKeys?.[0] && ids.has(w.authorKeys[0]));
  const lead = first.editionCount ?? 0;
  const large = (w: W) => (w.editionCount ?? 0) * OTHER_AUTHOR_SHARE >= lead;

  const main: W[] = [];
  const others: W[] = [];
  for (const w of works) (w === first || sameAuthor(w) || large(w) ? main : others).push(w);
  return { main, others };
}
