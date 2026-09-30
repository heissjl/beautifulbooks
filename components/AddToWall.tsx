'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { Cover, EditionView } from '@/lib/model';
import { MAX_PRINTINGS, storedCoverId, type Printing, type PublicWall, type Tile } from '@/lib/walls/model';
import { useEditingId } from './editingSession';
import { announceWall, createWall, postJson, useMyWalls } from './useMyWalls';
import { defaultTitle, editHref } from '@/lib/walls/edit';

const TARGET_KEY = 'bb.wall.target';

function readTarget(): string | null {
  try {
    return localStorage.getItem(TARGET_KEY);
  } catch {
    return null;
  }
}
/** The collection "Add to collection" fills next; the editor sets it to the one it has open (5.13m). */
export function writeTarget(id: string) {
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
   * Beside "Close" in the phone sheet (ROADMAP 6.77): once the cover
   * is in, the button says only "✓" (Julian, 2026-09-29: „mach den knopf
   * kürzer, nur ✓"), so the collection picker and "Open" fit the row.
   */
  compact?: boolean;
}

/**
 * "Add to collection" under the picked cover (ROADMAP 5.13a, 5.13m). Only
 * Open Library covers: a wall rebuilds its images from the numeric id, which
 * a Google volume does not have.
 *
 * The first click with no collection yet makes "My collection" with this
 * cover. After that the button opens a list of every collection of this
 * browser's with a tick where the cover is in it — one click puts it in or
 * takes it out of that one (Julian, 2026-09-29, plan 5.13m). The collection
 * this tab is editing comes first, marked "editing".
 */
export default function AddToWall({ workId, title, author, cover, editions, compact = false }: AddToWallProps) {
  const { me, setMe } = useMyWalls();
  const editingId = useEditingId();
  const [lastTarget] = useState<string | null>(readTarget);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);

  // A click outside or Escape closes the list; nothing is lost, every tick is sent at once.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && e.target instanceof Node && !box.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const coverId = storedCoverId(cover.id);
  if (!coverId) return null;
  const tile: Tile = { workId, coverId, title, ...(author ? { author } : {}), printings: printingsOf(editions) };
  const rank = (id: string) => (id === editingId ? 0 : id === lastTarget ? 1 : 2);
  const walls = [...me.walls].sort((a, b) => rank(a.id) - rank(b.id));
  const holding = walls.filter((w) => w.tiles.some((t) => t.coverId === coverId));
  const editorOf = walls.find((w) => w.id === editingId) ?? walls[0];

  // Every useMyWalls on the page takes it, this one included (the editing band counts along).
  const replace = announceWall;

  async function run(key: string, action: () => Promise<PublicWall>) {
    setBusy(key);
    setError('');
    try {
      const wall = await action();
      replace(wall);
      writeTarget(wall.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(null);
    }
  }

  const create = () =>
    run('new', async () => {
      const made = await createWall(defaultTitle(me.walls), [tile]);
      // The first collection set the cookie; ask again so the ID is known here too.
      if (!me.visitor) {
        const mine = await fetch('/api/walls/me', { cache: 'no-store' }).then((r) => r.json() as Promise<{ visitor: string | null }>).catch(() => ({ visitor: null }));
        setMe((m) => ({ ...m, visitor: mine.visitor ?? m.visitor }));
      }
      return made;
    });

  const toggle = (wall: PublicWall) => {
    const inIt = wall.tiles.some((t) => t.coverId === coverId);
    return run(wall.id, async () => (await postJson<{ wall: PublicWall }>(`/api/walls/${wall.id}`, { ops: [inIt ? { op: 'remove', coverId } : { op: 'add', tile }] })).wall);
  };

  const long = holding.length === 0 ? '+ Add to collection' : holding.length === 1 ? `In ${holding[0].title} ✓` : `In ${holding.length} collections ✓`;
  const label = compact && holding.length > 0 ? '✓' : long;

  return (
    <div ref={box} className="relative text-sm">
      <button
        type="button"
        onClick={() => (walls.length === 0 ? create().then(() => setOpen(true)) : setOpen((o) => !o))}
        disabled={!me.loaded || busy === 'new'}
        aria-expanded={walls.length > 0 ? open : undefined}
        aria-haspopup={walls.length > 0 ? 'true' : undefined}
        aria-label={label === '✓' ? long : undefined}
        title={label === '✓' ? long : undefined}
        className={`max-w-[15rem] truncate whitespace-nowrap rounded-full px-3 py-1 transition-colors disabled:opacity-50 ${
          holding.length ? 'border border-accent text-accent hover:bg-accent hover:text-on-accent' : 'bg-ink text-bg hover:bg-accent'
        }`}
      >
        {label}
        {walls.length > 0 && <span aria-hidden="true"> ▾</span>}
      </button>

      {open && walls.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 rounded-card border border-line bg-surface p-3 shadow-xl" role="group" aria-label="Put this cover into">
          <p className="kicker">Put this cover into</p>
          <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
            {walls.map((w) => {
              const inIt = w.tiles.some((t) => t.coverId === coverId);
              return (
                <li key={w.id}>
                  <label className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-2 ${w.id === editingId ? 'bg-surface-2' : ''}`}>
                    <input type="checkbox" checked={inIt} disabled={busy === w.id} onChange={() => toggle(w)} />
                    <span className="min-w-0 flex-1 truncate text-ink">{w.title}</span>
                    <span className={`shrink-0 text-xs ${w.id === editingId ? 'text-accent' : 'text-ink-3'}`}>
                      {w.id === editingId ? 'editing · ' : w.unsaved ? 'not saved yet · ' : ''}
                      {w.tiles.length}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 text-xs">
            <button type="button" onClick={create} disabled={busy === 'new'} className="text-accent underline underline-offset-2 disabled:opacity-50">
              + New collection with it
            </button>
            {editorOf && (
              <Link href={editHref(editorOf.id)} className="text-ink-2 underline underline-offset-2 hover:text-accent">
                Open the editor
              </Link>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-accent" role="alert">{error}</p>}
    </div>
  );
}
