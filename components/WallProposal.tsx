'use client';

import { useState } from 'react';
import CoverImage from './CoverImage';
import { coverUrlFor } from '@/lib/coverurl';
import type { Tile } from '@/lib/walls/model';

export interface Proposal {
  /** What was read or drawn; the tile when a cover was found. */
  label: string;
  sub?: string;
  tile?: Tile;
  /** Why there is no tile, in words (N12: a failed search is not "not found"). */
  missing?: string;
  /** Number drawn on the photo, when there is one. */
  number?: number;
}

/**
 * A list of covers to tick before they become a wall — from a photo or from
 * a random draw (ROADMAP 5.13a, 5.13c).
 */
export default function WallProposal({
  proposals,
  defaultTitle,
  onCreate,
  summary,
}: {
  proposals: Proposal[];
  defaultTitle: string;
  onCreate: (title: string, tiles: Tile[]) => Promise<void>;
  summary: string;
}) {
  const [picked, setPicked] = useState(() => new Set(proposals.flatMap((p, i) => (p.tile ? [i] : []))));
  const [title, setTitle] = useState(defaultTitle);
  const [busy, setBusy] = useState(false);

  const toggle = (i: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div className="mt-4">
      <p className="text-sm text-ink-2">{summary}</p>
      <ul className="mt-3 space-y-1.5">
        {proposals.map((p, i) => (
          <li key={i} className="flex items-center gap-3">
            {p.number !== undefined && <span className="w-5 shrink-0 text-right text-xs tabular-nums text-accent">{p.number}</span>}
            {p.tile ? (
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} />
                <span className="relative block h-12 w-8 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">
                  <CoverImage src={coverUrlFor(`ol:${p.tile.coverId}`, 'S') ?? ''} alt="" sizes="32px" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{p.tile.title}</span>
                  <span className="block truncate text-xs text-ink-3">{p.sub ?? p.tile.author}</span>
                </span>
              </label>
            ) : (
              <span className="text-sm text-ink-3">
                &ldquo;{p.label}&rdquo;{p.sub ? ` — ${p.sub}` : ''}: {p.missing}
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Title of the new wall"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink"
        />
        <button
          type="button"
          disabled={picked.size === 0 || busy}
          onClick={async () => {
            setBusy(true);
            await onCreate(title, proposals.flatMap((p, i) => (p.tile && picked.has(i) ? [p.tile] : [])));
            setBusy(false);
          }}
          className="rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent disabled:opacity-40"
        >
          Make a wall of {picked.size}
        </button>
      </div>
    </div>
  );
}
