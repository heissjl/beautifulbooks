'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import ShareMenu from '@/components/ShareMenu';

/**
 * The cover game's playing field (ROADMAP 5.8a): two covers, one click.
 *
 * Title and author stand under each cover since 2026-09-11 (Julian: "wir
 * müssen noch titel und autor anzeigen"); the line under the heading asks to
 * judge the cover anyway. The image is fitted, never cropped, because a crop
 * changes the verdict. Which cover lands on which side is the server's coin
 * toss (`nextPair`). After a pick, a link leads to the book page with that
 * cover selected: someone who finds it beautiful enough may want to buy it.
 *
 * Loading follows the rule of this codebase: the state belongs to a request
 * number, and "loading" is simply the latest answer not being for the latest
 * request. A vote, a skip or a retry bumps the number.
 *
 * **Between two pairs, the stamp** (variant A, chosen by Julian 2026-09-11).
 * The chosen cover lifts with a ring and the other fades; then the pair slides
 * out and the next slides in. **The next two pairs are asked for while this one
 * is looked at** (`AHEAD`), images included, so the stamp lasts its `STAMP_MS` and not the
 * time archive.org takes: on a phone the first version froze for 1.9 s after
 * every tap while it only then fetched the next pair. `prefers-reduced-motion`
 * keeps the order and drops the movement.
 *
 * **What this player saw lately goes with every request** (`seen`, the last
 * `RECENT` covers), so no cover comes back within a few pairs. The list lives
 * here, in the browser; the server keeps nothing about the player (N11).
 */
