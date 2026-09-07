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
import { searchWorks } from './sources/openlibrary';
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

export interface SearchOptions {
  /** ISO 639-1 code or 'all' (default, decision E2). */
  language?: string;
}

export interface SearchResult {
  query: string;
  language: string;
  works: WorkSummary[];
}

export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

export function normalizeLanguageOption(raw: string | null | undefined): string {
  const v = (raw ?? '').trim().toLowerCase();
  return /^[a-z]{2}$/.test(v) ? v : DEFAULT_LANGUAGE;
}

/**
 * Runs a search. **Throws `SourceUnavailableError` when Open Library does not
 * answer**; an empty `works` means Open Library answered and had nothing.
 * Callers must keep those two apart (SPEC §3 F1.7).
 */
export async function search(rawQuery: string, options: SearchOptions = {}): Promise<SearchResult> {
  const query = normalizeQuery(rawQuery);
  const language = normalizeLanguageOption(options.language);
  // Nobody asked anything answerable: no call, and no claim about the world.
  if (query.length < MIN_QUERY_LENGTH) return { query, language, works: [] };

  const olWorks = await searchWorks(query);

  const works = rankWorks(
    filterWorksByLanguage(mergeWorks(olWorks), language),
    query,
  ).map(w => ({ ...w, coverUrls: mosaicCovers(w) }));

  return { query, language, works };
}
