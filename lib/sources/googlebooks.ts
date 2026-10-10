/**
 * Google Books client (SPEC §3 F3.2). Server-side only, supplementary.
 *
 * Without GOOGLE_BOOKS_API_KEY the shared anonymous quota applies and the
 * API frequently answers 429; every failure degrades to an empty result so
 * the app keeps working on Open Library alone (F3.3).
 */
import { debug } from '../debug';
import { googleAvailable, noteGoogleFailure } from '../googlequota';
import { fieldSearchBroken, fieldSearchKnownBroken } from '../googlefields';
import { fetchJson } from './http';
import { parseVolumes, type EditionCandidate, type GbVolume } from './googlebooks-parse';

const BASE = 'https://www.googleapis.com/books/v1/volumes';

export const GB_TIMEOUT_MS = 5_000;
/**
 * How long a title search stays in the data cache.
 *
 * A week, not the hour it used to be. The quota is 1,000 requests a day and
 * cannot be raised — the console marks it adjustable, but the link behind
 * that leads to the help centre for Google Search (checked 2026-09-07). So
 * the cheapest capacity left is not asking twice. What a title search returns
 * is a book's supplementary covers and description; that a 1949 novel might
 * acquire one is not worth re-asking every hour.
 *
 * The ISBN lookup keeps its 24 hours on purpose: it answers "which cover does
 * the trade ship *today*", and that one has to stay fresh (SPEC §9.3 step 13).
 */
export const GB_REVALIDATE = 7 * 24 * 60 * 60;
/** The one Google answer that must stay fresh: what the trade ships today. */
export const GB_ISBN_REVALIDATE = 24 * 60 * 60;

interface GbSearchResponse {
  totalItems?: number;
  items?: GbVolume[];
}

function apiKeyParam(): string {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  return key ? `&key=${encodeURIComponent(key)}` : '';
}

/**
 * Candidates for the detail page: title + author search, up to 40 results.
 * Assignment to the work happens in works.ts (candidatesToEditions).
 *
 * `silent` says Google did not really answer — not asked (quota, broken field
 * search), an error, or nothing where the canaries say the field search is
 * down (1.13) — so the page can be cached for a minute instead of a day
 * (ROADMAP 2.18e). An empty answer with the canaries listed is an answer.
 */
export async function searchEditionCandidatesChecked(title: string, author: string | undefined): Promise<{ candidates: EditionCandidate[]; silent: boolean }> {
  if (!googleAvailable()) return { candidates: [], silent: true };
  // The field search is answering nothing for everyone (ROADMAP 1.13): asking would only spend quota.
  if (fieldSearchKnownBroken()) return { candidates: [], silent: true };
  const q = author ? `intitle:${title} inauthor:${author}` : `intitle:${title}`;
  const url = `${BASE}?q=${encodeURIComponent(q)}&maxResults=40&printType=books&orderBy=relevance${apiKeyParam()}`;
  try {
    const data = await fetchJson<GbSearchResponse>(url, { timeoutMs: GB_TIMEOUT_MS, revalidate: GB_REVALIDATE });
    // Nothing for a title with hundreds of printings is suspect; the canaries decide (1.13).
    if (!data.items?.length) return { candidates: [], silent: await fieldSearchBroken(countForIsbn) };
    return { candidates: parseVolumes(data.items), silent: false };
  } catch (err) {
    noteGoogleFailure(err);
    debug('googlebooks', `editions failed: ${(err as Error).message}`);
    return { candidates: [], silent: true };
  }
}

/** The candidates alone, for callers that only need them. */
export async function searchEditionCandidates(title: string, author: string | undefined): Promise<EditionCandidate[]> {
  return (await searchEditionCandidatesChecked(title, author)).candidates;
}

/** How many items Google lists for an ISBN by `isbn:` — the canary question of 1.13. Uncached: it must see Google as it is now. */
async function countForIsbn(isbn13: string): Promise<number> {
  const url = `${BASE}?q=isbn:${encodeURIComponent(isbn13)}&maxResults=1${apiKeyParam()}`;
  const data = await fetchJson<GbSearchResponse>(url, { timeoutMs: GB_TIMEOUT_MS, revalidate: 0 });
  return data.items?.length ?? data.totalItems ?? 0;
}

/**
 * The volumes Google lists for one ISBN. It reports failure instead of
 * swallowing it: Google Books answers a transient 503 for
 * roughly one request in three at times (measured 2026-09-07), and a failed
 * request must not be shown to the reader as "no cover on record"
 * (SPEC §9.3 step 13).
 *
 * Returns null when no API key is configured, because the anonymous quota is
 * too small to ask per ISBN.
 */
export async function lookupIsbnOrThrow(isbn13: string): Promise<EditionCandidate[] | null> {
  if (!process.env.GOOGLE_BOOKS_API_KEY) return null;
  // The day's quota is gone: "not known" is the honest answer, and it is the
  // one `null` already stands for. Asking anyway would only collect errors.
  if (!googleAvailable()) return null;
  // Same as not asked (ROADMAP 1.13): the verdict then takes the catalogue path of 1.12.
  if (fieldSearchKnownBroken()) return null;
  const url = `${BASE}?q=isbn:${encodeURIComponent(isbn13)}&maxResults=3${apiKeyParam()}`;
  try {
    const data = await fetchJson<GbSearchResponse>(url, { timeoutMs: GB_TIMEOUT_MS, revalidate: GB_ISBN_REVALIDATE });
    /*
      An empty answer is not believed on its own (1.13): on 2026-10-09 Google
      answered every `isbn:` query with nothing. Two canary ISBNs decide whether
      this is "no record" or "no field search"; in the second case the answer
      is `null`, not `[]`, so the reader is never told "no publisher's image"
      for a question Google did not really answer.
    */
    if (!data.items?.length && await fieldSearchBroken(countForIsbn)) return null;
    // Google pads results; keep only volumes that really carry the ISBN.
    return parseVolumes(data.items).filter(c => c.isbn13 === isbn13);
  } catch (err) {
    noteGoogleFailure(err);
    throw err;
  }
}
