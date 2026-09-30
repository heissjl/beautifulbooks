'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { writeTarget } from './AddToWall';
import { startEditing, stopEditing } from './editingSession';
import BookSearch from './BookSearch';
import CoverImage from './CoverImage';
import StartFromPicker from './StartFromPicker';
import WallPhoto from './WallPhoto';
import WallPicker from './WallPicker';
import type { Destination } from './WallProposal';
import WallSample from './WallSample';
import CollectionSheet from './CollectionSheet';
import { useIsDesktop } from './useIsDesktop';
import { addTiles, createWall, postJson, useMyWalls } from './useMyWalls';
import { coverUrlFor } from '@/lib/coverurl';
import { defaultTitle, editHref, readEditState, type AddTab, type EditState } from '@/lib/walls/edit';
import type { StartOption } from '@/lib/walls/jumpstart';
import { MAX_BY, MAX_INTRO, UNSAVED_HOURS, type PublicWall, type Tile, type WallOp } from '@/lib/walls/model';

type Access = 'checking' | 'owner' | 'down';

const TAB_LABELS: Record<AddTab, string> = { search: 'Search', photo: 'Photo', ideas: 'Ideas' };

/**
 * The editing mode of a reader's collection, `/c/<id>/edit` (ROADMAP 5.13m;
 * Julian, 2026-09-29: „es sollte einen bearbeitungsmodus geben bei dem klar
 * ist, bei welcher collection man gerade was hinzufügt mit bild oder suche“).
 *
 * A band under the header says what is being edited, all the way down the
 * page. "Add covers" has the ways in on the left — a book's covers, a photo,
 * ideas — and on the right the collection they go into, by name, with every
 * cover. "Arrange" gives the collection the whole width to order, name and
 * describe it (Julian chose a mode in the editor over tools on the view).
 * Every change is one request and kept at once; "Keep it" is the separate
 * choice of 5.13j to keep the collection past two days.
 *
 * Only the browser that made the collection edits it: anyone else is sent to
 * its view, as the server answers `canEdit`.
 */
