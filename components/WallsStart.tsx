'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CoverImage from './CoverImage';
import WallIdField from './WallIdField';
import { postJson, useMyWalls } from './useMyWalls';
import { coverUrlFor } from '@/lib/coverurl';
import type { WorkSummary } from '@/lib/model';
import type { PublicWall, Tile } from '@/lib/walls/model';
import type { PhotoMatch } from '@/lib/walls/photo';

/** Long edge the photo is shrunk to before it leaves the phone; the model reads no more (lab/shelf). */
const PHOTO_EDGE = 1600;

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, PHOTO_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The photo could not be prepared.'))), 'image/jpeg', 0.9));
}

type PhotoState =
  | { step: 'idle' }
  | { step: 'reading' }
  | { step: 'read'; matches: PhotoMatch[]; picked: Set<number> }
  | { step: 'error'; message: string };

/**
 * Where a wall begins (ROADMAP 5.13a; Julian, 2026-09-28: „es muss auch eine
 * extra unterseite geben, von der aus man die erstellung einer collection
 * starten kann. via suche, oder zb via bildsuche"). A search leads to a book's
 * own wall, where every cover is and "Add to wall" sits; a photo becomes a
 * whole wall in one step.
 */
export default function WallsStart({ photoOn, sampleOn }: { photoOn: boolean; sampleOn: boolean }) {
  const router = useRouter();
  const { me, setMe } = useMyWalls();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ q: string; works: WorkSummary[] } | { q: string; error: string } | null>(null);
  const [photo, setPhoto] = useState<PhotoState>({ step: 'idle' });
  const [title, setTitle] = useState('My shelf');
  const [creating, setCreating] = useState(false);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 3) return;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { works: WorkSummary[] };
      setResults({ q, works: data.works.slice(0, 12) });
    } catch {
      setResults({ q, error: 'Open Library did not answer. Try again in a moment.' });
    }
  }

  async function readPhoto(file: File | null, sample = false) {
    if (!file && !sample) return;
    setPhoto({ step: 'reading' });
    try {
      const res = sample
        ? await fetch('/api/walls/photo?sample=1', { method: 'POST' })
        : await fetch('/api/walls/photo', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: await shrink(file as File) });
      const data = (await res.json()) as { matches?: PhotoMatch[]; error?: string };
      if (!res.ok || !data.matches) throw new Error(data.error ?? 'The photo could not be read.');
      const picked = new Set(data.matches.flatMap((m, i) => (m.tile ? [i] : [])));
      setPhoto({ step: 'read', matches: data.matches, picked });
    } catch (err) {
      setPhoto({ step: 'error', message: err instanceof Error ? err.message : 'The photo could not be read.' });
    }
  }

  async function makeWall(tiles: Tile[]) {
    setCreating(true);
    try {
      const { wall } = await postJson<{ wall: PublicWall }>('/api/walls', { title, tiles });
      router.push(`/w/${wall.id}`);
    } catch (err) {
      setPhoto({ step: 'error', message: err instanceof Error ? err.message : 'The wall could not be made.' });
      setCreating(false);
    }
  }

  async function emptyWall() {
    const { wall } = await postJson<{ wall: PublicWall }>('/api/walls', { title: me.walls.length ? `Wall ${me.walls.length + 1}` : 'My wall' });
    router.push(`/w/${wall.id}`);
  }

  const heading = 'font-display text-2xl text-ink';
  const button = 'rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent disabled:opacity-40';

  return (
    <>
      {me.walls.length > 0 && (
        <section className="mt-10" aria-labelledby="yours">
          <div className="flex items-baseline justify-between border-b border-line pb-2">
            <h2 id="yours" className={heading}>Your walls</h2>
            <button type="button" onClick={emptyWall} className="text-sm text-ink-2 hover:text-accent">+ Empty wall</button>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {me.walls.map((w) => (
              <li key={w.id}>
                <Link href={`/w/${w.id}`} className="group block rounded-card border border-line bg-surface p-3 hover:border-accent">
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

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="by-search">
          <h2 id="by-search" className={heading}>Start from a book</h2>
          <p className="mt-2 text-sm text-ink-2">Find a book, open its wall of covers, pick the one you would hang and press <em>Add to wall</em>.</p>
          <form onSubmit={runSearch} className="mt-4 flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title or author"
              aria-label="Title or author"
              className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink placeholder:text-ink-3"
            />
            <button className={button}>Search</button>
          </form>
          {results && 'error' in results && <p className="mt-3 text-sm text-accent">{results.error}</p>}
          {results && 'works' in results && (
            results.works.length === 0 ? (
              <p className="mt-3 text-sm text-ink-2">Open Library has nothing under &ldquo;{results.q}&rdquo;.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {results.works.map((w) => (
                  <li key={w.id}>
                    <Link href={`/book/${w.id}?q=${encodeURIComponent(results.q)}`} className="flex items-center gap-3 rounded-md p-1.5 hover:bg-surface-2">
                      <span className="relative block h-14 w-10 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">
                        {w.coverUrls[0] && <CoverImage src={w.coverUrls[0]} alt="" sizes="40px" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{w.title}</span>
                        <span className="block truncate text-xs text-ink-3">{[w.authors[0], w.editionCount ? `${w.editionCount} editions` : ''].filter(Boolean).join(' · ')}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          )}
        </section>

        <section aria-labelledby="by-photo">
          <h2 id="by-photo" className={heading}>Start from a photo</h2>
          <p className="mt-2 text-sm text-ink-2">
            Photograph a shelf or a pile of books. We read the titles and make a wall of them, each with the book&rsquo;s usual cover — change any of them on the book&rsquo;s own wall.
            The photo is read once and not kept.
          </p>
          {!photoOn && !sampleOn && <p className="mt-4 text-sm text-ink-3">Reading photos is not switched on yet.</p>}
          {(photoOn || sampleOn) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {photoOn && (
                <label className={`${button} cursor-pointer`}>
                  Choose a photo
                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => readPhoto(e.target.files?.[0] ?? null)} />
                </label>
              )}
              {sampleOn && (
                <button type="button" onClick={() => readPhoto(null, true)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 hover:border-accent hover:text-accent">
                  Try with a sample list
                </button>
              )}
              {!photoOn && <span className="text-xs text-ink-3">Photos need a key on this server; the sample skips the reading.</span>}
            </div>
          )}
          {photo.step === 'reading' && <p className="mt-4 text-sm text-ink-2" role="status">Reading the photo and looking the books up&hellip;</p>}
          {photo.step === 'error' && <p className="mt-4 text-sm text-accent" role="alert">{photo.message}</p>}
          {photo.step === 'read' && (
            <PhotoResult
              matches={photo.matches}
              picked={photo.picked}
              onToggle={(i) => {
                const picked = new Set(photo.picked);
                if (picked.has(i)) picked.delete(i);
                else picked.add(i);
                setPhoto({ ...photo, picked });
              }}
              title={title}
              onTitle={setTitle}
              creating={creating}
              onCreate={() => makeWall(photo.matches.flatMap((m, i) => (m.tile && photo.picked.has(i) ? [m.tile] : [])))}
              button={button}
            />
          )}
        </section>
      </div>

      <WallIdField me={me} onChange={setMe} />
    </>
  );
}

function PhotoResult(props: {
  matches: PhotoMatch[];
  picked: Set<number>;
  onToggle: (i: number) => void;
  title: string;
  onTitle: (t: string) => void;
  creating: boolean;
  onCreate: () => void;
  button: string;
}) {
  const { matches, picked } = props;
  const found = matches.filter((m) => m.tile).length;
  if (matches.length === 0) return <p className="mt-4 text-sm text-ink-2">No title could be read in this photo.</p>;
  return (
    <div className="mt-4">
      <p className="text-sm text-ink-2">
        {matches.length} {matches.length === 1 ? 'book' : 'books'} read, {found} found with a cover.
      </p>
      <ul className="mt-3 space-y-1.5">
        {matches.map((m, i) => (
          <li key={i} className="flex items-center gap-3">
            {m.tile ? (
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input type="checkbox" checked={picked.has(i)} onChange={() => props.onToggle(i)} />
                <span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">
                  <CoverImage src={coverUrlFor(`ol:${m.tile.coverId}`, 'S') ?? ''} alt="" sizes="32px" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{m.tile.title}</span>
                  <span className="block truncate text-xs text-ink-3">{m.tile.author}</span>
                </span>
              </label>
            ) : (
              <span className="text-sm text-ink-3">
                &ldquo;{m.read.title}&rdquo;{m.read.author ? ` — ${m.read.author}` : ''}: {m.failed ? 'the search did not answer' : 'not found'}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={props.title}
          onChange={(e) => props.onTitle(e.target.value)}
          aria-label="Title of the new wall"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink"
        />
        <button type="button" className={props.button} disabled={picked.size === 0 || props.creating} onClick={props.onCreate}>
          Make a wall of {picked.size}
        </button>
      </div>
    </div>
  );
}
