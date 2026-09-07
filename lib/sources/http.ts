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
