'use client';

import Link from '@/components/Link';
import { useEffect, useMemo, useState } from 'react';
import CoverGallery from './CoverGallery';
import { printingsOf } from './AddToWall';
import { postJson } from './useMyWalls';
import { useWorkPages } from './useWorkPages';
import { buildWall, captionFor, progressLabel } from './workWall';
import { rich, useT } from './i18n';
import type { Cover, EditionView } from '@/lib/model';
import { swapOps } from '@/lib/walls/edit';
import { storedCoverId, tileCoverId, type PublicWall, type Tile, type WallOp } from '@/lib/walls/model';

export default function WallPicker({
  workId,
  target,
  newTitle,
  replace,
  choose,
  onWall,
  onReplaced,
  onClose,
  className = 'mt-12 border-t border-line pt-8',
  focus = false,
}: {
  workId: string;
  /** The collection covers go into; none yet means the first cover makes one, called `newTitle`. */
  target: PublicWall | null;
  newTitle?: string;
  /** From Arrange (5.13m): the picked cover takes this tile's place instead of joining at the end. */
  replace?: { tile: Tile; index: number };
  /**
   * Before there is a collection (the photo list on /create, Julian 2026-10-04: „i want a user
   * to be able to change covers in the from photo funnel before they create a collection“):
   * the picked cover goes back to the list and nothing is written.
   */
  choose?: { current: Tile; onChoose: (tile: Tile) => void };
  onWall: (wall: PublicWall) => void;
  /** After a replacement, so the editor can return to Arrange. */
  onReplaced?: () => void;
  onClose: () => void;
  /** The section's own frame; a dialog brings its own. */
  className?: string;
  /**
   * Bring the section into view when it opens (Julian, 2026-10-04: „wenn man bei from a book eines
   * anklickt, muss die seite automatisch runterscrollen zur coverauswahl"). The picker is keyed by
   * its work, so it opens once per book; the caller's old scroll ran before the section existed.
   */
  focus?: boolean;
}) {
  const t = useT();
  useEffect(() => {
    if (focus) document.getElementById('picker')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focus]);
  const pages = useWorkPages(workId, '');
  const [error, setError] = useState('');
  // The message follows the reader: a line at the top is out of sight when the cover clicked is far down (Julian, 2026-09-29).
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 7000);
    return () => clearTimeout(timer);
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

  // A tile on the wall marks the gallery cover it is, or the one it was folded into.
  // Before a collection exists (`choose`), the row's own cover is the one marked.
  const current = choose?.current;
  const marked = useMemo(() => {
    const onWall = new Set([...(target?.tiles ?? []), ...(current ? [current] : [])].map(tileCoverId));
    return new Set((view?.covers ?? []).filter((c) => onWall.has(c.id) || c.similarIds?.some((id) => onWall.has(id))).map((c) => c.id));
  }, [view, target, current]);

  async function change(run: () => Promise<{ wall: PublicWall }>) {
    setBusy(true);
    setError('');
    try {
      const { wall } = await run();
      onWall(wall);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('That did not work.'));
    } finally {
      setBusy(false);
    }
  }

  function toggle(cover: Cover) {
    if (!view || busy) return;
    const stored = storedCoverId(cover.id);
    if (!stored) {
      setError(t('This image has no id a collection can keep.'));
      return;
    }
    const ids = new Set([cover.id, ...(cover.similarIds ?? [])]);
    const onIt = (target?.tiles ?? []).filter((tile) => ids.has(tileCoverId(tile)));
    const editions = cover.editionIds.map((id) => view.editionsById.get(id)).filter((e): e is EditionView => !!e);
    const tile: Tile = { workId: view.work.id, coverId: stored, title: view.work.title, ...(view.work.authors[0] ? { author: view.work.authors[0] } : {}), printings: printingsOf(editions) };
    if (choose) {
      if (tileCoverId(choose.current) !== tile.coverId) choose.onChoose(tile);
      else onClose();
      return;
    }
    if (!target) {
      change(() => postJson('/api/walls', { title: newTitle ?? t('My collection'), tiles: [tile] }));
      return;
    }
    if (replace) {
      if (replace.tile.coverId === tile.coverId) return;
      const ops = swapOps(replace.tile, tile, replace.index);
      change(() => postJson(`/api/walls/${target.id}`, { ops })).then(() => onReplaced?.());
      return;
    }
    const ops: WallOp[] = onIt.length ? onIt.map((tile) => ({ op: 'remove', coverId: tile.coverId })) : [{ op: 'add', tile }];
    change(() => postJson(`/api/walls/${target.id}`, { ops }));
  }

  return (
    <section id="picker" aria-labelledby="picker-title" className={`scroll-mt-20 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="kicker">{t('Pick covers')}</p>
          <h2 id="picker-title" className="font-display text-2xl text-ink">
            {view?.work.title ?? '…'}
            {view?.work.authors[0] && <span className="text-ink-3"> · {view.work.authors[0]}</span>}
          </h2>
          <p className="mt-1 text-xs text-ink-3">
            {view ? progressLabel(view.covers.length, view.merged, t) : pages.status === 'loading' ? t('Loading covers…') : ''}
            {view && (
              <>
                {' · '}
                <Link href={`/book/${workId}`} className="underline underline-offset-2 hover:text-accent">
                  {t('the book’s page')}
                </Link>
              </>
            )}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent">
          {t('Close')}
        </button>
      </div>

      {/* Which collection a click fills is said here, not left to guess (5.13m). */}
      <p className="mt-3 text-sm text-ink-2">
        {choose
          ? t('Pick another cover for this book: it takes the place of the marked one in your list.')
          : replace
            ? rich(t('Pick another cover for this book: it takes the place of the one marked in {title}.'), { title: <strong className="font-medium text-ink">{target?.title}</strong> })
            : target
              ? rich(t('A click puts a cover into {title}, a second click takes it out.'), { title: <strong className="font-medium text-ink">{target.title}</strong> })
              : t('Your first cover starts a new collection; you go on adding in its editor.')}
      </p>
      {error && (
        <div className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-lg rounded-card border border-accent bg-surface px-4 py-3 text-sm text-ink shadow-xl" role="alert">
          {error}
          <button type="button" onClick={() => setError('')} className="ml-3 text-ink-2 underline underline-offset-2 hover:text-accent">
            {t('Close')}
          </button>
        </div>
      )}

      <div className="mt-6">
        {pages.status === 'notfound' && <p className="text-sm text-ink-2">{t('Open Library has no such book.')}</p>}
        {pages.status === 'error' && <p className="text-sm text-accent">{pages.message ?? t('Open Library did not answer. Try again in a moment.')}</p>}
        {view && view.groups.length === 0 && pages.merged?.done && <p className="text-sm text-ink-2">{t('Neither catalogue has a cover for this book.')}</p>}
        {view && view.groups.length > 0 && (
          <CoverGallery groups={view.groups} allCovers={view.all} selectedCover={null} onSelectCover={toggle} captions={view.captions} marked={marked} markLabel={choose ? t('In your list') : undefined} allFirst />
        )}
      </div>
    </section>
  );
}
