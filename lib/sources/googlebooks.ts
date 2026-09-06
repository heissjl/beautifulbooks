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
