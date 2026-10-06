'use client';

import { useEffect, useState } from 'react';
import CoverImage from './CoverImage';
import { useT } from './i18n';
import type { WorkSummary } from '@/lib/model';

type Results = { q: string; works: WorkSummary[] } | { q: string; error: string };

/**
 * Find a book to pick covers from (ROADMAP 5.13c, 5.13m): a field and the
 * works it finds. The query and the chosen work live in the page's address,
 * so the page owns them; this only asks Open Library and lists what came back.
 */
export default function BookSearch({
  q,
  workId,
  onSearch,
  onPick,
  wide = false,
}: {
  q: string;
  workId: string | null;
  onSearch: (q: string) => void;
  onPick: (workId: string) => void;
  /**
   * The results take the block's whole width, three or four across (Julian, 2026-10-04: „use the space
   * better“ — on /create two columns left half the block empty). The field stays a readable width.
   */
  wide?: boolean;
}) {
  const t = useT();
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<Results | null>(null);

  // Results follow the address, so Back from a picked book shows them again.
  useEffect(() => {
    if (q.trim().length < 3) return;
    let live = true;
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ works: WorkSummary[] }>) : Promise.reject(new Error())))
      .then((d) => live && setResults({ q, works: d.works.slice(0, 12) }))
      .catch(() => live && setResults({ q, error: t('Open Library did not answer. Try again in a moment.') }));
    return () => {
      live = false;
    };
  }, [q, t]);

  const shown = results && results.q === q ? results : null;
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 3) onSearch(query.trim());
        }}
        className={`mt-4 flex gap-2 ${wide ? 'max-w-2xl' : ''}`}
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Title or author')}
          aria-label={t('Title or author')}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink placeholder:text-ink-3"
        />
        <button className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent">{t('Search')}</button>
      </form>
      {q.trim().length >= 3 && !shown && <p className="mt-3 text-sm text-ink-3" role="status">{t('Searching…')}</p>}
      {shown && 'error' in shown && <p className="mt-3 text-sm text-accent">{shown.error}</p>}
      {shown && 'works' in shown &&
        (shown.works.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">{t('Open Library has nothing under “{q}”.', { q: shown.q })}</p>
        ) : (
          <ul className={`mt-4 grid gap-1 sm:grid-cols-2 ${wide ? 'gap-x-4 lg:grid-cols-3 xl:grid-cols-4' : ''}`}>
            {shown.works.map((w) => (
              <li key={w.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onPick(w.id)}
                  aria-current={w.id === workId}
                  className={`flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-surface-2 ${w.id === workId ? 'bg-surface-2' : ''}`}
                >
                  <span className={`relative block shrink-0 overflow-hidden rounded-[2px] bg-surface-2 ${wide ? 'h-[4.5rem] w-12' : 'h-14 w-10'}`}>
                    {w.coverUrls[0] && <CoverImage src={w.coverUrls[0]} alt="" sizes={wide ? '48px' : '40px'} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{w.title}</span>
                    <span className="block truncate text-xs text-ink-3">{[w.authors[0], w.editionCount ? t('{n} editions', { n: w.editionCount }) : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}
