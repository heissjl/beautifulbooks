'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createWall } from './useMyWalls';
import { editHref } from '@/lib/walls/edit';
import { MAX_TITLE, storedCoverId, type Tile } from '@/lib/walls/model';

/**
 * From a board to a collection of one's own (ROADMAP 5.18b; Julian,
 * 2026-10-05, about the link to `/create` that stood here alone: „läuft
 * dieser funnel smooth?" — it did not: it opened an empty collection and the
 * board's books had to be searched again).
 *
 * One click makes a collection with the board's covers and opens its editor,
 * where more are added and arranged. It is this browser's collection like
 * any other: the first one sets the visitor cookie (E22), and it lands
 * unsaved (5.13j). A tile carries no printings — the board keeps only the
 * picture — so its book page names them, as for a tile read from a photo.
 * A Google cover has no place in a collection and is left out.
 */
export default function InspirationToCollection({ title, books }: { title: string; books: { workId: string; coverId: string; title: string; author: string | null }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const tiles: Tile[] = books.flatMap((b) => {
    const coverId = storedCoverId(b.coverId);
    return coverId ? [{ workId: b.workId, coverId, title: b.title, ...(b.author ? { author: b.author } : {}), printings: [] }] : [];
  });
  if (tiles.length === 0) return null;

  async function start() {
    setBusy(true);
    setError('');
    try {
      const wall = await createWall(title.slice(0, MAX_TITLE), tiles);
      router.push(editHref(wall.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Try again in a moment.');
      setBusy(false);
    }
  }
  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-2">
      <span>More books than fit here?</span>
      <button type="button" onClick={start} disabled={busy} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50">
        {busy ? 'Starting…' : 'Make it a collection'}
      </button>
      <span className="text-ink-3">Keep these covers, add more, arrange them.</span>
      {error && <span className="w-full text-accent" role="alert">{error}</span>}
    </p>
  );
}
