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
import { robustFirstPublishYear } from '../firstyear';
import { HttpError, SourceUnavailableError, fetchJson, isSilence } from './http';
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
  /**
   * 24 h, not 1 h (ROADMAP 1.10, 2026-09-08). The result list for a title is
   * as stable as the book metadata behind it, which is why the work, the
   * editions and the Google title search were already cached for a day or
   * more. An hour bought freshness nobody asked for and paid for it in the
   * one currency this source is short of: a cold search from Germany fails
   * more often than it succeeds. A day means the retry below has to rescue
   * only the first reader of a query, not every reader in the next hour.
   * Price: a newly catalogued work shows up a day late.
   */
  search: 24 * 60 * 60,
  work: 24 * 60 * 60,
  editions: 24 * 60 * 60,
} as const;

/**
 * A failed search is asked again once (ROADMAP 1.10, SPEC §3 F3.3).
 *
 * Measured 2026-09-08 from Germany over four cold searches: **three failed**,
 * two with `fetch failed` and one in the 12 s timeout, and the very same call
 * immediately afterwards returned all four in full. The reader was already
 * doing this by hand — F1.7 gives them a "Try again" button and it works —
 * so the server can spend that press itself before it gives up.
 */
export const SEARCH_RETRY = {
  /** Attempts in total, not retries: 2 means one second chance. */
  attempts: 2,
  /** Breath between the attempts. The manual retry that worked was immediate. */
  pauseMs: 300,
  /**
   * Cap on all attempts together. Two full timeouts would be 24 s of staring
   * at a skeleton; the cap keeps the worst case near 20 s, and the per-attempt
   * timeout is trimmed to what is left.
   */
  totalMs: 20_000,
  /**
   * With less than this left, a second attempt is a worse bet than an honest
   * failure: ten of eleven answered searches arrived inside 10 s (SPEC §7), so
   * a five-second window mostly buys another timeout and a longer wait.
   */
  minAttemptMs: 5_000,
} as const;

const SEARCH_FIELDS = [
  'key', 'title', 'subtitle', 'author_name', 'author_key', 'first_publish_year',
  // The whole year list, so a single bad record cannot date a book to 1777
  // (ROADMAP 6.16). It rides along in the same request and costs nothing.
  'publish_year',
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
 * A missing `docs` array counts as no answer too (`searchOnce`).
 *
 * Silence is asked once more before it is reported (`SEARCH_RETRY`), because
 * silence here is the common case and not the exception.
 */
export async function searchWorks(query: string, limit = OL_SEARCH_LIMIT): Promise<WorkSummary[]> {
  const url = `${BASE}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&fields=${SEARCH_FIELDS}`;
  const started = Date.now();
  let failure: unknown;

  for (let attempt = 1; attempt <= SEARCH_RETRY.attempts; attempt++) {
    const left = SEARCH_RETRY.totalMs - (Date.now() - started);
    try {
      const docs = await searchOnce(url, Math.min(OL_TIMEOUTS.search, left));
      if (attempt > 1) debug('openlibrary', `search answered on attempt ${attempt}`);
      return parseSearchDocs(docs);
    } catch (err) {
      failure = err;
      debug('openlibrary', `search attempt ${attempt} failed: ${(err as Error).message}`);
      // A 4xx is an answer about this request; asking again repeats the fault.
      if (!isSilence(err)) break;
      if (attempt === SEARCH_RETRY.attempts) break;
      await sleep(SEARCH_RETRY.pauseMs);
      if (SEARCH_RETRY.totalMs - (Date.now() - started) < SEARCH_RETRY.minAttemptMs) {
        debug('openlibrary', 'no time left for another attempt');
        break;
      }
    }
  }
  throw new SourceUnavailableError('openlibrary', failure);
}

/**
 * One attempt. A 200 whose body has no `docs` array counts as no answer:
 * Open Library replies that way when it is unhappy in ways it does not spell
 * out, and reading it as "nothing found" is the same lie in a smaller hat.
 */
async function searchOnce(url: string, timeoutMs: number): Promise<OlSearchDoc[]> {
  const data = await fetchJson<OlSearchResponse>(url, {
    timeoutMs, revalidate: OL_REVALIDATE.search,
  });
  if (!Array.isArray(data.docs)) throw new Error('response had no docs array');
  return data.docs;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
      // Same guard as the search path: one bad record must not date a work (6.16).
      firstPublishYear: robustFirstPublishYear(doc.first_publish_year, doc.publish_year),
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
