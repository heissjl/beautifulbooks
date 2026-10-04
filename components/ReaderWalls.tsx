'use client';

import { useCallback, useState } from 'react';
import ReaderWallCard from './ReaderWallCard';
import { useT } from './i18n';
import type { PublicWall } from '@/lib/walls/model';

/**
 * Walls by readers, two side by side, 26 at first and the next page whenever
 * the end comes into view (ROADMAP 5.13d; Julian, 2026-09-28: „jeweils 2
 * collections nebeneinander … bei erstem laden 26 collections, danach lazy
 * loading bei scrollen“). The seed from the server keeps one order.
 */
export default function ReaderWalls({ initial, next: firstNext, seed }: { initial: PublicWall[]; next: number | null; seed: number }) {
  const t = useT();
  const [walls, setWalls] = useState(initial);
  const [next, setNext] = useState(firstNext);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const loadMore = useCallback(async () => {
    if (next === null || state === 'loading') return;
    setState('loading');
    try {
      const res = await fetch(`/api/walls/readers?seed=${seed}&offset=${next}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const d = (await res.json()) as { walls: PublicWall[]; next: number | null };
      setWalls((w) => [...w, ...d.walls.filter((x) => !w.some((y) => y.id === x.id))]);
      setNext(d.next);
      setState('idle');
    } catch {
      setState('error');
    }
  }, [next, seed, state]);

  // A callback ref: the sentinel watches itself, and a new one replaces the old.
  const sentinel = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { rootMargin: '600px 0px' });
      observer.observe(el);
      return () => observer.disconnect();
    },
    [loadMore],
  );

  return (
    <>
      <ul className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2">
        {walls.map((wall) => (
          <li key={wall.id}>
            <ReaderWallCard wall={wall} />
          </li>
        ))}
      </ul>
      {next !== null && state !== 'error' && <div ref={sentinel} className="h-px" aria-hidden="true" />}
      {state === 'loading' && <p className="mt-8 text-center text-sm text-ink-3" role="status">{t('Loading more collections…')}</p>}
      {state === 'error' && (
        <p className="mt-8 text-center text-sm text-ink-2">
          {t('The next collections did not load.')}{' '}
          <button type="button" onClick={() => setState('idle')} className="underline underline-offset-2 hover:text-accent">{t('Try again')}</button>
        </p>
      )}
    </>
  );
}
