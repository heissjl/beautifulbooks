'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import CoverImage from './CoverImage';
import WallIdField from './WallIdField';
import WallPhoto from './WallPhoto';
import WallPicker from './WallPicker';
import WallSample from './WallSample';
import { postJson, useMyWalls } from './useMyWalls';
import { coverUrlFor } from '@/lib/coverurl';
import type { WorkSummary } from '@/lib/model';
import type { PublicWall, Tile } from '@/lib/walls/model';

const TARGET_KEY = 'bb.wall.target';
const WORK = /^OL\d+W$/;

function readTarget(): string | null {
  try {
    return localStorage.getItem(TARGET_KEY);
  } catch {
    return null;
  }
}

type Results = { q: string; works: WorkSummary[] } | { q: string; error: string };

/**
 * Where a wall begins (ROADMAP 5.13a, 5.13c): a search, six random
 * favourites, or a photo of a shelf. A search result opens the book's covers
 * **here**, in a section between two rules, instead of sending the reader to
 * the book page (Julian, 2026-09-28). The chosen work and the query live in
 * the address, like everywhere on the site, so reloading and Back keep them.
 */
export default function WallsStart({ photoOn }: { photoOn: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { me, setMe } = useMyWalls();
  const [targetId, setTargetId] = useState<string | null>(readTarget);
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [results, setResults] = useState<Results | null>(null);

  const workParam = params.get('work');
  const workId = workParam && WORK.test(workParam) ? workParam : null;
  const q = params.get('q') ?? '';
  const target = me.walls.find((w) => w.id === targetId) ?? me.walls[0];

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

  function go(next: { q?: string; work?: string | null }) {
    const p = new URLSearchParams(params.toString());
    for (const key of ['q', 'work'] as const) {
      const value = next[key];
      if (value === undefined) continue;
      if (value) p.set(key, value);
      else p.delete(key);
    }
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function chooseTarget(id: string) {
    setTargetId(id);
    try {
      localStorage.setItem(TARGET_KEY, id);
    } catch {
      // Not remembered in a private window; the choice still holds on this page.
    }
  }

  function putWall(wall: PublicWall) {
    setMe((m) => ({ ...m, walls: [wall, ...m.walls.filter((w) => w.id !== wall.id)] }));
    // The first wall set the cookie; ask once so the ID field knows it.
    if (!me.visitor) {
      fetch('/api/walls/me', { cache: 'no-store' })
        .then((r) => r.json() as Promise<{ visitor: string | null }>)
        .then((d) => setMe((m) => ({ ...m, visitor: d.visitor })))
        .catch(() => {});
    }
  }

  async function createWall(title: string, tiles: Tile[]) {
    try {
      const { wall } = await postJson<{ wall: PublicWall }>('/api/walls', { title, tiles });
      router.push(`/c/${wall.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'The collection could not be made.');
    }
  }

  async function emptyWall() {
    const { wall } = await postJson<{ wall: PublicWall }>('/api/walls', { title: me.walls.length ? `Collection ${me.walls.length + 1}` : 'My collection' });
    router.push(`/c/${wall.id}`);
  }

  const heading = 'font-display text-2xl text-ink';
  const shown = results && results.q === q ? results : null;

  return (
    <>
      {me.walls.length > 0 && (
        <section className="mt-10" aria-labelledby="yours">
          <div className="flex items-baseline justify-between border-b border-line pb-2">
            <h2 id="yours" className={heading}>Your collections</h2>
            <button type="button" onClick={emptyWall} className="text-sm text-ink-2 hover:text-accent">+ Empty collection</button>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {me.walls.map((w) => (
              <li key={w.id}>
                <Link href={`/c/${w.id}`} className="group block rounded-card border border-line bg-surface p-3 hover:border-accent">
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 4 }, (_, i) => w.tiles[i]).map((t, i) => (
                      <span key={t?.coverId ?? i} className="relative block aspect-[2/3] overflow-hidden rounded-[2px] bg-surface-2">
                        {t && <CoverImage src={coverUrlFor(`ol:${t.coverId}`, 'S') ?? ''} alt="" sizes="60px" />}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 truncate text-sm text-ink group-hover:text-accent">{w.title}</p>
                  <p className="text-xs text-ink-3">{w.tiles.length} {w.tiles.length === 1 ? 'cover' : 'covers'}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={`mt-12 grid gap-12 ${photoOn ? 'lg:grid-cols-2' : 'max-w-2xl'}`}>
        <section aria-labelledby="by-search">
          <h2 id="by-search" className={heading}>Start from a book</h2>
          <p className="mt-2 text-sm text-ink-2">Find a book and pick the covers you love from all the ones it has had.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim().length >= 3) go({ q: query.trim(), work: null });
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
          {shown && 'error' in shown && <p className="mt-3 text-sm text-accent">{shown.error}</p>}
          {shown && 'works' in shown &&
            (shown.works.length === 0 ? (
              <p className="mt-3 text-sm text-ink-2">Open Library has nothing under &ldquo;{shown.q}&rdquo;.</p>
            ) : (
              <ul className="mt-4 space-y-1">
                {shown.works.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => {
                        go({ work: w.id });
                        requestAnimationFrame(() => document.getElementById('picker')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                      }}
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
          <WallSample onCreate={createWall} />
        </section>

        {/* Without a key the photo cannot be read, so the section is not shown at all (Julian, 2026-09-28). */}
        {photoOn && (
          <section aria-labelledby="by-photo">
            <h2 id="by-photo" className={heading}>Start from a photo</h2>
            <p className="mt-2 text-sm text-ink-2">Photograph a shelf or a pile of books. We read the titles and make a collection of them.</p>
            <WallPhoto photoOn={photoOn} onCreate={createWall} />
          </section>
        )}
      </div>

      {workId && (
        <WallPicker
          key={workId}
          workId={workId}
          walls={me.walls}
          target={target}
          onTarget={chooseTarget}
          onWall={putWall}
          onClose={() => go({ work: null })}
        />
      )}

      <WallIdField me={me} onChange={setMe} />
    </>
  );
}
