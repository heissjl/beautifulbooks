'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

/**
 * The cover game's playing field (ROADMAP 5.8a): two covers, one click.
 *
 * The title never shows here — the cover is judged, not the book — and the
 * image is fitted, never cropped, because a crop changes the verdict. Which
 * cover lands on which side is the server's coin toss (`nextPair`).
 *
 * Loading follows the rule of this codebase: the state belongs to a request
 * number, and "loading" is simply the latest answer not being for the latest
 * request. A vote, a skip or a retry bumps the number.
 */
interface Side {
  id: string;
  src: string;
}

interface Pair {
  pool: string;
  store: 'memory' | 'upstash';
  votes: number;
  covers: number;
  a: Side;
  b: Side;
  token: string;
}

type Loaded =
  | { request: number; pair: Pair }
  | { request: number; done: true }
  | { request: number; failure: string };

const OFFLINE = 'The game could not reach the site. Check the connection and try again.';

async function failureText(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return body.error;
  } catch {
    // fall through to the status
  }
  return res.status === 429 ? 'Too many clicks at once. Give it a few seconds.' : `The game did not answer (${res.status}).`;
}

export default function Versus() {
  const [request, setRequest] = useState(0);
  const [last, setLast] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const query = last ? `?last=${encodeURIComponent(last)}` : '';
    fetch(`/api/versus/pair${query}`, { signal: controller.signal, cache: 'no-store' })
      .then(async res => {
        if (!res.ok) {
          setLoaded({ request, failure: await failureText(res) });
          return;
        }
        const body = (await res.json()) as Pair | { done: true };
        setLoaded('done' in body ? { request, done: true } : { request, pair: body });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoaded({ request, failure: OFFLINE });
      });
    return () => controller.abort();
  }, [request, last]);

  const current = loaded?.request === request ? loaded : null;
  const pair = current && 'pair' in current ? current.pair : null;

  const next = useCallback((shown: Pair | null) => {
    if (shown) setLast(`${shown.a.id},${shown.b.id}`);
    setRequest(r => r + 1);
  }, []);

  const send = useCallback(async (path: string, body: Record<string, string>) => {
    if (!pair || sending) return;
    setSending(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: pair.a.id, b: pair.b.id, token: pair.token, ...body }),
      });
      // 409 is a pair already used — a double click. The next pair is the right answer to it.
      if (!res.ok && res.status !== 409) {
        setLoaded({ request, failure: await failureText(res) });
        return;
      }
      next(pair);
    } catch {
      setLoaded({ request, failure: OFFLINE });
    } finally {
      setSending(false);
    }
  }, [pair, sending, request, next]);

  const vote = useCallback((winner: Side) => send('/api/versus/vote', { winner: winner.id }), [send]);
  const flag = useCallback((side: Side, reason: 'reported' | 'broken') => send('/api/versus/flag', { id: side.id, reason }), [send]);

  useEffect(() => {
    if (!pair) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft') vote(pair.a);
      else if (e.key === 'ArrowRight') vote(pair.b);
      else if (e.key === 'ArrowDown') next(pair);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pair, vote, next]);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-3xl leading-tight text-ink [text-wrap:balance] sm:text-4xl">Which cover would you rather look at?</h1>
        <Link href="/versus/board" className="text-sm text-accent underline underline-offset-4">Standings</Link>
      </div>
      <p className="mt-2 text-sm tabular-nums text-ink-3" aria-live="polite">
        {pair ? `${pair.votes} ${pair.votes === 1 ? 'vote' : 'votes'} so far · ${pair.covers} covers` : ' '}
        {pair?.store === 'memory' ? ' · development: votes live in memory' : ''}
      </p>

      {current && 'failure' in current ? (
        <div className="mt-10 max-w-prose">
          <p className="text-[15px] leading-relaxed text-ink-2">{current.failure}</p>
          <button type="button" onClick={() => next(null)} className="btn btn-accent mt-5">Try again</button>
        </div>
      ) : current && 'done' in current ? (
        <p className="mt-10 text-[15px] text-ink-2">Too few covers are left to make a pair.</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-6">
            {(pair ? [pair.a, pair.b] : [null, null]).map((side, i) => (
              <div key={side?.id ?? `waiting-${i}`} className="flex min-w-0 flex-col items-center gap-2">
                <button
                  type="button"
                  disabled={!side || sending}
                  onClick={() => side && vote(side)}
                  aria-label={i === 0 ? 'Choose the left cover' : 'Choose the right cover'}
                  className="group relative block aspect-[2/3] w-full overflow-hidden rounded-card bg-surface shadow-sm transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-progress motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  {side ? (
                    <Image
                      src={side.src}
                      alt=""
                      fill
                      unoptimized
                      priority
                      sizes="(min-width: 640px) 360px, 46vw"
                      className="object-contain"
                      // An image that will not load cannot be judged; it leaves the game instead of losing every game.
                      onError={() => flag(side, 'broken')}
                    />
                  ) : (
                    <span className="absolute inset-0 animate-pulse bg-surface-2" aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  disabled={!side || sending}
                  onClick={() => side && flag(side, 'reported')}
                  className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink-2 disabled:opacity-50"
                >
                  Not a cover
                </button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col items-center gap-3">
            <button type="button" disabled={!pair || sending} onClick={() => next(pair)} className="btn">
              Can&rsquo;t decide
            </button>
            <p className="max-w-md text-center text-xs leading-relaxed text-ink-3">
              Tap a cover to choose it; on a keyboard, ← and → choose and ↓ skips. The titles wait on the standings page: here the cover is
              judged, not the book.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
