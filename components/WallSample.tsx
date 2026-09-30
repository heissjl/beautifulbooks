'use client';

import { useState } from 'react';
import WallProposal, { type Destination } from './WallProposal';
import type { PublicWall, Tile } from '@/lib/walls/model';
import type { SampleTile } from '@/lib/walls/sample';

/**
 * Six random covers to start from (ROADMAP 5.13c): Julian's curated picks and
 * the cover game's top tenth. Drawn again on every press.
 */
export default function WallSample({
  target,
  onCommit,
  onOtherCover,
}: {
  /** The collection open in the editor (5.13m); without one the six start a new collection. */
  target?: PublicWall;
  onCommit: (dest: Destination, tiles: Tile[]) => Promise<void>;
  onOtherCover?: (tile: Tile) => void;
}) {
  const [draw, setDraw] = useState<{ n: number; tiles: SampleTile[] } | { n: number; error: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    try {
      const res = await fetch('/api/walls/sample', { cache: 'no-store' });
      const data = (await res.json()) as { tiles?: SampleTile[]; error?: string };
      if (!res.ok || !data.tiles) throw new Error(data.error ?? 'Nothing could be drawn.');
      setDraw((d) => ({ n: (d?.n ?? 0) + 1, tiles: data.tiles ?? [] }));
    } catch (err) {
      setDraw((d) => ({ n: (d?.n ?? 0) + 1, error: err instanceof Error ? err.message : 'Nothing could be drawn.' }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={target ? '' : 'mt-6'}>
      <button
        type="button"
        onClick={load}
        disabled={busy}
        className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
      >
        {draw ? 'Draw 6 others' : target ? 'Draw 6 random favourites' : 'Or start with 6 random favourites'}
      </button>
      <p className="mt-1 text-xs text-ink-3">From our own picks and the covers voted best in the cover game.</p>
      {draw && 'error' in draw && <p className="mt-3 text-sm text-accent">{draw.error}</p>}
      {draw && 'tiles' in draw && (
        <WallProposal
          key={draw.n}
          proposals={draw.tiles.map((t) => ({ label: t.title, tile: t, sub: `${t.author ?? ''}${t.from === 'versus' ? ' · voted in the game' : ''}` }))}
          defaultTitle="Favourites"
          target={target}
          onCommit={onCommit}
          onOtherCover={onOtherCover}
          summary="Six covers, drawn at random. Untick any you would not hang."
        />
      )}
    </div>
  );
}
