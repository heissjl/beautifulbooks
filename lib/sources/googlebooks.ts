/**
 * Google Books client (SPEC §3 F3.2). Server-side only, supplementary.
 *
 * Without GOOGLE_BOOKS_API_KEY the shared anonymous quota applies and the
 * API frequently answers 429; every failure degrades to an empty result so
 * the app keeps working on Open Library alone (F3.3).
 */
import { debug } from '../debug';
import { fetchJson } from './http';
import { parseVolumes, type EditionCandidate, type GbVolume } from './googlebooks-parse';

const BASE = 'https://www.googleapis.com/books/v1/volumes';

export const GB_TIMEOUT_MS = 5_000;
export const GB_REVALIDATE = 60 * 60;
export const GB_SEARCH_LIMIT = 20;

interface GbSearchResponse {
  totalItems?: number;
  items?: GbVolume[];
}

function apiKeyParam(): string {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  return key ? `&key=${encodeURIComponent(key)}` : '';
}

/** Title search. Never throws. */
export async function searchVolumes(query: string, limit = GB_SEARCH_LIMIT): Promise<EditionCandidate[]> {
  const url = `${BASE}?q=intitle:${encodeURIComponent(query)}&maxResults=${limit}&printType=books&orderBy=relevance${apiKeyParam()}`;
  try {
    const data = await fetchJson<GbSearchResponse>(url, { timeoutMs: GB_TIMEOUT_MS, revalidate: GB_REVALIDATE });
    return parseVolumes(data.items);
  } catch (err) {
    debug('googlebooks', `search failed: ${(err as Error).message}`);
    return [];
  }
}

/**
 * Candidates for the detail page: title + author search, up to 40 results.
 * Assignment to the work happens in works.ts (candidatesToEditions).
 */
export async function searchEditionCandidates(title: string, author: string | undefined): Promise<EditionCandidate[]> {
  const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;
  const url = `${BASE}?q=${encodeURIComponent(q)}&maxResults=40&printType=books&orderBy=relevance${apiKeyParam()}`;
  try {
    const data = await fetchJson<GbSearchResponse>(url, { timeoutMs: GB_TIMEOUT_MS, revalidate: GB_REVALIDATE });
    return parseVolumes(data.items);
  } catch (err) {
    debug('googlebooks', `editions failed: ${(err as Error).message}`);
    return [];
  }
}

export const GB_ISBN_LOOKUP_MAX = 10;

/**
 * Current cover per ISBN (SPEC §3 F2.2, E8): Google usually carries the
 * publisher's current image, which reveals reprints that changed the cover
 * under an unchanged ISBN. One request per ISBN, so the list is capped; only
 * runs when an API key is configured because the anonymous quota is tiny.
 */
export async function lookupByIsbns(isbns: readonly string[], max = GB_ISBN_LOOKUP_MAX): Promise<EditionCandidate[]> {
  if (!process.env.GOOGLE_BOOKS_API_KEY) return [];
  const unique = Array.from(new Set(isbns)).slice(0, max);
  const results = await Promise.all(unique.map(async isbn => {
    const url = `${BASE}?q=isbn:${encodeURIComponent(isbn)}&maxResults=3${apiKeyParam()}`;
    try {
      const data = await fetchJson<GbSearchResponse>(url, { timeoutMs: GB_TIMEOUT_MS, revalidate: 24 * 60 * 60 });
      // Keep only volumes that really carry the ISBN; Google sometimes pads results.
      return parseVolumes(data.items).filter(c => c.isbn13 === isbn);
    } catch (err) {
      debug('googlebooks', `isbn ${isbn} failed: ${(err as Error).message}`);
      return [];
    }
  }));
  return results.flat();
}

/**
 * The volumes Google lists for one ISBN. Unlike `lookupByIsbns` this reports
 * failure instead of swallowing it: Google Books answers a transient 503 for
 * roughly one request in three at times (measured 2026-09-07), and a failed
 * request must not be shown to the reader as "no cover on record"
 * (SPEC §9.3 step 13).
 *
 * Returns null when no API key is configured, because the anonymous quota is
 * too small to ask per ISBN.
 */
export async function lookupIsbnOrThrow(isbn13: string): Promise<EditionCandidate[] | null> {
  if (!process.env.GOOGLE_BOOKS_API_KEY) return null;
  const url = `${BASE}?q=isbn:${encodeURIComponent(isbn13)}&maxResults=3${apiKeyParam()}`;
  const data = await fetchJson<GbSearchResponse>(url, { timeoutMs: GB_TIMEOUT_MS, revalidate: 24 * 60 * 60 });
  // Google pads results; keep only volumes that really carry the ISBN.
  return parseVolumes(data.items).filter(c => c.isbn13 === isbn13);
}
