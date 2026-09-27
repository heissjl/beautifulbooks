/**
 * Search orchestration (SPEC §3 F1, §4 N2). Server-side only.
 *
 * Exactly **one** external call per search: Open Library, which is also the
 * only source that creates works (E5).
 *
 * Google Books used to run alongside it and hang extra covers on the result
 * cards. Since §9.3 step 14 each card loads its own mosaic from the work's
 * first edition page, and that made the second call pointless: measured over
 * five searches and 82 works on 2026-09-07, Google added covers to six cards,
 * and for every one of them Open Library alone already filled all four tiles.
 * What was left was one extra language per five searches, for one request out
 * of a daily quota of 1,000 (§8.7). So a search now costs no quota at all.
 */
import type { WorkSummary } from './model';
import { authorNameFrom, authorResultWorks, pickAuthor, WEAK_AUTHOR_READERS, type AuthorQuery, type ResolvedAuthor } from './authorsearch';
import { searchVocabulary } from './lexicon';
import { BETTER_FACTOR, correctionIsBetter, correctQuery, isWeakResult, type Vocabulary } from './spelling';
import { OL_TIMEOUTS, searchAuthorsByName, searchAuthorWorks, searchWorks } from './sources/openlibrary';
import { debug } from './debug';
import { filterWorksByLanguage, mergeWorks, mosaicCovers, rankWorks } from './works';

export const DEFAULT_LANGUAGE = 'all';
export const MAX_QUERY_LENGTH = 200;

/**
 * Open Library refuses a shorter query with HTTP 422 ("Query too short, must
 * be at least 3 characters"). Asking anyway and showing the refusal as "No
 * books found" would tell the reader that *It* does not exist, so the check
 * happens here and the route turns it into a 400 the UI can word properly.
 */
export const MIN_QUERY_LENGTH = 3;

/**
 * The corrected query's search gets one attempt and eight seconds (ROADMAP
 * 6.60): the reader already waited for the first answer, and a correction
 * that does not come is no worse than none.
 */
export const CORRECTION_TIMEOUT_MS = 8_000;

export interface SearchOptions {
  /** ISO 639-1 code or 'all' (default, decision E2). */
  language?: string;
  /** `?exact=1`: the reader asked for what they typed, no correction (6.60). */
  exact?: boolean;
  /** For tests; the server uses the lexicon (lib/lexicon.ts). */
  vocabulary?: Vocabulary;
}

/**
 * What the typo correction did (ROADMAP 6.60, SPEC F1.9).
 * `applied`: the works are the answer to `to`, not to `from`.
 * Not applied: `to` is only a suggestion — Open Library had nothing for
 * `from`, and the search for `to` did not answer in time.
 */
export interface SearchCorrection {
  from: string;
  to: string;
  applied: boolean;
}

export interface SearchResult {
  query: string;
  language: string;
  works: WorkSummary[];
  correction?: SearchCorrection;
}

export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

