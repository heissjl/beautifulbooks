/**
 * Detail-page orchestration (SPEC §3 F2). Server-side only.
 *
 * Loads the work, its Open Library editions (paged until enough covers) and
 * Google Books candidates in parallel, dedupes, and groups by language.
 */
import type { Edition, LanguageGroup, Work } from './model';
import { searchEditionCandidates } from './sources/googlebooks';
import { getEditions, getWork } from './sources/openlibrary';
import { candidatesToEditions, dedupeEditions, groupEditionsByLanguage } from './works';

export interface WorkDetail {
  work: Work;
  editions: Edition[];
  groups: LanguageGroup[];
}

export interface WorkDetailOptions {
  /** Language to list first (the search filter the user came from). */
  preferredLanguage?: string;
  /** Stop paging Open Library once this many covers were found. */
  minWithCovers?: number;
}

const WORK_ID = /^OL\d+W$/;

export function isWorkId(id: string | undefined): id is string {
  return !!id && WORK_ID.test(id);
}

/**
 * Returns null for unknown or malformed ids. Throws when Open Library is
 * unreachable so the page can render an error rather than "not found".
 */
export async function getWorkDetail(workId: string, options: WorkDetailOptions = {}): Promise<WorkDetail | null> {
  if (!isWorkId(workId)) return null;
  const work = await getWork(workId);
  if (!work) return null;

  const [olEditions, gbCandidates] = await Promise.all([
    getEditions(work, { minWithCovers: options.minWithCovers }),
    searchEditionCandidates(work.title, work.authors[0]),
  ]);

  const editions = dedupeEditions([...olEditions, ...candidatesToEditions(work, gbCandidates)]);
  const groups = groupEditionsByLanguage(editions, options.preferredLanguage);
  return { work, editions, groups };
}
