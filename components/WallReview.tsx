'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import CoverImage from './CoverImage';
import { postJson } from './useMyWalls';
import { useT } from './i18n';
import { coverUrlFor } from '@/lib/coverurl';
import { tileCoverId, type PublicWall } from '@/lib/walls/model';

interface Row {
  wall: PublicWall;
  views: number;
  reports: number;
}
interface Totals {
  collections: number;
}

type State = { step: 'loading' } | { step: 'error'; message: string } | { step: 'ready'; rows: Row[]; totals?: Totals };

/**
 * Julian's view of Collections by readers (ROADMAP 5.13d). Readers show their
 * collections without review; this lists them, the most reported first, and
 * takes one down or puts it back. A collection the fifth report took down is
 * marked as such and waits here for his decision.
 */
export default function WallReview() {
  const t = useT();
  const [state, setState] = useState<State>({ step: 'loading' });

  useEffect(() => {
    fetch('/api/walls/review', { cache: 'no-store' })
      .then(async (r) => {
        const d = (await r.json()) as { walls?: Row[]; totals?: Totals; error?: string };
        setState(r.ok && d.walls ? { step: 'ready', rows: d.walls, totals: d.totals } : { step: 'error', message: d.error ?? t('Failed ({status}).', { status: r.status }) });
      })
      .catch(() => setState({ step: 'error', message: t('The site did not answer.') }));
    // t is stable for the page's locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(id: string, decision: 'hidden' | 'shown') {
    try {
      const { wall } = await postJson<{ wall: PublicWall }>('/api/walls/review', { id, decision });
      setState((s) => (s.step === 'ready' ? { ...s, rows: s.rows.map((r) => (r.wall.id === id ? { ...r, wall } : r)) } : s));
    } catch (err) {
      alert(err instanceof Error ? err.message : t('That did not work.'));
    }
  }

  if (state.step === 'loading') return <p className="mt-8 text-ink-2">{t('Loading…')}</p>;
  if (state.step === 'error')
    return (
      <p className="mt-8 text-ink-2">
        {state.message} <Link href="/curate" className="underline underline-offset-2 hover:text-accent">{t('Sign in on /curate')}</Link>
      </p>
    );
  const totals = state.totals && (
    <p className="mt-6 text-sm text-ink-2">
      {t('{n} collections made', { n: state.totals.collections })}
    </p>
  );
  if (state.rows.length === 0)
    return (
      <>
        {totals}
        <p className="mt-8 text-ink-2">{t('No reader shows a collection yet.')}</p>
      </>
    );
  return (
    <>
    {totals}
    <ul className="mt-8 space-y-10">
      {state.rows.map(({ wall: w, views, reports }) => (
        <li key={w.id} className={`border-b border-line pb-8 ${w.showcase === 'hidden' ? 'opacity-60' : ''}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <Link href={`/c/${w.id}`} className="font-display text-2xl text-ink hover:text-accent">{w.title}</Link>
              <p className="text-xs text-ink-3">
                {w.showcase === 'hidden' ? (w.hiddenBy === 'reports' ? t('taken down automatically after 5 reports — look and decide') : t('taken down by you')) : t('shown')} · {t('{n} views', { n: views })} · <span className={reports ? 'text-accent' : ''}>{t('{n} reports', { n: reports })}</span>
              </p>
            </div>
            {w.showcase === 'hidden' ? (
              <button type="button" onClick={() => decide(w.id, 'shown')} className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent">{t('Put back')}</button>
            ) : (
              <button type="button" onClick={() => decide(w.id, 'hidden')} className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg hover:bg-accent">{t('Take down')}</button>
            )}
          </div>
          {w.intro ? <p className="mt-2 max-w-2xl whitespace-pre-line text-ink-2">{w.intro}</p> : <p className="mt-2 text-sm text-ink-3">{t('No lines written.')}</p>}
          <ul className="mt-4 flex flex-wrap gap-2">
            {w.tiles.map((tile) => (
              <li key={tile.coverId} className="relative h-24 w-16 overflow-hidden rounded-[2px] bg-surface-2" title={`${tile.title}${tile.author ? ` — ${tile.author}` : ''}`}>
                <CoverImage src={coverUrlFor(tileCoverId(tile), 'S') ?? ''} alt={tile.title} sizes="64px" />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
    </>
  );
}
