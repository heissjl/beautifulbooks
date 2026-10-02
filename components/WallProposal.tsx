'use client';

import { useState } from 'react';
import CoverImage from './CoverImage';
import { coverUrlFor } from '@/lib/coverurl';
import { standingOf, type Standing } from '@/lib/walls/edit';
import { tileCoverId, type PublicWall, type Tile } from '@/lib/walls/model';

export interface Proposal {
  /** What was read or drawn; the tile when a cover was found. */
  label: string;
  sub?: string;
  tile?: Tile;
  /** Why there is no tile, in words (N12: a failed search is not "not found"). */
  missing?: string;
  /** The search failed rather than found nothing: offered again as a search, not as a verdict. */
  failed?: boolean;
  /** Number drawn on the photo, when there is one. */
  number?: number;
  /** A guess by title alone (5.11a): shown as "maybe", never ticked by itself. */
  unsure?: boolean;
  /** Its catalogue search has not answered yet (5.11a): the row is there, the tile is not. */
  pending?: boolean;
}

/** Where the ticked covers go: an existing collection, or a new one with this title. */
export type Destination = { wall: PublicWall } | { title: string };

const NEW = '__new__';

/**
 * A list of covers to tick before they go into a collection — from a photo,
 * a random draw or another collection (ROADMAP 5.13a, 5.13c, 5.13m).
 *
 * In the editor the collection is fixed (`target`): a row says when its cover
 * is already in it, or its book with another cover, and the button names the
 * collection (Julian, 2026-09-29: „muss man von einem foto einfach zu einer
 * bestehenden collection hinzufügen können“). On /create the reader chooses
 * between a new collection and one of their own (`walls`).
 */
