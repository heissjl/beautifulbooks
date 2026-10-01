'use client';

import { useEffect, useState } from 'react';
import CoverImage from './CoverImage';
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
}: {
  q: string;
  workId: string | null;
  onSearch: (q: string) => void;
  onPick: (workId: string) => void;
}) {
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<Results | null>(null);

  // Results follow the address, so Back from a picked book shows them again.
  useEffect(() => {
    if (q.trim().length < 3) return;
    let live = true;
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((res) => (res.ok ? (res.json() as Promise<{ works: WorkSummary[] }>) : Promise.reject(new Error())))
      .then((d) => live && setResults({ q, works: d.works.slice(0, 12) }))
      .catch(() => live && setResults({ q, error: 'Open Library did not answer. Try again in a moment.' }));
    return () => {
      live = false;
    };
  }, [q]);

  const shown = results && results.q === q ? results : null;
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim().length >= 3) onSearch(query.trim());
        }}
        className="mt-4 flex gap-2"
      >
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Title or author"
          aria-label="Title or author"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink placeholder:text-ink-3"
        />
        <button className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent">Search</button>
      </form>
      {q.trim().length >= 3 && !shown && <p className="mt-3 text-sm text-ink-3" role="status">Searching&hellip;</p>}
      {shown && 'error' in shown && <p className="mt-3 text-sm text-accent">{shown.error}</p>}
      {shown && 'works' in shown &&
        (shown.works.length === 0 ? (
          <p className="mt-3 text-sm text-ink-2">Open Library has nothing under &ldquo;{shown.q}&rdquo;.</p>
        ) : (
          <ul className="mt-4 grid gap-1 sm:grid-cols-2">
            {shown.works.map((w) => (
              <li key={w.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onPick(w.id)}
                  aria-current={w.id === workId}
                  className={`flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-surface-2 ${w.id === workId ? 'bg-surface-2' : ''}`}
                >
                  <span className="relative block h-14 w-10 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">
                    {w.coverUrls[0] && <CoverImage src={w.coverUrls[0]} alt="" sizes="40px" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{w.title}</span>
                    <span className="block truncate text-xs text-ink-3">{[w.authors[0], w.editionCount ? `${w.editionCount} editions` : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}
