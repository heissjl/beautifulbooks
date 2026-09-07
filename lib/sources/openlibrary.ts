/**
 * Open Library client (SPEC §3 F3.1). Server-side only.
 *
 * Search failures degrade to an empty result (F3.3). Work and edition lookups
 * throw on transport errors and return null / empty on 404, so the detail
 * page can tell "not found" from "temporarily unavailable".
 */
import type { Work, WorkSummary } from '../model';
import { cleanAuthorEntries, cleanAuthors } from '../normalize';
import { debug } from '../debug';
import { HttpError, SourceUnavailableError, fetchJson } from './http';
import { olWorkId, parseSearchDocs, type OlEditionEntry, type OlSearchDoc } from './openlibrary-parse';

const BASE = 'https://openlibrary.org';

export const OL_TIMEOUTS = {
  /**
   * 12 s, not 8. Measured 2026-09-07 over twelve cold searches straight at
   * Open Library with no cap: seven answered inside 8 s, **three answered
   * between 9 and 10 s**, one took 24 s and one never came. The old 8 s cap
   * therefore turned a third of the slow-but-fine answers into failures.
   * Raising it costs a longer wait in the bad case; the skeleton is on screen
   * for it, and since F1.7 the wait now ends in an error a reader can act on
   * rather than in "no books found".
   */
  search: 12_000,
  work: 5_000,
  editions: 12_000,
} as const;

export const OL_REVALIDATE = {
  search: 60 * 60,
  work: 24 * 60 * 60,
  editions: 24 * 60 * 60,
} as const;

const SEARCH_FIELDS = [
  'key', 'title', 'subtitle', 'author_name', 'author_key', 'first_publish_year',
  'edition_count', 'cover_i', 'cover_edition_key', 'language',
  // Popularity: Open Library ranks by these and we use them too (SPEC §9.3 step 10).
  'readinglog_count', 'want_to_read_count', 'ratings_count',
].join(',');

interface OlSearchResponse {
  numFound?: number;
  docs?: OlSearchDoc[];
}

interface OlWorkResponse {
  key: string;
  title?: string;
  authors?: Array<{ author?: { key: string } }>;
  first_publish_date?: string;
}

interface OlAuthorResponse {
  name?: string;
  personal_name?: string;
}

export interface OlEditionsPage {
  entries: OlEditionEntry[];
  /** Total number of editions of the work at Open Library. */
  size: number;
}

export interface OlEditionsResponse {
  size?: number;
  entries?: OlEditionEntry[];
}

export const OL_SEARCH_LIMIT = 20;
export const OL_EDITIONS_PAGE = 100;

/**
 * F1.1: free-text search.
 *
 * **Throws `SourceUnavailableError` when Open Library does not answer**, and
 * returns an empty list only when Open Library answered and had nothing. The
 * two used to be the same value, and the reader was told "No books found" for
 * a book with hundreds of editions: four of roughly fourteen cold searches on
 * 2026-09-07 ran into the timeout and said exactly that (SPEC §3 F3.3).
 *
 * A missing `docs` array counts as no answer too. Open Library replies 200
 * with a body that has no `docs` when it is unhappy in ways it does not spell
 * out, and reading that as "nothing found" is the same lie in a smaller hat.
 */
export async function searchWorks(query: string, limit = OL_SEARCH_LIMIT): Promise<WorkSummary[]> {
  const url = `${BASE}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=${SEARCH_FIELDS}`;
  let data: OlSearchResponse;
  try {
    data = await fetchJson<OlSearchResponse>(url, {
      timeoutMs: OL_TIMEOUTS.search, revalidate: OL_REVALIDATE.search,
    });
  } catch (err) {
    debug('openlibrary', `search failed: ${(err as Error).message}`);
    throw new SourceUnavailableError('openlibrary', err);
  }
  if (!Array.isArray(data.docs)) {
    debug('openlibrary', 'search answered without a docs array');
    throw new SourceUnavailableError('openlibrary', new Error('response had no docs array'));
  }
  return parseSearchDocs(data.docs);
}

/**
 * Loads a work with author names.
 *
 * Primary path: one search request filtered by key, which returns author
 * names, edition count and languages in a single round trip. Fallback for
 * works missing from the search index: the work document plus one request
 * per author key (the document carries keys only).
 * Returns null when neither path finds the work.
 */
export async function getWork(workId: string): Promise<Work | null> {
  const fromSearch = await getWorkViaSearch(workId);
  if (fromSearch) return fromSearch;
  return getWorkViaDocument(workId);
}

async function getWorkViaSearch(workId: string): Promise<Work | null> {
  const url = `${BASE}/search.json?q=key:/works/${encodeURIComponent(workId)}&limit=1&fields=${SEARCH_FIELDS}`;
  try {
    const data = await fetchJson<OlSearchResponse>(url, {
      timeoutMs: OL_TIMEOUTS.work, revalidate: OL_REVALIDATE.work,
    });
    const doc = data.docs?.[0];
    if (!doc || olWorkId(doc.key) !== workId || !doc.title) return null;
    const entries = cleanAuthorEntries(doc.author_name, doc.author_key);
    if (entries.length === 0) return null;
    return {
      id: workId,
      title: doc.title,
      authors: entries.map(a => a.name),
      authorKeys: entries.every(a => a.key) ? entries.map(a => a.key!) : undefined,
      firstPublishYear: doc.first_publish_year,
      editionCount: doc.edition_count,
    };
  } catch (err) {
    debug('openlibrary', `work search ${workId} failed: ${(err as Error).message}`);
    return null;
  }
}

async function getWorkViaDocument(workId: string): Promise<Work | null> {
  let work: OlWorkResponse;
  try {
    work = await fetchJson<OlWorkResponse>(`${BASE}/works/${encodeURIComponent(workId)}.json`, {
      timeoutMs: OL_TIMEOUTS.work, revalidate: OL_REVALIDATE.work,
    });
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null;
    throw err;
  }
  if (!work.title) return null;

  const authorKeys = (work.authors ?? [])
    .map(a => a.author?.key)
    .filter((k): k is string => !!k)
    .slice(0, 5);
  const names = await Promise.all(authorKeys.map(getAuthorName));
  const authors = cleanAuthors(names.filter((n): n is string => !!n));

  return {
    id: workId,
    title: work.title,
    authors: authors.length ? authors : ['Unknown'],
    firstPublishYear: work.first_publish_date ? Number(work.first_publish_date.match(/\d{4}/)?.[0]) || undefined : undefined,
  };
}

async function getAuthorName(key: string): Promise<string | undefined> {
  try {
    const a = await fetchJson<OlAuthorResponse>(`${BASE}${key}.json`, {
      timeoutMs: OL_TIMEOUTS.work, revalidate: OL_REVALIDATE.work,
    });
    return a.name ?? a.personal_name;
  } catch (err) {
    debug('openlibrary', `author ${key} failed: ${(err as Error).message}`);
    return undefined;
  }
}

/** One page of raw edition entries. Returns an empty page on 404, throws otherwise. */
export async function getEditionsPage(workId: string, offset = 0, limit = OL_EDITIONS_PAGE): Promise<OlEditionsPage> {
  const url = `${BASE}/works/${encodeURIComponent(workId)}/editions.json?limit=${limit}&offset=${offset}`;
  try {
    const data = await fetchJson<OlEditionsResponse>(url, {
      timeoutMs: OL_TIMEOUTS.editions, revalidate: OL_REVALIDATE.editions,
    });
    return { entries: data.entries ?? [], size: data.size ?? data.entries?.length ?? 0 };
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return { entries: [], size: 0 };
    throw err;
  }
}
