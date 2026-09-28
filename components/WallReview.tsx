'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CoverImage from './CoverImage';
import { postJson } from './useMyWalls';
import { coverUrlFor } from '@/lib/coverurl';
import type { PublicWall } from '@/lib/walls/model';

interface Row {
  wall: PublicWall;
  views: number;
  reports: number;
  framed: number;
}
interface Totals {
  collections: number;
  framedRequests: number;
  collectionsWithRequests: number;
}

type State = { step: 'loading' } | { step: 'error'; message: string } | { step: 'ready'; rows: Row[]; totals?: Totals };

/**
 * Julian's view of Collections by readers (ROADMAP 5.13d). Readers show their
 * collections without review; this lists them, the most reported first, and
 * takes one down or puts it back. A collection the fifth report took down is
 * marked as such and waits here for his decision.
 */
export default function WallReview() {
  const [state, setState] = useState<State>({ step: 'loading' });

  useEffect(() => {
    fetch('/api/walls/review', { cache: 'no-store' })
      .then(async (r) => {
        const d = (await r.json()) as { walls?: Row[]; totals?: Totals; error?: string };
        setState(r.ok && d.walls ? { step: 'ready', rows: d.walls, totals: d.totals } : { step: 'error', message: d.error ?? `Failed (${r.status}).` });
      })
      .catch(() => setState({ step: 'error', message: 'The site did not answer.' }));
  }, []);

  async function decide(id: string, decision: 'hidden' | 'shown') {
    try {
      const { wall } = await postJson<{ wall: PublicWall }>('/api/walls/review', { id, decision });
      setState((s) => (s.step === 'ready' ? { ...s, rows: s.rows.map((r) => (r.wall.id === id ? { ...r, wall } : r)) } : s));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  if (state.step === 'loading') return <p className="mt-8 text-ink-2">Loading…</p>;
  if (state.step === 'error')
    return (
      <p className="mt-8 text-ink-2">
        {state.message} <Link href="/curate" className="underline underline-offset-2 hover:text-accent">Sign in on /curate</Link>
      </p>
    );
  const totals = state.totals && (
    <p className="mt-6 text-sm text-ink-2">
      {state.totals.collections} collections made · {state.totals.framedRequests} requests for a framed wall, on {state.totals.collectionsWithRequests} collections
    </p>
  );
  if (state.rows.length === 0)
    return (
      <>
        {totals}
        <p className="mt-8 text-ink-2">No reader shows a collection yet.</p>
      </>
    );
  return (
    <>
    {totals}
    <ul className="mt-8 space-y-10">
      {state.rows.map(({ wall: w, views, reports, framed }) => (
        <li key={w.id} className={`border-b border-line pb-8 ${w.showcase === 'hidden' ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <Link href={`/c/${w.id}`} className="font-display text-2xl text-ink hover:text-accent">{w.title}</Link>
              <p className="text-xs text-ink-3">
                {w.showcase === 'hidden' ? (w.hiddenBy === 'reports' ? 'taken down automatically after 5 reports — look and decide' : 'taken down by you') : 'shown'} · {views} views · <span className={reports ? 'text-accent' : ''}>{reports} reports</span> · {framed} want it framed
              </p>
            </div>
            {w.showcase === 'hidden' ? (
              <button type="button" onClick={() => decide(w.id, 'shown')} className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent">Put back</button>
            ) : (
              <button type="button" onClick={() => decide(w.id, 'hidden')} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg hover:bg-accent">Take down</button>
            )}
          </div>
          {w.intro ? <p className="mt-2 max-w-2xl whitespace-pre-line text-ink-2">{w.intro}</p> : <p className="mt-2 text-sm text-ink-3">No lines written.</p>}
          <ul className="mt-4 flex flex-wrap gap-2">
            {w.tiles.map((t) => (
              <li key={t.coverId} className="relative h-24 w-16 overflow-hidden rounded-[2px] bg-surface-2" title={`${t.title}${t.author ? ` — ${t.author}` : ''}`}>
                <CoverImage src={coverUrlFor(`ol:${t.coverId}`, 'S') ?? ''} alt={t.title} sizes="64px" />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
    </>
  );
}
