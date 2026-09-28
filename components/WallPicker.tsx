'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import CoverGallery from './CoverGallery';
import CoverImage from './CoverImage';
import { printingsOf } from './AddToWall';
import { postJson } from './useMyWalls';
import { useWorkPages } from './useWorkPages';
import { buildWall, captionFor, progressLabel } from './workWall';
import { coverUrlFor } from '@/lib/coverurl';
import type { Cover, EditionView } from '@/lib/model';
import type { PublicWall, Tile, WallOp } from '@/lib/walls/model';

const NEW = '__new__';

/**
 * One work's covers, for picking onto a wall without leaving /walls (ROADMAP
 * 5.13c; Julian, 2026-09-28: „die auswahl passiert in einem neuen zwischenteil
 * … sodass ich nicht von der seite runtergeschickt werde. … wir können teile
 * der detail-ansicht weglassen und uns auf die funktionen der coverauswahl
 * konzentrieren"). The same wall as the book page — loaded page by page,
 * folded, grouped by language — with none of its shop column: a click puts a
 * cover on the wall or takes it off, and the wall grows in the strip above.
 */
export default function WallPicker({
  workId,
  walls,
  target,
  onTarget,
  onWall,
  onClose,
}: {
  workId: string;
  walls: PublicWall[];
  target: PublicWall | undefined;
  onTarget: (id: string) => void;
  onWall: (wall: PublicWall) => void;
  onClose: () => void;
}) {
  const pages = useWorkPages(workId, '', undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const view = useMemo(() => {
    const { merged, work } = pages;
    if (!merged || !work) return null;
    const wall = buildWall(merged, [], new Map(), undefined, null);
    const editionsById = new Map(merged.editions.map((e) => [e.id, e]));
    const captions = new Map(wall.covers.map((c) => [c.id, captionFor(c, editionsById)]));
    return { work, merged, ...wall, editionsById, captions };
  }, [pages]);

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
      onTarget(wall.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally {
      setBusy(false);
    }
  }

  function toggle(cover: Cover) {
    if (!view || busy) return;
    if (!cover.id.startsWith('ol:')) {
      setError('This image comes from Google Books and cannot go into a collection yet.');
      return;
    }
    const ids = new Set([cover.id, ...(cover.similarIds ?? [])]);
    const onIt = (target?.tiles ?? []).filter((t) => ids.has(`ol:${t.coverId}`));
    const editions = cover.editionIds.map((id) => view.editionsById.get(id)).filter((e): e is EditionView => !!e);
    const tile: Tile = { workId: view.work.id, coverId: cover.id.slice(3), title: view.work.title, ...(view.work.authors[0] ? { author: view.work.authors[0] } : {}), printings: printingsOf(editions) };
    if (!target) {
      change(() => postJson('/api/walls', { title: 'My collection', tiles: [tile] }));
      return;
    }
    const ops: WallOp[] = onIt.length ? onIt.map((t) => ({ op: 'remove', coverId: t.coverId })) : [{ op: 'add', tile }];
    change(() => postJson(`/api/walls/${target.id}`, { ops }));
  }

  const newWall = () => change(() => postJson('/api/walls', { title: walls.length ? `Collection ${walls.length + 1}` : 'My collection' }));

  return (
    <section id="picker" aria-labelledby="picker-title" className="mt-12 border-t border-line pt-8">
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
          Done
        </button>
      </div>

      {/* The wall this picks for, and what is on it so far. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3">
        <span className="text-sm text-ink-2">Adding to</span>
        {walls.length > 0 ? (
          <select
            value={target?.id}
            onChange={(e) => (e.target.value === NEW ? newWall() : onTarget(e.target.value))}
            aria-label="Which collection"
            className="max-w-[14rem] truncate rounded-full border border-line bg-bg px-2 py-1 text-sm text-ink"
          >
            {walls.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} ({w.tiles.length})
              </option>
            ))}
            <option value={NEW}>A new collection</option>
          </select>
        ) : (
          <span className="text-sm text-ink">a new collection, made with your first cover</span>
        )}
        <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto" aria-label="In this collection">
          {(target?.tiles ?? []).map((t) => (
            <li key={t.coverId} className="relative h-12 w-8 shrink-0 overflow-hidden rounded-[2px] bg-surface-2" title={t.title}>
              <CoverImage src={coverUrlFor(`ol:${t.coverId}`, 'S') ?? ''} alt={t.title} sizes="32px" />
            </li>
          ))}
        </ul>
        {target && (
          <Link href={`/c/${target.id}`} className="whitespace-nowrap text-sm text-ink-2 underline underline-offset-2 hover:text-accent">
            Open collection
          </Link>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-accent" role="alert">{error}</p>}

      <div className="mt-6">
        {pages.status === 'notfound' && <p className="text-sm text-ink-2">Open Library has no such book.</p>}
        {pages.status === 'error' && <p className="text-sm text-accent">{pages.message ?? 'Open Library did not answer. Try again in a moment.'}</p>}
        {view && view.groups.length === 0 && pages.merged?.done && <p className="text-sm text-ink-2">Neither catalogue has a cover for this book.</p>}
        {view && view.groups.length > 0 && (
          <CoverGallery groups={view.groups} allCovers={view.all} selectedCover={null} onSelectCover={toggle} captions={view.captions} marked={marked} allFirst />
        )}
      </div>
    </section>
  );
}
