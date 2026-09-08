/**
 * Shared HTTP helper for the source clients: timeout, Next.js data cache,
 * typed errors. No logging here; callers decide what a failure means.
 */
import { debug } from '../debug';

/** How much of an error response to keep; enough to read a reason code. */
export const ERROR_BODY_MAX = 500;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    /**
     * The start of the error response, when it could be read. Google answers
     * 403 both for an exhausted quota and for a bad key, and only the body
     * says which (lib/googlequota.ts).
     */
    public readonly body = '',
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
  }
}

/**
 * A source was asked and did not give an answer: it timed out, the network
 * failed, or it replied with an error status.
 *
 * This exists so that "the catalogue did not answer" can never be mistaken
 * for "the catalogue has nothing" (SPEC §3 F1.7, F3.3, §4 N12). A client that
 * swallows a failure into an empty list tells the reader their book does not
 * exist, which is the one thing this site must not do.
 */
export class SourceUnavailableError extends Error {
  constructor(
    /** Which catalogue stayed silent, for the message and for logging. */
    public readonly source: 'openlibrary' | 'googlebooks',
    public readonly cause?: unknown,
  ) {
    super(`${source} did not answer: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'SourceUnavailableError';
  }
}

/** Reads an error body without letting that reading become the failure. */
async function errorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, ERROR_BODY_MAX);
  } catch {
    return '';
  }
}

export interface FetchJsonOptions {
  /** Abort after this many milliseconds. */
  timeoutMs: number;
  /** Next.js data-cache lifetime in seconds (SPEC §4 N4). Ignored outside Next. */
  revalidate: number;
}

const USER_AGENT = 'BeautifulBooks/0.1 (https://github.com/julianheiss/beautifulbooks)';

/**
 * Fetches JSON with a timeout. Throws HttpError for non-2xx, and the
 * underlying error (AbortError / TypeError) for timeouts and network failures.
 */
export async function fetchJson<T>(url: string, { timeoutMs, revalidate }: FetchJsonOptions): Promise<T> {
  const started = Date.now();
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    next: { revalidate },
  });
  debug('http', `${res.status} ${Date.now() - started}ms ${url}`);
  if (!res.ok) throw new HttpError(res.status, url, await errorBody(res));
  return (await res.json()) as T;
}

export function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
}

/**
 * Whether a failure means "the source gave no answer", and asking again could
 * therefore produce one: a timeout, a network error, a body that could not be
 * read, or a 5xx, which is the server saying it is having trouble.
 *
 * A 4xx is **never** silence. The request itself was wrong, so a second one
 * would be wrong in the same way — a 422 for a query under three characters
 * (SPEC §3 F1.7) or a 429 from a rate limit are answers, not outages, and
 * repeating them only adds load.
 */
export function isSilence(err: unknown): boolean {
  if (err instanceof HttpError) return err.status >= 500;
  return true;
}

/**
 * Fetches raw bytes (cover images) with a timeout and the Next data cache.
 * Follows redirects (Open Library covers redirect to archive.org).
 */
export async function fetchBytes(url: string, { timeoutMs, revalidate }: FetchJsonOptions): Promise<Uint8Array> {
  const started = Date.now();
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate },
  });
  debug('http', `${res.status} ${Date.now() - started}ms ${url}`);
  if (!res.ok) throw new HttpError(res.status, url);
  return new Uint8Array(await res.arrayBuffer());
}