export default function WallProposal({
  proposals,
  defaultTitle,
  summary,
  target,
  walls = [],
  onCommit,
  onOtherCover,
  onSearchFor,
}: {
  proposals: Proposal[];
  defaultTitle: string;
  summary: string;
  target?: PublicWall;
  walls?: PublicWall[];
  onCommit: (dest: Destination, tiles: Tile[]) => Promise<void>;
  /** Show all covers of this tile's book (the editor's search). */
  onOtherCover?: (tile: Tile) => void;
  /** Search for a title that was read but not found. */
  onSearchFor?: (label: string) => void;
}) {
  const standing = (p: Proposal): Standing | null => (p.tile ? standingOf(p.tile, target) : null);
  // Ticked by default: a found cover that is new to the collection and not a guess. The reader's
  // choices are kept as exceptions to that rule, so a row that arrives later — the list grows
  // while the catalogue is still answering (Julian, 2026-10-01) — gets the default too.
  const byDefault = (p: Proposal) => !!p.tile && standing(p) === 'new' && !p.unsure;
  const [flipped, setFlipped] = useState(() => new Set<number>());
  const ticked = (p: Proposal, i: number) => byDefault(p) !== flipped.has(i);
  const [title, setTitle] = useState(defaultTitle);
  const [chosen, setChosen] = useState(NEW);
  const [asNew, setAsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (i: number) =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const tiles = proposals.flatMap((p, i) => (p.tile && ticked(p, i) && standing(p) !== 'in' ? [p.tile] : []));
  const anyTicked = proposals.some((p, i) => !!p.tile && standing(p) !== 'in' && ticked(p, i));
  const pending = proposals.filter((p) => p.pending).length;
  const existing = target ?? walls.find((w) => w.id === chosen);
  const intoNew = !existing || (target && asNew);

  async function commit(dest: Destination) {
    setBusy(true);
    setError('');
    try {
      await onCommit(dest, tiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  const button = 'rounded-full bg-ink px-4 py-1.5 text-sm text-bg transition-colors hover:bg-accent disabled:opacity-40';
  const count = tiles.length;

  return (
    <div className="mt-4">
      <p className="text-sm text-ink-2" aria-live="polite">{summary}</p>
      {proposals.length > 8 && (
        <button
          type="button"
          onClick={() => setFlipped(anyTicked ? new Set(proposals.flatMap((p, i) => (byDefault(p) ? [i] : []))) : new Set())}
          className="mt-1 text-xs text-ink-2 underline underline-offset-2 hover:text-accent"
        >
          {anyTicked ? 'Untick all' : 'Tick all new ones'}
        </button>
      )}
      {/* Two columns on a wide screen (Julian, 2026-10-01: „on desktop there's too much empty space here“); the link stays at the row's end, now half as far away. */}
      <ul className="mt-3 grid gap-x-8 gap-y-1.5 lg:grid-cols-2">
        {proposals.map((p, i) => {
          const st = standing(p);
          return (
            <li key={i} className="flex items-center gap-3">
              {p.number !== undefined && <span className="w-5 shrink-0 text-right text-xs tabular-nums text-accent">{p.number}</span>}
              {p.tile ? (
                <>
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input type="checkbox" checked={st === 'in' || ticked(p, i)} disabled={st === 'in'} onChange={() => toggle(i)} />
                    <span className={`relative block h-12 w-8 shrink-0 overflow-hidden rounded-[2px] bg-surface-2 ${st === 'in' ? 'opacity-60' : ''}`}>
                      <CoverImage src={coverUrlFor(tileCoverId(p.tile), 'S') ?? ''} alt="" sizes="32px" />
                    </span>
                    <span className="min-w-0">
                      <span className={`block truncate text-sm ${st === 'in' ? 'text-ink-2' : 'text-ink'}`}>{p.tile.title}</span>
                      <span className={`block truncate text-xs ${st === 'new' && !p.unsure ? 'text-ink-3' : 'text-accent'}`}>
                        {st === 'in' ? 'already in this collection' : st === 'work' ? 'in this collection with another cover' : p.unsure ? `maybe — the photo reads “${p.label}${p.sub ? `, ${p.sub}` : ''}”` : (p.sub ?? p.tile.author)}
                      </span>
                    </span>
                  </label>
                  {p.unsure && onSearchFor ? (
                    <button type="button" onClick={() => onSearchFor(p.label)} className="shrink-0 text-xs text-ink-2 underline underline-offset-2 hover:text-accent">
                      search instead
                    </button>
                  ) : (
                    onOtherCover && (
                      <button type="button" onClick={() => onOtherCover(p.tile as Tile)} className="shrink-0 text-xs text-ink-2 underline underline-offset-2 hover:text-accent">
                        another cover
                      </button>
                    )
                  )}
                </>
              ) : p.pending ? (
                <span className="text-sm text-ink-3">
                  &ldquo;{p.label}&rdquo;{p.sub ? ` — ${p.sub}` : ''}: <span className="italic">looking it up…</span>
                </span>
              ) : (
                <span className="text-sm text-ink-3">
                  &ldquo;{p.label}&rdquo;{p.sub ? ` — ${p.sub}` : ''}: {p.missing}
                  {onSearchFor && (
                    <>
                      {' — '}
                      <button type="button" onClick={() => onSearchFor(p.label)} className="underline underline-offset-2 hover:text-accent">
                        {p.failed ? 'try the search' : 'search for it'}
                      </button>
                    </>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {target && !asNew ? (
        <div className="mt-4 flex flex-col items-start gap-2">
          <button type="button" disabled={count === 0 || busy} onClick={() => commit({ wall: target })} className={button}>
            {busy ? 'Adding…' : `Add ${count} to ${target.title}`}{!busy && pending > 0 ? ` (${pending} still looking)` : ''}
          </button>
          <button type="button" onClick={() => setAsNew(true)} className="text-sm text-ink-2 underline underline-offset-2 hover:text-accent">
            or make a new collection of them
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!target && walls.length > 0 && (
            <select
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
              aria-label="Where the covers go"
              className="w-0 min-w-[9rem] max-w-full flex-1 truncate rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-ink"
            >
              <option value={NEW}>A new collection</option>
              {walls.map((w) => (
                <option key={w.id} value={w.id}>
                  Add to {w.title} ({w.tiles.length})
                </option>
              ))}
            </select>
          )}
          {intoNew && (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Title of the new collection"
              className="w-0 min-w-[9rem] flex-1 rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-ink"
            />
          )}
          <button type="button" disabled={count === 0 || busy} onClick={() => commit(intoNew || !existing ? { title } : { wall: existing })} className={button}>
            {busy ? 'Working…' : intoNew || !existing ? `Make a collection of ${count}` : `Add ${count} to ${existing.title}`}
          </button>
          {target && (
            <button type="button" onClick={() => setAsNew(false)} className="text-sm text-ink-2 underline underline-offset-2 hover:text-accent">
              back
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-accent" role="alert">{error}</p>}
    </div>
  );
}
