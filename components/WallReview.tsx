'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CoverImage from './CoverImage';
import { postJson } from './useMyWalls';
import { coverUrlFor } from '@/lib/coverurl';
import type { PublicWall } from '@/lib/walls/model';

type State = { step: 'loading' } | { step: 'error'; message: string } | { step: 'ready'; walls: PublicWall[] };

/** Julian's queue of walls offered for Walls by readers (ROADMAP 5.13d). */
export default function WallReview() {
  const [state, setState] = useState<State>({ step: 'loading' });
  const [note, setNote] = useState('');

  useEffect(() => {
    fetch('/api/walls/review', { cache: 'no-store' })
      .then(async (r) => {
        const d = (await r.json()) as { walls?: PublicWall[]; error?: string };
        setState(r.ok && d.walls ? { step: 'ready', walls: d.walls } : { step: 'error', message: d.error ?? `Failed (${r.status}).` });
      })
      .catch(() => setState({ step: 'error', message: 'The site did not answer.' }));
  }, []);

  async function decide(id: string, decision: 'approved' | 'declined') {
    try {
      await postJson('/api/walls/review', { id, decision });
      setState((s) => (s.step === 'ready' ? { ...s, walls: s.walls.filter((w) => w.id !== id) } : s));
      setNote(decision === 'approved' ? 'Shown.' : 'Not shown.');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  if (state.step === 'loading') return <p className="mt-8 text-ink-2">Loading…</p>;
  if (state.step === 'error')
    return (
      <p className="mt-8 text-ink-2">
        {state.message} <Link href="/curate" className="underline underline-offset-2 hover:text-accent">Sign in on /curate</Link>
      </p>
    );
  return (
    <>
      {note && <p className="mt-4 text-sm text-ink-2" role="status">{note}</p>}
      {state.walls.length === 0 && <p className="mt-8 text-ink-2">Nothing waiting.</p>}
      <ul className="mt-8 space-y-10">
        {state.walls.map((w) => (
          <li key={w.id} className="border-b border-line pb-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <Link href={`/w/${w.id}`} className="font-display text-2xl text-ink hover:text-accent">{w.title}</Link>
              <div className="flex gap-2">
                <button type="button" onClick={() => decide(w.id, 'approved')} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg hover:bg-accent">Show</button>
                <button type="button" onClick={() => decide(w.id, 'declined')} className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent">Don&rsquo;t show</button>
              </div>
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