export default function CollectionEditor({ initial, photoOn, startOptions }: { initial: PublicWall; photoOn: boolean; startOptions: StartOption[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const state = readEditState((key) => params.get(key));
  const { me, setMe } = useMyWalls();
  const isDesktop = useIsDesktop();
  const [wall, setWall] = useState(initial);
  const [access, setAccess] = useState<Access>('checking');
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');

  const id = initial.id;
  useEffect(() => {
    let live = true;
    fetch(`/api/walls/${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<{ wall: PublicWall; canEdit: boolean }>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!live) return;
        if (!d.canEdit) {
          router.replace(`/c/${id}`);
          return;
        }
        setWall(d.wall);
        setAccess('owner');
        // "Add to collection" on a book page fills this one next, and a book page says so (step 4).
        writeTarget(id);
        startEditing(id);
      })
      .catch(() => live && setAccess('down'));
    return () => {
      live = false;
    };
  }, [id, router]);

  function go(next: EditState) {
    router.push(editHref(id, { ...state, ...next }), { scroll: false });
  }

  /** Takes the collection as the server answered, and marks what came in since the page opened. */
  function accept(next: PublicWall) {
    const before = new Set(wall.tiles.map((t) => t.coverId));
    const added = next.tiles.filter((t) => !before.has(t.coverId)).map((t) => t.coverId);
    if (added.length) setFresh((prev) => new Set([...prev, ...added]));
    setWall(next);
    setMe((m) => ({ ...m, walls: m.walls.some((w) => w.id === next.id) ? m.walls.map((w) => (w.id === next.id ? next : w)) : [next, ...m.walls] }));
  }

  async function send(ops: WallOp[]) {
    setError('');
    try {
      accept((await postJson<{ wall: PublicWall }>(`/api/walls/${id}`, { ops })).wall);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    }
  }

  async function commit(dest: Destination, tiles: Tile[]) {
    if ('wall' in dest) {
      accept(await addTiles(wall, tiles));
      return;
    }
    const made = await createWall(dest.title, tiles);
    router.push(editHref(made.id));
  }

  async function newCollection() {
    try {
      const made = await createWall(defaultTitle(me.walls));
      router.push(editHref(made.id, { add: state.add, q: state.q, work: state.work }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The collection could not be made.');
    }
  }

  const showCovers = (tile: Tile) => go({ add: 'search', q: tile.title, work: tile.workId });

  if (access !== 'owner') {
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-24 text-center text-ink-2 sm:px-6 lg:px-8" role="status">
        {access === 'down' ? 'The store did not answer. Try again in a moment.' : 'Opening the collection…'}
      </main>
    );
  }

  const count = `${wall.tiles.length} ${wall.tiles.length === 1 ? 'cover' : 'covers'}`;
  const others = me.walls.filter((w) => w.id !== id);
  const tabs: AddTab[] = photoOn ? ['search', 'photo', 'ideas'] : ['search', 'ideas'];
  const tab = tabs.includes(state.add) ? state.add : 'search';
  const panel = (
    <TargetPanel wall={wall} fresh={fresh} others={others} state={state} onSend={send} onArrange={() => go({ mode: 'arrange' })} onNew={newCollection} />
  );
  const pill = (active: boolean) =>
    `rounded-full border px-4 py-1 text-sm transition-colors ${active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2 hover:border-accent hover:text-accent'}`;

  return (
    <>
      {/* The band: what is being edited, kept in sight while scrolling. */}
      <div className="sticky top-14 z-10 bg-ink text-bg">
        <div className="mx-auto flex min-h-12 max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
          <span className="text-[11px] uppercase tracking-[0.14em] text-bg/70">Editing</span>
          <span className="min-w-0 flex-1 truncate font-display text-lg sm:flex-none sm:text-xl">{wall.title}</span>
          <span className="hidden text-sm text-bg/70 sm:inline">
            {count}
            {wall.unsaved && ' · not saved yet'}
          </span>
          <span className="ml-auto flex items-center gap-3">
            {wall.unsaved && (
              <button type="button" onClick={() => send([{ op: 'save' }])} title={`Unkept collections are deleted after ${UNSAVED_HOURS / 24} days.`} className="rounded-full border border-bg/50 px-3 py-0.5 text-sm hover:border-bg">
                Keep it
              </button>
            )}
            <Link href={`/c/${id}`} className="hidden text-sm text-bg/80 underline underline-offset-4 hover:text-bg md:inline">
              See it as others do
            </Link>
            <Link href={`/c/${id}`} onClick={stopEditing} className="rounded-full bg-bg px-4 py-0.5 text-sm text-ink hover:bg-surface">
              Stop editing
            </Link>
          </span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pb-24 lg:px-8">
        <div className="flex gap-2" role="tablist" aria-label="What to do">
          <button type="button" role="tab" aria-selected={state.mode === 'add'} onClick={() => go({ mode: 'add' })} className={pill(state.mode === 'add')}>
            Add covers
          </button>
          <button type="button" role="tab" aria-selected={state.mode === 'arrange'} onClick={() => go({ mode: 'arrange' })} className={pill(state.mode === 'arrange')}>
            Arrange
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-accent" role="alert">{error}</p>}

        {state.mode === 'arrange' ? (
          <Arrange wall={wall} onSend={send} onAdd={() => go({ mode: 'add' })} />
        ) : (
          <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section aria-labelledby="add-title" className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-line pb-2">
                <h2 id="add-title" className="font-display text-2xl text-ink">Add covers</h2>
                <div className="flex gap-1.5" role="tablist" aria-label="Where covers come from">
                  {tabs.map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => go({ add: t })} className={pill(tab === t)}>
                      {TAB_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {tab === 'search' && (
                <>
                  <BookSearch
                    key={state.q ?? ''}
                    q={state.q ?? ''}
                    workId={state.work ?? null}
                    onSearch={(q) => go({ q, work: undefined })}
                    onPick={(work) => {
                      go({ work });
                      requestAnimationFrame(() => document.getElementById('picker')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                    }}
                  />
                  {state.work && <WallPicker key={state.work} workId={state.work} target={wall} onWall={accept} onClose={() => go({ work: undefined })} />}
                </>
              )}
              {tab === 'photo' && (
                <>
                  <p className="mt-4 text-sm text-ink-2">
                    Photograph a shelf or a pile of books. The books we can read are offered for <strong className="font-medium text-ink">{wall.title}</strong> — you tick which go in.
                  </p>
                  <WallPhoto photoOn={photoOn} target={wall} onCommit={commit} onOtherCover={showCovers} onSearchFor={(q) => go({ add: 'search', q, work: undefined })} />
                </>
              )}
              {tab === 'ideas' && (
                <div className="mt-5 space-y-10">
                  <div>
                    <h3 className="font-display text-lg text-ink">Six random favourites</h3>
                    <div className="mt-2">
                      <WallSample target={wall} onCommit={commit} onOtherCover={showCovers} />
                    </div>
                  </div>
                  <StartFromPicker options={startOptions} into={wall} onCommit={commit} onOtherCover={showCovers} />
                </div>
              )}
            </section>

            {isDesktop && (
              <aside aria-labelledby="target-title" className="min-w-0 lg:sticky lg:top-32 lg:self-start">
                {panel}
              </aside>
            )}
          </div>
        )}
      </main>
      {!isDesktop && state.mode === 'add' && <CollectionSheet wall={wall} fresh={fresh}>{panel}</CollectionSheet>}
    </>
  );
}

/**
 * "Arrange": the collection across the whole width, its words above it, and
 * every cover's tools always in sight — the narrow column is for gathering,
 * not for ordering forty covers.
 */
function Arrange({ wall, onSend, onAdd }: { wall: PublicWall; onSend: (ops: WallOp[]) => void; onAdd: () => void }) {
  return (
    <section className="mt-6" aria-label="Arrange the collection">
      <input
        defaultValue={wall.title}
        key={wall.title}
        onBlur={(e) => e.target.value.trim() !== wall.title && onSend([{ op: 'title', title: e.target.value }])}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Title of the collection"
        className="block w-full border-b border-line bg-transparent font-display text-3xl leading-tight text-ink focus:border-accent focus:outline-none sm:text-4xl"
      />
      <input
        defaultValue={wall.by ?? ''}
        key={`by-${wall.by ?? ''}`}
        maxLength={MAX_BY}
        placeholder="Your name (optional, shown with the collection)"
        onBlur={(e) => e.target.value.trim() !== (wall.by ?? '') && onSend([{ op: 'by', by: e.target.value }])}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Your name"
        className="mt-4 block w-full max-w-sm rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink-2 placeholder:text-ink-3"
      />
      <textarea
        defaultValue={wall.intro ?? ''}
        key={wall.intro ?? ''}
        maxLength={MAX_INTRO}
        rows={2}
        placeholder="A few lines about this collection — what ties it together."
        onBlur={(e) => e.target.value.trim() !== (wall.intro ?? '') && onSend([{ op: 'intro', intro: e.target.value }])}
        aria-label="A few lines about this collection"
        className="mt-3 block w-full max-w-2xl resize-y rounded-md border border-line bg-surface px-3 py-2 text-base text-ink-2 placeholder:text-ink-3"
      />

      {wall.tiles.length === 0 ? (
        <p className="mt-8 text-sm text-ink-2">
          No covers yet.{' '}
          <button type="button" onClick={onAdd} className="text-accent underline underline-offset-4">
            Add some
          </button>
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {wall.tiles.map((t, i) => {
            const src = coverUrlFor(`ol:${t.coverId}`, 'M');
            const label = t.author ? `${t.title} by ${t.author}` : t.title;
            return (
              <li key={t.coverId}>
                <span className="cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2" title={label}>
                  {src && <CoverImage src={src} alt={label} sizes="(max-width: 640px) 33vw, (max-width: 1024px) 25vw, 16vw" />}
                </span>
                <span className="mt-1.5 flex justify-between">
                  <ToolButton label={`Move ${t.title} left`} hidden={i === 0} onClick={() => onSend([{ op: 'move', coverId: t.coverId, to: i - 1 }])}>←</ToolButton>
                  <ToolButton label={`Take ${t.title} out`} onClick={() => onSend([{ op: 'remove', coverId: t.coverId }])}>✕</ToolButton>
                  <ToolButton label={`Move ${t.title} right`} hidden={i === wall.tiles.length - 1} onClick={() => onSend([{ op: 'move', coverId: t.coverId, to: i + 1 }])}>→</ToolButton>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ToolButton({ label, hidden, onClick, children }: { label: string; hidden?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`h-8 w-8 rounded-full border border-line bg-surface text-sm text-ink-2 hover:border-accent hover:text-accent ${hidden ? 'invisible' : ''}`}
    >
      {children}
    </button>
  );
}

/**
 * The collection covers go into: its name, every cover with ✕, the new ones
 * marked, and the other collections to switch to. Beside the ways in on a
 * wide screen; in a sheet behind a bar at the bottom on a phone (step 5).
 */
function TargetPanel({
  wall,
  fresh,
  others,
  state,
  onSend,
  onArrange,
  onNew,
}: {
  wall: PublicWall;
  fresh: ReadonlySet<string>;
  others: PublicWall[];
  state: EditState;
  onSend: (ops: WallOp[]) => void;
  onArrange: () => void;
  onNew: () => void;
}) {
  const count = `${wall.tiles.length} ${wall.tiles.length === 1 ? 'cover' : 'covers'}`;
  return (
    <>
      <div className="rounded-card border border-accent bg-surface p-4">
        <p id="target-title" className="text-[11px] uppercase tracking-[0.14em] text-accent">You are adding to</p>
        <input
          defaultValue={wall.title}
          key={wall.title}
          onBlur={(e) => e.target.value.trim() !== wall.title && onSend([{ op: 'title', title: e.target.value }])}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          aria-label="Title of the collection"
          className="mt-0.5 block w-full border-b border-line bg-transparent py-0.5 font-display text-2xl text-ink focus:border-accent focus:outline-none"
        />
        <p className="mt-1.5 flex justify-between gap-3 text-xs text-ink-3">
          <span>{count}</span>
          <button type="button" onClick={onArrange} className="text-accent underline underline-offset-2">
            Arrange, your name, a few lines
          </button>
        </p>
        {wall.tiles.length === 0 ? (
          <p className="mt-4 text-sm text-ink-2">No covers yet. Pick some on the left.</p>
        ) : (
          <ul className="mt-3 grid max-h-[55vh] grid-cols-4 gap-2 overflow-y-auto pr-1" aria-label={`Covers in ${wall.title}`}>
            {wall.tiles.map((t) => (
              <li key={t.coverId} className="relative">
                <span className={`relative block aspect-[2/3] overflow-hidden rounded-[3px] bg-surface-2 ${fresh.has(t.coverId) ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : ''}`}>
                  <CoverImage src={coverUrlFor(`ol:${t.coverId}`, 'S') ?? ''} alt={t.title} sizes="80px" />
                </span>
                <button
                  type="button"
                  aria-label={`Take ${t.title} out`}
                  title="Take it out"
                  onClick={() => onSend([{ op: 'remove', coverId: t.coverId }])}
                  className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/75 text-xs text-white hover:bg-accent"
                >
                  ✕
                </button>
                {fresh.has(t.coverId) && <span className="absolute bottom-1 left-1 rounded-full bg-accent px-1.5 text-[10px] text-on-accent">new</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-line pt-2 text-xs text-ink-3">Every change is kept at once.</p>
      </div>

      <div className="mt-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ink-3">Add to another instead</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5 text-sm">
          {others.map((w) => (
            <Link
              key={w.id}
              href={editHref(w.id, { add: state.add, q: state.q, work: state.work })}
              className="rounded-full border border-line bg-surface px-3 py-0.5 text-ink-2 hover:border-accent hover:text-accent"
            >
              {w.title} <span className="text-ink-3">{w.tiles.length}</span>
            </Link>
          ))}
          <button type="button" onClick={onNew} className="rounded-full border border-dashed border-line px-3 py-0.5 text-ink-2 hover:border-accent hover:text-accent">
            + New collection
          </button>
        </div>
      </div>
    </>
  );
}
