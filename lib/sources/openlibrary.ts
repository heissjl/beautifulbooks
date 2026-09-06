/**
 * Open Library client (SPEC §3 F3.1). Server-side only.
 *
 * Search failures degrade to an empty result (F3.3). Work and edition lookups
 * throw on transport errors and return null / empty on 404, so the detail
 * page can tell "not found" from "temporarily unavailable".
 */
import type { SourceEdition, Work, WorkSummary } from '../model';
import { cleanAuthorEntries, cleanAuthors } from '../normalize';
import { debug } from '../debug';
import { HttpError, fetchJson } from './http';
import {
  olWorkId, parseEditions, parseSearchDocs, type OlEditionEntry, type OlSearchDoc,
} from './openlibrary-parse';

const BASE = 'https://openlibrary.org';

export const OL_TIMEOUTS = {
  search: 8_000,
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

/** F1.1: free-text search. Never throws. */
export async function searchWorks(query: string, limit = OL_SEARCH_LIMIT): Promise<WorkSummary[]> {
  const url = `${BASE}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=${SEARCH_FIELDS}`;
  try {
    const data = await fetchJson<OlSearchResponse>(url, {
      timeoutMs: OL_TIMEOUTS.search, revalidate: OL_REVALIDATE.search,
    });
    return parseSearchDocs(data.docs ?? []);
  } catch (err) {
    debug('openlibrary', `search failed: ${(err as Error).message}`);
    return [];
  }
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

export interface EditionsOptions {
  /** Stop paging once this many editions with covers were found. */
  minWithCovers?: number;
  /** Never read more than this many raw entries. */
  maxEntries?: number;
}

/**
 * Editions with covers for a work. Pages through the editions endpoint
 * (100 per call, only ~25 % have covers) until enough covers are found or
 * the entry budget is spent (SPEC §7 step 4 note).
 */
export async function getEditions(
  work: Work,
  { minWithCovers = 24, maxEntries = 500 }: EditionsOptions = {},
): Promise<SourceEdition[]> {
  const out: SourceEdition[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total && offset < maxEntries && out.length < minWithCovers) {
    const page = await getEditionsPage(work.id, offset, OL_EDITIONS_PAGE);
    total = page.size;
    out.push(...parseEditions(page.entries, work));
    if (page.entries.length < OL_EDITIONS_PAGE) break;
    offset += OL_EDITIONS_PAGE;
  }
  return out;
}
