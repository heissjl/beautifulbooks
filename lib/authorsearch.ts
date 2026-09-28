/**
 * "Only this author" (ROADMAP 6.60, SPEC F1.10): the rules that turn Open
 * Library's answers into one person's books. Pure, no I/O; the calls are in
 * lib/sources/openlibrary.ts and the orchestration in lib/search.ts.
 *
 * Why a mode of its own: the free-text search for a name finds books *about*
 * her as readily as books by her. Measured 2026-09-26 (ROADMAP 6.53): Harper
 * Lee 3 of 18 results hers, Margaret Mitchell 6 of 16. The author search asks
 * Open Library for one author key, most-printed first, and keeps what the
 * "More by …" row keeps (lib/authorworks.ts) — minus the cover rule, since a
 * result card loads its own mosaic, and minus the edition floor, because a
 * result list may be longer than a row of six (measured in docs/history.md).
 */
import type { WorkSummary } from './model';
import { authorMatchKey, looksLikeSecondaryLiterature, MARKED_DERIVATIVE } from './normalize';
import { isAuthorKey, looksLikeVolumePart } from './authorworks';
import { mergeWorks } from './works';
import { parseSearchDocs, type OlSearchDoc } from './sources/openlibrary-parse';

/** The subset of an author-search hit that `pickAuthor` reads. */
export interface AuthorCandidate {
  key: string;
  name?: string;
  work_count?: number;
  readinglog_count?: number;
}

/** The person a name was taken to mean. */
export interface ResolvedAuthor {
  /** Her main Open Library key, the one with most readers. */
  key: string;
  /** The main key first, then other records of the same name that readers use too (`SAME_PERSON_SHARE`). */
  keys: string[];
  name: string;
  /** Readers with one of her books on a list — how the pick was made, and how sure it is. */
  readers: number;
}

/**
 * Open Library splits one person over several author records, and the work a
 * reader knows best may hang on a small one: *Nineteen Eighty-Four* is filed
 * under OL15318546A (2 works, 8,582 readers), Orwell's main record is
 * OL118077A (635 works, 16,945 readers). Records **of the same name**
 * (`authorMatchKey`) with at least this share of the main record's readers
 * count as her. A namesake nobody reads stays out: Harper Lee's second record
 * has 0 readers, the "Cutco cook book" Margaret Mitchell 6 against 894.
 */
export const SAME_PERSON_SHARE = 0.1;

/** At most this many keys go into one works search. */
export const MAX_AUTHOR_KEYS = 5;

/**
 * Below this many readers the person a name found may be a namesake of the
 * one meant, and a spelling correction is worth a look (6.60). Measured
 * 2026-09-27: `Tolkein` finds Ivan Tolkein Wotherspoon (0 readers),
 * `Hemmingway` a stray "Ernest Hemmingway" record (17); the authors of the
 * five acceptance queries have 300 and more.
 */
export const WEAK_AUTHOR_READERS = 100;

/**
 * Which of the people a name matches is meant: the one most readers have on
 * a list, then the one with most works. Open Library's own order is by text
 * match and puts Christopher Tolkien (2,177 readers) before J.R.R. (16,495),
 * and SparkNotes (1,297, 1,410 "works") among the Hemingways — whose Ernest
 * has 6,432. A person with no works is never picked.
 */
export function pickAuthor(candidates: readonly AuthorCandidate[]): ResolvedAuthor | undefined {
  const usable = candidates
    .map(c => ({ ...c, key: c.key.replace('/authors/', ''), name: c.name?.trim() ?? '' }))
    .filter(c => isAuthorKey(c.key) && (c.work_count ?? 0) > 0 && c.name);
  const ranked = [...usable].sort(
    (a, b) => (b.readinglog_count ?? 0) - (a.readinglog_count ?? 0) || (b.work_count ?? 0) - (a.work_count ?? 0),
  );
  const best = ranked[0];
  if (!best) return undefined;
  const readers = best.readinglog_count ?? 0;
  const same = authorMatchKey(best.name);
  const keys = [best.key, ...ranked
    .slice(1)
    .filter(c => authorMatchKey(c.name) === same && readers > 0 && (c.readinglog_count ?? 0) >= SAME_PERSON_SHARE * readers)
    .map(c => c.key)].slice(0, MAX_AUTHOR_KEYS);
  return { key: best.key, keys, name: best.name, readers };
}

/**
 * The keys the "More by …" row asks for (ROADMAP 6.60, plan §6.4, Julian
 * 2026-09-27): the work's own key, widened to her other records of the same
 * name when the name lookup finds a person that **includes** that key. If the
 * name finds someone else, or nothing, the work's key stays alone — the row
 * never shows another person's books. Measured: *Nineteen Eighty-Four* hangs
 * on OL15318546A (two works), which alone gave the row almost nothing.
 */
export function keysForLinkedAuthor(workKey: string, candidates: readonly AuthorCandidate[]): string[] {
  const found = pickAuthor(candidates);
  return found && found.keys.includes(workKey) ? found.keys : [workKey];
}

/** A doc whose first author is one of these keys. The rule of `otherWorksByAuthor` and `authorCandidates`. */
function firstAuthorIs(doc: OlSearchDoc, keys: readonly string[]): boolean {
  const first = doc.author_key?.[0]?.replace('/authors/', '');
  return !!first && keys.includes(first);
}

/** The name the catalogue gives the author on her own records, for the heading. */
export function authorNameFrom(docs: readonly OlSearchDoc[], authorKey: string): string | undefined {
  return docs.find(d => firstAuthorIs(d, [authorKey]))?.author_name?.[0]?.trim() || undefined;
}

/**
 * One author's works as result cards, most-printed first.
 *
 * 1. One of her keys must be the record's first — anthologies, books about
 *    her and letters to her stay out.
 * 2. No secondary literature, no marked adaptation, no volume of a split
 *    edition; `parseSearchDocs` drops records without cover or that are not
 *    books.
 * 3. Identity rule 2 (`mergeWorks`): same title and author, one card.
 */
export function authorResultWorks(docs: readonly OlSearchDoc[], keys: readonly string[]): WorkSummary[] {
  const own = docs.filter(d => {
    if (!firstAuthorIs(d, keys)) return false;
    const title = d.title?.trim() ?? '';
    return !!title && !looksLikeSecondaryLiterature(title) && !MARKED_DERIVATIVE.test(title) && !looksLikeVolumePart(title);
  });
  return mergeWorks(parseSearchDocs(own))
    .sort((a, b) => (b.editionCount ?? 0) - (a.editionCount ?? 0))
    .map((w, i) => ({ ...w, sourceRank: i }));
}

/** What the address says about an author search: `?author=<name>` and optionally `&key=OL…A`. */
export interface AuthorQuery {
  name: string;
  key?: string;
}

/** Reads `author` and `key` from the address; a malformed key is ignored, never trusted. */
export function parseAuthorQuery(name: string | null | undefined, key: string | null | undefined): AuthorQuery | null {
  const n = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const k = (key ?? '').trim();
  const validKey = isAuthorKey(k) ? k : undefined;
  if (!n && !validKey) return null;
  return validKey ? { name: n, key: validKey } : { name: n };
}

/** The site's own author search for a name, pinned to a key when one is known. */
export { authorSearchHref as authorSearchPath } from './authorworks';