export function normalizeLanguageOption(raw: string | null | undefined): string {
  const v = (raw ?? '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(v) ? v : DEFAULT_LANGUAGE;
}

function finish(works: WorkSummary[], query: string, language: string): WorkSummary[] {
  return rankWorks(filterWorksByLanguage(works, language), query).map(w => ({ ...w, coverUrls: mosaicCovers(w) }));
}

/**
 * Runs a search. **Throws `SourceUnavailableError` when Open Library does not
 * answer**; an empty `works` means Open Library answered and had nothing.
 * Callers must keep those two apart (SPEC §3 F1.7).
 *
 * One external call, and a second one only when the first answer is empty or
 * weak **and** a word of the query is one edit or two from a word the site
 * knows (ROADMAP 6.60). The weakness is judged before the language filter:
 * a filter that empties the list says nothing about the spelling.
 */
export async function search(rawQuery: string, options: SearchOptions = {}): Promise<SearchResult> {
  const query = normalizeQuery(rawQuery);
  const language = normalizeLanguageOption(options.language);
  // Nobody asked anything answerable: no call, and no claim about the world.
  if (query.length < MIN_QUERY_LENGTH) return { query, language, works: [] };

  const merged = mergeWorks(await searchWorks(query));
  if (options.exact || !isWeakResult(merged)) return { query, language, works: finish(merged, query, language) };

  const correction = correctQuery(query, options.vocabulary ?? searchVocabulary());
  if (!correction || correction.to.length < MIN_QUERY_LENGTH) {
    return { query, language, works: finish(merged, query, language) };
  }

  let corrected: WorkSummary[];
  try {
    corrected = mergeWorks(await searchWorks(correction.to, { attempts: 1, timeoutMs: CORRECTION_TIMEOUT_MS }));
  } catch (err) {
    debug('search', `correction "${correction.to}" did not answer: ${(err as Error).message}`);
    // Nothing found and nothing checked: offer the word, claim nothing about it.
    const suggestion = merged.length === 0 ? { ...correction, applied: false } : undefined;
    return { query, language, works: finish(merged, query, language), ...(suggestion ? { correction: suggestion } : {}) };
  }

  if (!correctionIsBetter(merged, corrected)) return { query, language, works: finish(merged, query, language) };
  return { query, language, works: finish(corrected, correction.to, language), correction: { ...correction, applied: true } };
}

/**
 * "Only this author" (ROADMAP 6.60, SPEC F1.10).
 *
 * With a key (`?author=<name>&key=OL…A`, the "More by …" link): one call, the
 * same one the row under a wall makes, so the two share a cached answer.
 * With a name only: first Open Library's author search, which knows
 * alternate names (`Dostojewski` → OL22242A), then the works. A name nobody
 * matches is an answer (no works, no author), not a failure.
 *
 * **Throws `SourceUnavailableError` when Open Library does not answer.**
 */
export interface AuthorSearchResult {
  /** What was typed or linked. */
  query: string;
  /** Who it was taken to mean; absent when no one matched the name. */
  author?: { key: string; name: string };
  works: WorkSummary[];
  /** The name was misspelt and the person was found under the corrected one (6.60). */
  correction?: SearchCorrection;
}

/**
 * Who a typed name means, with one second look when the first answer is a
 * namesake nobody reads and a word of the name is a near miss of a name the
 * site knows (`Tolkein` → Tolkien). The corrected person replaces the first
 * only with `BETTER_FACTOR` times the readers and at least
 * `WEAK_AUTHOR_READERS`. A second lookup that stays silent keeps the first.
 */
async function resolveAuthorName(name: string, vocabulary?: Vocabulary): Promise<{ author?: ResolvedAuthor; correction?: SearchCorrection }> {
  const first = pickAuthor(await searchAuthorsByName(name));
  if (first && first.readers >= WEAK_AUTHOR_READERS) return { author: first };
  const correction = correctQuery(name, vocabulary ?? searchVocabulary());
  if (!correction) return { author: first };
  let second: ResolvedAuthor | undefined;
  try {
    second = pickAuthor(await searchAuthorsByName(correction.to));
  } catch (err) {
    debug('search', `author correction "${correction.to}" did not answer: ${(err as Error).message}`);
    return { author: first };
  }
  const better = second && second.readers >= WEAK_AUTHOR_READERS && second.readers >= BETTER_FACTOR * Math.max(1, first?.readers ?? 0);
  return better ? { author: second, correction: { ...correction, applied: true } } : { author: first };
}

export async function searchByAuthor(input: AuthorQuery, options: { vocabulary?: Vocabulary } = {}): Promise<AuthorSearchResult> {
  const query = input.name;
  let resolved: { author?: ResolvedAuthor; correction?: SearchCorrection } = {};
  if (query.length >= MIN_QUERY_LENGTH) {
    try {
      resolved = await resolveAuthorName(query, options.vocabulary);
    } catch (err) {
      // With a key from a link the works can still be asked; without one this is silence.
      if (!input.key) throw err;
      debug('search', `author lookup failed, going by the key alone: ${(err as Error).message}`);
    }
  }
  /*
    A key from a link (the "More by …" heading) always counts, even when the
    name finds someone else first: it is the record the reader came from.
    The name adds her other records — the link from *Nineteen Eighty-Four*
    carries OL15318546A, a record with two works.
  */
  const found = resolved.author;
  const sameAsLink = !input.key || !found || found.keys.includes(input.key);
  // In the name's order when the link agrees, so a linked and a typed search share one cached answer.
  const keys = found && sameAsLink ? found.keys : input.key ? [input.key] : [];
  if (keys.length === 0) return { query, works: [] };

  const docs = await searchAuthorWorks(keys, OL_TIMEOUTS.search);
  const works = authorResultWorks(docs, keys).map(w => ({ ...w, coverUrls: mosaicCovers(w) }));
  const mainKey = sameAsLink && found ? found.key : keys[0];
  // The catalogue's spelling of her name, not whatever the link or the reader typed.
  const name = authorNameFrom(docs, mainKey) ?? (sameAsLink && found ? found.name : query);
  const correction = sameAsLink ? resolved.correction : undefined;
  return { query, author: { key: mainKey, name: name || mainKey }, works, ...(correction ? { correction } : {}) };
}
