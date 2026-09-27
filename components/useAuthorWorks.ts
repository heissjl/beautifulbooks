'use client';

import { useEffect, useState } from 'react';
import type { AuthorWorksResponse } from '@/app/api/authors/[key]/works/route';
import type { AuthorWork } from '@/lib/authorworks';

/** One second chance after silence, as the plan says (PLAN-6.53 §3.5). */
const RETRY_MS = 1500;

/**
 * Answers already received in this tab, per author. Only answers: a failure
 * is not remembered, so the next wall of the same author asks again.
 */
const ANSWERS = new Map<string, AuthorWork[]>();

export type AuthorWorksState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; works: AuthorWork[] }
  | { status: 'failed' };

/**
 * The candidates for the "More by …" row (ROADMAP 6.53), asked only once
 * `enabled` — the row has come near the screen or the wall has finished
 * loading — so a reader who never scrolls down costs no request.
 *
 * State is keyed by the author, and loading is derived from that key rather
 * than set inside the effect (the repo's `set-state-in-effect` rule).
 */
export function useAuthorWorks(authorKey: string | undefined, enabled: boolean, authorName?: string): AuthorWorksState {
  const [result, setResult] = useState<{ key: string; works: AuthorWork[] | null } | null>(null);
  const known = authorKey ? ANSWERS.get(authorKey) : undefined;
  const wanted = !!authorKey && enabled && !known;

  useEffect(() => {
    if (!wanted || !authorKey) return;
    const controller = new AbortController();
    // The name widens the key to her other records (6.60, plan §6.4).
    const url = `/api/authors/${encodeURIComponent(authorKey)}/works${authorName ? `?name=${encodeURIComponent(authorName)}` : ''}`;

    const ask = (): Promise<AuthorWork[]> =>
      fetch(url, { signal: controller.signal }).then(async res => {
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        return ((await res.json()) as AuthorWorksResponse).works;
      });

    const retryable = (err: unknown) =>
      !controller.signal.aborted && (!(err as { status?: number }).status || (err as { status: number }).status >= 500);

    ask()
      .catch(err => {
        if (!retryable(err)) throw err;
        return new Promise<AuthorWork[]>((resolve, reject) => {
          const timer = setTimeout(() => ask().then(resolve, reject), RETRY_MS);
          controller.signal.addEventListener('abort', () => { clearTimeout(timer); reject(err); });
        });
      })
      .then(works => {
        ANSWERS.set(authorKey, works);
        setResult({ key: authorKey, works });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ key: authorKey, works: null });
      });
    return () => controller.abort();
  }, [wanted, authorKey, authorName]);

  if (!authorKey) return { status: 'idle' };
  if (known) return { status: 'ready', works: known };
  if (result?.key === authorKey) return result.works ? { status: 'ready', works: result.works } : { status: 'failed' };
  return enabled ? { status: 'loading' } : { status: 'idle' };
}
