'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Cover, EditionView } from '@/lib/model';
import { MAX_PRINTINGS, type Printing, type PublicWall, type Tile } from '@/lib/walls/model';
import { postJson, useMyWalls } from './useMyWalls';

const TARGET_KEY = 'bb.wall.target';
const NEW = '__new__';

function readTarget(): string | null {
  try {
    return localStorage.getItem(TARGET_KEY);
  } catch {
    return null;
  }
}
function writeTarget(id: string) {
  try {
    localStorage.setItem(TARGET_KEY, id);
  } catch {
    // A private window: the choice is simply not remembered.
  }
}

/** The printings that carried this cover, as a tile keeps them; e-books never (E21). */
export function printingsOf(editions: readonly EditionView[]): Printing[] {
  return editions
    .filter((e) => e.format !== 'ebook')
    .map((e) => ({
      ...(e.isbn13 ? { isbn13: e.isbn13 } : {}),
      ...(e.isbn10 ? { isbn10: e.isbn10 } : {}),
      ...(e.publisher ? { publisher: e.publisher } : {}),
      ...(e.year ? { year: e.year } : {}),
    }))
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, MAX_PRINTINGS);
}

interface AddToWallProps {
  workId: string;
  title: string;
  author?: string;
  cover: Cover;
  editions: readonly EditionView[];
  /**
   * Beside "Close" in the phone sheet (ROADMAP 6.77, mockup D): once the cover
   * is in, the button says only "✓" (Julian, 2026-09-29: „mach den knopf
   * kürzer, nur ✓"), so the collection picker and "Open" fit the row.
   */
  compact?: boolean;
}

/**
 * "Add to collection" under the picked cover (ROADMAP 5.13a). Only Open Library
 * covers: a wall rebuilds its images from the numeric id, which a Google
 * volume does not have.
 */
export default function AddToWall({ workId, title, author, cover, editions, compact = false }: AddToWallProps) {
  const { me, setMe } = useMyWalls();
  const [chosen, setChosen] = useState<string | null>(readTarget);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!cover.id.startsWith('ol:')) return null;
  const coverId = cover.id.slice(3);
  const target = me.walls.find((w) => w.id === chosen) ?? me.walls[0];
  const onTarget = !!target?.tiles.some((t) => t.coverId === coverId);
  const tile: Tile = { workId, coverId, title, ...(author ? { author } : {}), printings: printingsOf(editions) };

  function replace(wall: PublicWall) {
    setMe((m) => ({ ...m, walls: [wall, ...m.walls.filter((w) => w.id !== wall.id)] }));
    setChosen(wall.id);
    writeTarget(wall.id);
  }

  async function run(action: () => Promise<{ wall: PublicWall }>) {
    setBusy(true);
    setError('');
    try {
      replace((await action()).wall);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  const create = () =>
    run(async () => {
      const made = await postJson<{ wall: PublicWall }>('/api/walls', { title: me.walls.length ? `Collection ${me.walls.length + 1}` : 'My collection', tiles: [tile] });
      // The first wall set the cookie; ask again so the ID is known here too.
      const mine = await fetch('/api/walls/me', { cache: 'no-store' }).then((r) => r.json() as Promise<{ visitor: string | null }>).catch(() => ({ visitor: null }));
      setMe((m) => ({ ...m, visitor: mine.visitor ?? m.visitor }));
      return made;
    });

  const toggle = () =>
    target
      ? run(() => postJson('/api/walls/' + target.id, { ops: [onTarget ? { op: 'remove', coverId } : { op: 'add', tile }] }))
      : create();

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={toggle}
          disabled={busy || !me.loaded}
          className={`whitespace-nowrap rounded-full px-3 py-1 transition-colors disabled:opacity-50 ${
            onTarget ? 'border border-accent text-accent hover:bg-accent hover:text-on-accent' : 'bg-ink text-bg hover:bg-accent'
          }`}
        >
          {onTarget ? (compact ? <span aria-label="In your collection" title="In your collection — click to take it out">✓</span> : 'In your collection ✓') : '+ Add to collection'}
        </button>
        {me.walls.length > 0 && (
          <select
            value={target?.id}
            onChange={(e) => {
              if (e.target.value === NEW) create();
              else {
                setChosen(e.target.value);
                writeTarget(e.target.value);
              }
            }}
            aria-label="Which collection"
            className="w-[7.5rem] truncate rounded-full border border-line bg-surface px-2 py-1 text-xs text-ink-2"
          >
            {me.walls.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} ({w.tiles.length}){w.unsaved ? ' — not saved' : ''}
              </option>
            ))}
            <option value={NEW}>New collection with this cover</option>
          </select>
        )}
        {target && (
          <Link href={`/c/${target.id}`} title={`Open ${target.title}`} className="whitespace-nowrap text-xs text-ink-2 underline underline-offset-2 hover:text-accent">
            Open
          </Link>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-accent" role="alert">{error}</p>}
    </div>
  );
}
