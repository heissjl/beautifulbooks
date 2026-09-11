'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
 *
 * **Between two pairs, the stamp** (variant A, chosen by Julian 2026-09-11).
 * The chosen cover lifts with a ring and the other fades; the pair stays like
 * that until the next two covers are in the browser's cache, then slides out,
 * and the new pair slides in. Before, every click showed two empty tiles while
 * the next images came from archive.org. The hold is at least `STAMP_MS`, so
 * the choice is seen even on a fast connection, and at most `PRELOAD_CAP_MS`
 * longer, so a slow cover never stalls the game. `prefers-reduced-motion`
 * keeps the hold and drops the movement.
 */
interface Side {
  id: string;
  src: string;
}

interface Pair {
  pool: string;
  store: 'memory' | 'upstash' | 'redis';
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

/** The pair on its way out: which cover was chosen (none for a skip), and whether it is sliding yet. */
interface Leaving {
  pair: Pair;
  winner: string | null;
  out: boolean;
}

const STAMP_MS = 260;
const OUT_MS = 200;
const PRELOAD_CAP_MS = 2500;

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

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Resolves when the image is in the cache, failed, or took too long; the tile handles the rest. */
function preload(src: string): Promise<void> {
  return new Promise(resolve => {
    const img = new window.Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
    setTimeout(resolve, PRELOAD_CAP_MS);
  });
}

export default function Versus() {
  const [request, setRequest] = useState(0);
  const [last, setLast] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  /** When the stamp may end; 0 when no pair is leaving. Read only in callbacks. */
  const holdUntil = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = last ? `?last=${encodeURIComponent(last)}` : '';
    const settle = (value: Loaded) => {
      holdUntil.current = 0;
      setLeaving(null);
      setLoaded(value);
    };
    fetch(`/api/versus/pair${query}`, { signal: controller.signal, cache: 'no-store' })
      .then(async res => {
        if (!res.ok) {
          const failure = await failureText(res);
          if (!controller.signal.aborted) settle({ request, failure });
          return;
        }
        const body = (await res.json()) as Pair | { done: true };
        if ('done' in body) {
          if (!controller.signal.aborted) settle({ request, done: true });
          return;
        }
        const hold = holdUntil.current;
        await Promise.all([preload(body.a.src), preload(body.b.src), pause(Math.max(0, hold - Date.now()))]);
        if (controller.signal.aborted) return;
        if (hold > 0 && !reducedMotion()) {
          setLeaving(l => (l ? { ...l, out: true } : l));
          await pause(OUT_MS);
          if (controller.signal.aborted) return;
        }
        settle({ request, pair: body });
      })
      .catch(() => {
        if (!controller.signal.aborted) settle({ request, failure: OFFLINE });
      });
    return () => controller.abort();
  }, [request, last]);

  const current = loaded?.request === request ? loaded : null;
  const pair = current && 'pair' in current ? current.pair : null;

  const next = useCallback((shown: Pair | null) => {
    if (shown) setLast(`${shown.a.id},${shown.b.id}`);
    setRequest(r => r + 1);
  }, []);

  /** Starts the stamp on the pair on screen; `winner` null is a skip, which only slides. */
  const leave = useCallback((shown: Pair, winner: string | null) => {
    holdUntil.current = Date.now() + (winner && !reducedMotion() ? STAMP_MS : 0);
    setLeaving({ pair: shown, winner, out: false });
  }, []);

  const skip = useCallback((shown: Pair) => {
    leave(shown, null);
    next(shown);
  }, [leave, next]);

  const send = useCallback(async (path: string, body: Record<string, string>, winner: string | null) => {
    if (!pair || sending || leaving) return;
    leave(pair, winner);
    setSending(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: pair.a.id, b: pair.b.id, token: pair.token, ...body }),
      });
      // 409 is a pair already used — a double click. The next pair is the right answer to it.
      if (!res.ok && res.status !== 409) {
        const failure = await failureText(res);
        holdUntil.current = 0;
        setLeaving(null);
        setLoaded({ request, failure });
        return;
      }
      next(pair);
    } catch {
      holdUntil.current = 0;
      setLeaving(null);
      setLoaded({ request, failure: OFFLINE });
    } finally {
      setSending(false);
    }
  }, [pair, sending, leaving, request, leave, next]);

  const vote = useCallback((winner: Side) => send('/api/versus/vote', { winner: winner.id }, winner.id), [send]);
  const report = useCallback((side: Side) => send('/api/versus/flag', { id: side.id, reason: 'reported' }, null), [send]);

  useEffect(() => {
    if (!pair || leaving) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowLeft') vote(pair.a);
      else if (e.key === 'ArrowRight') vote(pair.b);
      else if (e.key === 'ArrowDown') skip(pair);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pair, leaving, vote, skip]);

  // The leaving pair stays on screen, stamped, until the next one is ready.
  const shown = pair ?? leaving?.pair ?? null;
  const stamp = leaving && leaving.pair === shown ? leaving : null;
  const busy = sending || leaving !== null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-3xl leading-tight text-ink [text-wrap:balance] sm:text-4xl">Which cover would you rather look at?</h1>
        <Link href="/versus/board" className="text-sm text-accent underline underline-offset-4">Standings</Link>
      </div>
      <p className="mt-2 text-sm tabular-nums text-ink-3" aria-live="polite">
        {shown ? `${shown.votes} ${shown.votes === 1 ? 'vote' : 'votes'} so far · ${shown.covers} covers` : ' '}
        {shown?.store === 'memory' ? ' · development: votes live in memory' : ''}
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
            {(shown ? [shown.a, shown.b] : [null, null]).map((side, i) => {
              const won = stamp?.winner === side?.id;
              const lost = Boolean(stamp?.winner) && !won;
              return (
                <div
                  key={side?.id ?? `waiting-${i}`}
                  className={`versus-in flex min-w-0 flex-col items-center gap-2 transition-all duration-200 ease-in ${stamp?.out ? '-translate-x-9 opacity-0' : ''}`}
                >
                  <button
                    type="button"
                    disabled={!side || busy}
                    onClick={() => side && vote(side)}
                    aria-label={i === 0 ? 'Choose the left cover' : 'Choose the right cover'}
                    className={`group relative block aspect-[2/3] w-full overflow-hidden rounded-card bg-surface shadow-sm transition-all duration-[260ms] ease-out enabled:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-default motion-reduce:enabled:hover:translate-y-0 ${
                      won ? '-translate-y-2 scale-[1.04] ring-4 ring-accent ring-offset-4 ring-offset-bg motion-reduce:translate-y-0 motion-reduce:scale-100' : ''
                    } ${lost ? 'scale-95 opacity-25 motion-reduce:scale-100' : ''}`}
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
                        // An image that will not load cannot be judged. It is skipped for this player only:
                        // archive.org stalls now and then, and a stall must not take a cover out for everyone.
                        onError={() => shown && !leaving && skip(shown)}
                      />
                    ) : (
                      <span className="absolute inset-0 animate-pulse bg-surface-2" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={!side || busy}
                    onClick={() => side && report(side)}
                    className="text-xs text-ink-3 underline underline-offset-2 hover:text-ink-2 disabled:opacity-50"
                  >
                    Not a cover
                  </button>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex flex-col items-center gap-3">
            <button type="button" disabled={!pair || busy} onClick={() => pair && skip(pair)} className="btn">
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
