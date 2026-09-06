/**
 * Search orchestration (SPEC §3 F1, §4 N2). Server-side only.
 *
 * Exactly two external calls per search: Open Library (creates works) and
 * Google Books (adds covers to those works, never creates works). Both run in
 * parallel; either may fail without failing the search.
 */
import type { WorkSummary } from './model';
import { searchVolumes } from './sources/googlebooks';
import { searchWorks } from './sources/openlibrary';
import { attachCandidates, filterWorksByLanguage, mergeWorks, mosaicCovers, rankWorks } from './works';

export const DEFAULT_LANGUAGE = 'all';
export const MAX_QUERY_LENGTH = 200;

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

export async function search(rawQuery: string, options: SearchOptions = {}): Promise<SearchResult> {
  const query = normalizeQuery(rawQuery);
  const language = normalizeLanguageOption(options.language);
  if (!query) return { query, language, works: [] };

  const [olWorks, gbCandidates] = await Promise.all([searchWorks(query), searchVolumes(query)]);

  const works = rankWorks(
    filterWorksByLanguage(attachCandidates(mergeWorks(olWorks), gbCandidates), language),
    query,
  ).map(w => ({ ...w, coverUrls: mosaicCovers(w) }));

  return { query, language, works };
}