interface Side {
  id: string;
  workId: string;
  src: string;
  title: string;
  author: string;
  href: string;
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

interface Chosen {
  id: string;
  workId: string;
  title: string;
  author: string;
  href: string;
}

type Answer = { pair: Pair } | { done: true } | { failure: string };
type Loaded = Answer & { request: number };

/** The pair on its way out: which cover was chosen (none for a skip), and whether it is sliding yet. */
interface Leaving {
  pair: Pair;
  winner: string | null;
  out: boolean;
}

const STAMP_MS = 260;
const OUT_MS = 200;
const PRELOAD_CAP_MS = 2500;
/** Covers kept out of the next pair: the last 50 pairs. */
const RECENT = 100;

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

/** One pair, its two images already on their way into the cache. Never rejects. */
async function fetchPair(seen: readonly string[]): Promise<Answer> {
  const params = new URLSearchParams();
  if (seen.length >= 2) params.set('last', seen.slice(-2).join(','));
  if (seen.length > 0) params.set('seen', seen.join(','));
  const query = params.toString();
  try {
    const res = await fetch(`/api/versus/pair${query ? `?${query}` : ''}`, { cache: 'no-store' });
    if (!res.ok) return { failure: await failureText(res) };
    const body = (await res.json()) as Pair | { done: true };
    if ('done' in body) return { done: true };
    await Promise.all([preload(body.a.src), preload(body.b.src)]);
    return { pair: body };
  } catch {
    return { failure: OFFLINE };
  }
}

const withSeen = (seen: readonly string[], pair: Pair) => [...seen, pair.a.id, pair.b.id].slice(-RECENT);

/** Pairs kept ready behind the one on screen (Julian, 2026-09-11: "die nächsten 2 paare sollen auch immer schon vorgeladen werden"). */
const AHEAD = 2;

/**
 * Makes sure the pair for `seen` is on its way, and after it the ones behind it, each asked for
 * with the covers of the one before counted as seen — so they are asked for one after another,
 * never at once. Every pair is still asked for exactly once; only earlier.
 */
function askAhead(cache: Map<string, Promise<Answer>>, seen: readonly string[], depth: number) {
  const key = seen.join(',');
  let answer = cache.get(key);
  if (!answer) {
    answer = fetchPair(seen);
    cache.set(key, answer);
  }
  if (depth > 1) {
    void answer.then(result => {
      if ('pair' in result) askAhead(cache, withSeen(seen, result.pair), depth - 1);
    });
  }
}

export default function Versus() {
  const [request, setRequest] = useState(0);
  const [seen, setSeen] = useState<readonly string[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [lastPick, setLastPick] = useState<(Chosen & { src: string }) | null>(null);
  /** When the stamp may end; 0 when no pair is leaving. Read only in callbacks. */
  const holdUntil = useRef(0);
  /** The pairs behind the one on screen, asked for early. Keyed by the `seen` list each was asked with. */
  const ahead = useRef(new Map<string, Promise<Answer>>());

  useEffect(() => {
    let cancelled = false;
    const key = seen.join(',');
    const cache = ahead.current;
    const answer = cache.get(key) ?? fetchPair(seen);
    const hold = holdUntil.current;
    answer.then(async result => {
      await pause(Math.max(0, hold - Date.now()));
      if (cancelled) return;
      if ('pair' in result && hold > 0 && !reducedMotion()) {
        setLeaving(l => (l ? { ...l, out: true } : l));
        await pause(OUT_MS);
        if (cancelled) return;
      }
      holdUntil.current = 0;
      cache.delete(key);
      setLeaving(null);
      setLoaded({ ...result, request });
      if ('pair' in result) askAhead(cache, withSeen(seen, result.pair), AHEAD);
    });
    return () => {
      cancelled = true;
    };
  }, [request, seen]);

  const current = loaded?.request === request ? loaded : null;
  const pair = current && 'pair' in current ? current.pair : null;

  const next = useCallback((shown: Pair | null) => {
    if (shown) setSeen(s => withSeen(s, shown));
    else ahead.current.clear(); // a retry asks afresh
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

  const send = useCallback(async (path: string, body: Record<string, string>, winner: Side | null) => {
    if (!pair || sending || leaving) return;
    leave(pair, winner?.id ?? null);
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
      if (res.ok && winner) {
        const { chosen } = (await res.json()) as { chosen?: Chosen | null };
        if (chosen) setLastPick({ ...chosen, src: winner.src });
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

  const vote = useCallback((winner: Side) => send('/api/versus/vote', { winner: winner.id }, winner), [send]);
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
      <p className="mt-2 text-[15px] text-ink-2">Judge the cover, not the book!</p>
      <p className="mt-1 text-sm tabular-nums text-ink-3" aria-live="polite">
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
          {/*
            Clipped sideways: a pair sliding in from the right must not widen the page. On a phone the
            first version grew it from 375 to 395 px for every new pair, and the page shook. The padding
            leaves room for the ring of the chosen cover; overflow-y stays visible for its lift.
          */}
          <div className="-mx-3 mt-3 overflow-x-clip px-3 pt-3">
            <div className="grid grid-cols-2 gap-3 sm:gap-6">
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
                      className={`group relative block aspect-[2/3] w-full overflow-hidden rounded-card bg-surface shadow-sm transition-all duration-[260ms] ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-default [@media(hover:hover)]:enabled:hover:-translate-y-0.5 motion-reduce:enabled:hover:translate-y-0 ${
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
                    <div className="w-full min-w-0 text-center">
                      <p className="line-clamp-2 min-h-[2lh] text-[13px] leading-snug text-ink">{side?.title ?? ' '}</p>
                      <p className="truncate text-xs text-ink-3">{side?.author || ' '}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/*
            One share button under each cover, for the one that is funny-ugly (Julian, 2026-09-11). Outside the
            clipped area above, or the panel would be cut off; the left one opens to the right so it stays on a
            phone screen. It passes on the book page with this cover selected, whose preview is the cover itself.
          */}
          {shown && (
            <div className="mt-2 grid grid-cols-2 gap-3 sm:gap-6">
              {[shown.a, shown.b].map((side, i) =>
                side.workId ? (
                  <div key={side.id} className="flex justify-center">
                    <ShareMenu
                      workId={side.workId}
                      coverId={side.id}
                      title={side.title}
                      author={side.author}
                      compact
                      align={i === 0 ? 'left' : 'right'}
                      text={`Beautiful or ugly? ${side.title}${side.author ? ` by ${side.author}` : ''}`}
                    />
                  </div>
                ) : (
                  <div key={side.id} />
                ),
              )}
            </div>
          )}
          <div className="mt-6 flex flex-col items-center gap-3">
            <button type="button" disabled={!pair || busy} onClick={() => pair && skip(pair)} className="btn">
              Can&rsquo;t decide
            </button>
            <p className="text-xs text-ink-3">
              Not a cover?{' '}
              <button type="button" disabled={!pair || busy} onClick={() => pair && report(pair.a)} className="underline underline-offset-2 hover:text-ink-2 disabled:opacity-50">
                Report the left one
              </button>
              {' · '}
              <button type="button" disabled={!pair || busy} onClick={() => pair && report(pair.b)} className="underline underline-offset-2 hover:text-ink-2 disabled:opacity-50">
                the right one
              </button>
            </p>
            {lastPick && (
              <div className="flex max-w-md items-center gap-3 rounded-card border border-line px-3 py-2">
                <Image src={lastPick.src} alt="" width={28} height={42} unoptimized className="h-[42px] w-[28px] shrink-0 object-contain" />
                <p className="min-w-0 text-[13px] leading-snug text-ink-2">
                  Your last pick: <span className="text-ink">{lastPick.title}</span>
                  {lastPick.author ? ` by ${lastPick.author}` : ''}.{' '}
                  <Link href={lastPick.href} target="_blank" rel="noopener" className="whitespace-nowrap text-accent underline underline-offset-2">
                    See this edition
                  </Link>
                </p>
              </div>
            )}
            <p className="hidden text-center text-xs text-ink-3 [@media(hover:hover)]:block">← and → choose, ↓ skips.</p>
          </div>
        </>
      )}
    </div>
  );
}
