/**
 * Detail-page orchestration (SPEC §3 F2, E8). Server-side only.
 *
 * Loads the work, its Open Library editions (paged until enough covers) and
 * Google Books candidates in parallel; then looks up the current Google cover
 * for the newest ISBNs; merges same-ISBN editions while keeping every cover;
 * groups covers by language.
 */
import type { Cover, Edition, LanguageGroup, Work } from './model';
import { lookupByIsbns, searchEditionCandidates } from './sources/googlebooks';
import { getEditions, getWork } from './sources/openlibrary';
import {
  assembleEditions, candidatesToSourceEditions, groupCoversByLanguage, isbnCandidatesToSourceEditions,
  withoutTranslators,
} from './works';

export interface WorkDetail {
  work: Work;
  editions: Edition[];
  covers: Cover[];
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
  const cleanWork = withoutTranslators(work, olEditions);

  // Current Google cover for the newest ISBNs (reveals reprints under an old ISBN).
  const newestIsbns = olEditions
    .filter(e => e.isbn13)
    .sort((a, b) => (b.year ?? -1) - (a.year ?? -1))
    .map(e => e.isbn13!);
  const isbnCandidates = await lookupByIsbns(newestIsbns);

  const { editions, covers } = assembleEditions([
    ...olEditions,
    ...candidatesToSourceEditions(work, gbCandidates),
    ...isbnCandidatesToSourceEditions(work.id, isbnCandidates),
  ]);
  const groups = groupCoversByLanguage(covers, editions, options.preferredLanguage);
  return { work: cleanWork, editions, covers, groups };
}
