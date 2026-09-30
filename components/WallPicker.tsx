'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import CoverGallery from './CoverGallery';
import { printingsOf } from './AddToWall';
import { postJson } from './useMyWalls';
import { useWorkPages } from './useWorkPages';
import { buildWall, captionFor, progressLabel } from './workWall';
import type { Cover, EditionView } from '@/lib/model';
import { swapOps } from '@/lib/walls/edit';
import type { PublicWall, Tile, WallOp } from '@/lib/walls/model';

export default function WallPicker({
  workId,
  target,
  newTitle = 'My collection',
  replace,
  onWall,
  onReplaced,
  onClose,
  className = 'mt-12 border-t border-line pt-8',
}: {
  workId: string;
  /** The collection covers go into; none yet means the first cover makes one, called `newTitle`. */
  target: PublicWall | null;
  newTitle?: string;
  /** From Arrange (5.13m): the picked cover takes this tile's place instead of joining at the end. */
  replace?: { tile: Tile; index: number };
  onWall: (wall: PublicWall) => void;
  /** After a replacement, so the editor can return to Arrange. */
  onReplaced?: () => void;
  onClose: () => void;
  /** The section's own frame; a dialog brings its own. */
  className?: string;
}) {
  const pages = useWorkPages(workId, '', undefined);
  const [error, setError] = useState('');
  // The message follows the reader: a line at the top is out of sight when the cover clicked is far down (Julian, 2026-09-29).
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 7000);
    return () => clearTimeout(t);
  }, [error]);
  const [busy, setBusy] = useState(false);

  const view = useMemo(() => {
    const { merged, work } = pages;
    if (!merged || !work) return null;
    const wall = buildWall(merged, [], new Map(), undefined, null);
    const editionsById = new Map(merged.editions.map((e) => [e.id, e]));
    const captions = new Map(wall.covers.map((c) => [c.id, captionFor(c, editionsById)]));
    return { work, merged, ...wall, editionsById, captions };
  }, [pages]);

  // Google's images have no Open Library number to rebuild them from; they are shown, dimmed, and refused with a word (F9.2).
  const google = useMemo(() => new Set((view?.covers ?? []).filter((c) => !c.id.startsWith('ol:')).map((c) => c.id)), [view]);

  // A tile on the wall marks the gallery cover it is, or the one it was folded into.
  const marked = useMemo(() => {
    const onWall = new Set((target?.tiles ?? []).map((t) => `ol:${t.coverId}`));
    return new Set((view?.covers ?? []).filter((c) => onWall.has(c.id) || c.similarIds?.some((id) => onWall.has(id))).map((c) => c.id));
  }, [view, target]);

  async function change(run: () => Promise<{ wall: PublicWall }>) {
    setBusy(true);
    setError('');
    try {
      const { wall } = await run();
      onWall(wall);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  function toggle(cover: Cover) {
    if (!view || busy) return;
    if (!cover.id.startsWith('ol:')) {
      setError('This image comes from Google Books, and a collection can only hold covers from Open Library for now.');
      return;
    }
    const ids = new Set([cover.id, ...(cover.similarIds ?? [])]);
    const onIt = (target?.tiles ?? []).filter((t) => ids.has(`ol:${t.coverId}`));
    const editions = cover.editionIds.map((id) => view.editionsById.get(id)).filter((e): e is EditionView => !!e);
    const tile: Tile = { workId: view.work.id, coverId: cover.id.slice(3), title: view.work.title, ...(view.work.authors[0] ? { author: view.work.authors[0] } : {}), printings: printingsOf(editions) };
    if (!target) {
      change(() => postJson('/api/walls', { title: newTitle, tiles: [tile] }));
      return;
    }
    if (replace) {
      if (replace.tile.coverId === tile.coverId) return;
      const ops = swapOps(replace.tile, tile, replace.index);
      change(() => postJson(`/api/walls/${target.id}`, { ops })).then(() => onReplaced?.());
      return;
    }
    const ops: WallOp[] = onIt.length ? onIt.map((t) => ({ op: 'remove', coverId: t.coverId })) : [{ op: 'add', tile }];
    change(() => postJson(`/api/walls/${target.id}`, { ops }));
  }

  return (
    <section id="picker" aria-labelledby="picker-title" className={className}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="kicker">Pick covers</p>
          <h2 id="picker-title" className="font-display text-2xl text-ink">
            {view?.work.title ?? '…'}
            {view?.work.authors[0] && <span className="text-ink-3"> · {view.work.authors[0]}</span>}
          </h2>
          <p className="mt-1 text-xs text-ink-3">
            {view ? progressLabel(view.covers.length, view.merged) : pages.status === 'loading' ? 'Loading covers…' : ''}
            {view && (
              <>
                {' · '}
                <Link href={`/book/${workId}`} className="underline underline-offset-2 hover:text-accent">
                  the book&rsquo;s page
                </Link>
              </>
            )}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent">
          Close
        </button>
      </div>

      {/* Which collection a click fills is said here, not left to guess (5.13m). */}
      <p className="mt-3 text-sm text-ink-2">
        {replace ? (
          <>
            Pick another cover for this book: it takes the place of the one marked in <strong className="font-medium text-ink">{target?.title}</strong>.
          </>
        ) : target ? (
          <>
            A click puts a cover into <strong className="font-medium text-ink">{target.title}</strong>, a second click takes it out.
          </>
        ) : (
          'Your first cover starts a new collection; you go on adding in its editor.'
        )}
      </p>
      {google.size > 0 && view && (
        <p className="mt-1 text-xs text-ink-3">
          {google.size} of the {view.covers.length} {google.size === 1 ? 'comes' : 'come'} from Google Books and cannot go into a collection for now — shown dimmed.
        </p>
      )}
      {error && (
        <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-lg rounded-card border border-accent bg-surface px-4 py-3 text-sm text-ink shadow-xl" role="alert">
          {error}
          <button type="button" onClick={() => setError('')} className="ml-3 text-ink-2 underline underline-offset-2 hover:text-accent">
            Close
          </button>
        </div>
      )}

      <div className="mt-6">
        {pages.status === 'notfound' && <p className="text-sm text-ink-2">Open Library has no such book.</p>}
        {pages.status === 'error' && <p className="text-sm text-accent">{pages.message ?? 'Open Library did not answer. Try again in a moment.'}</p>}
        {view && view.groups.length === 0 && pages.merged?.done && <p className="text-sm text-ink-2">Neither catalogue has a cover for this book.</p>}
        {view && view.groups.length > 0 && (
          <CoverGallery groups={view.groups} allCovers={view.all} selectedCover={null} onSelectCover={toggle} captions={view.captions} marked={marked} dimmed={{ ids: google, label: 'Google Books' }} allFirst />
        )}
      </div>
    </section>
  );
}
