/**
 * Shared HTTP helper for the source clients: timeout, Next.js data cache,
 * typed errors. No logging here; callers decide what a failure means.
 */
import { debug } from '../debug';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
    this.name = 'HttpError';
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
  if (!res.ok) throw new HttpError(res.status, url);
  return (await res.json()) as T;
}

export function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
}
