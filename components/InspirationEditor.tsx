'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CoverImage from './CoverImage';
import { coverRefFromUrl, coverUrlFor } from '@/lib/coverurl';
import {
  SLOTS,
  NAME_MAX,
  type Board,
  boardQuery,
  cleanName,
  filledCount,
  firstEmpty,
  parseBoard,
  place,
  remove,
  setCover,
  swap,
} from '@/lib/inspiration/board';
import type { BrowseList, BrowseWork } from '@/lib/inspiration/browse';
import type { WorkCovers } from '@/lib/inspiration/covers';
import type { SearchResult } from '@/lib/search';
import { SITE_NAME } from '@/lib/seo';

/**
 * The editor of "The books that inspired me" (ROADMAP 5.18b), moved here from
 * `lab/inspiration` on 2026-10-05 so that it can be developed on a preview.
 *
 * It follows "Arrange" in the collection editor (`CollectionEditor.tsx`): a
 * band that keeps the state and the way out in sight, every cover's tools
 * under it, a click on a cover for another cover of the same book, a drag to
 * move it. Its windows are a pop-up on a wide screen and a sheet from the
 * bottom on a phone (Julian, 2026-10-05: „mit pop-up im desktop mode, mobil
 * vielleicht anders").
 *
 * **The address is the board.** Nine places fit in a query string
 * (`lib/inspiration/board.ts`), so nothing is stored while a board is made
 * and a reload loses nothing; only "Done" asks for a link.
 *
 * **English only for now.** The sentences here are still being decided
 * (the headline and the hashtag are Julian's to settle), so they do not go
 * through `t()` yet: translating them now would pin wording that is about to
 * change. German is a step before production, listed in ROADMAP 5.18b.
 */

export type Named = { title: string; author?: string | null };

type Win = null | { kind: 'add' } | { kind: 'covers'; index: number };
type AddTab = 'search' | 'browse';

interface Hit {
  id: string;
  title: string;
  author?: string;
  year?: number;
  coverId: string | null;
}

type Found =
  | { state: 'idle' }
  | { state: 'loading' | 'slow' }
  | { state: 'done'; hits: Hit[]; seconds: number }
  | { state: 'failed'; message: string };

type Lists = { state: 'idle' | 'loading' } | { state: 'done'; lists: BrowseList[] } | { state: 'failed' };

type Covers =
  | { workId: string; state: 'loading' }
  | { workId: string; state: 'done'; data: WorkCovers }
  | { workId: string; state: 'failed'; message: string };

const LIST_LABELS: Record<BrowseList['id'], string> = {
  curated: `Picked by ${SITE_NAME}`,
  popular: 'Most read on Open Library',
};

const CHUNK = 60;
const pill = (active: boolean) =>
  `rounded-full border px-4 py-1 text-sm transition-colors ${active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2 hover:border-accent hover:text-accent'}`;
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function InspirationEditor({ initialQuery, initialNames }: { initialQuery: string; initialNames: Record<string, Named> }) {
  const router = useRouter();
  const [board, setBoard] = useState<Board>(() => parseBoard(new URLSearchParams(initialQuery)));
  // What the reader types, kept apart from the cleaned name: cleaning trims, and a trimmed field cannot take a space.
  const [nameDraft, setNameDraft] = useState(() => parseBoard(new URLSearchParams(initialQuery)).by);
  const [names, setNames] = useState(initialNames);
  const [win, setWin] = useState<Win>(null);
  // The place the next book goes into; the window stays open from one book to the next.
  const [target, setTarget] = useState(-1);
  const [addTab, setAddTab] = useState<AddTab>('search');
  const [lists, setLists] = useState<Lists>({ state: 'idle' });
  const [covers, setCovers] = useState<Covers | null>(null);
  const [link, setLink] = useState<{ busy: boolean; note: string }>({ busy: false, note: '' });

  useEffect(() => {
    const q = boardQuery(board);
    window.history.replaceState(null, '', q ? `/inspiration?${q}` : '/inspiration');
  }, [board]);

  const filled = filledCount(board);
  const nameOf = (workId: string) => names[workId]?.title ?? 'This book';

  /*
    Dragging a cover to its place, as Arrange does it: pointer events, one drag
    at a time. A mouse picks a cover up anywhere on it; a finger only by the
    grip, which has `touch-action: none` — on the cover itself a finger must
    still scroll the page. Dropping on another place swaps the two: the board
    has nine fixed places, so nothing shifts. The press is kept outside
    React's state because it is only read in handlers, never in render.
  */
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null);
  const press = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  function pickUp(e: React.PointerEvent<HTMLElement>, from: number) {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer the browser no longer knows (a synthetic one in a test): the drag still runs on plain events.
    }
    press.current = { x: e.clientX, y: e.clientY, moved: false };
    setDrag({ from, over: null });
  }
  function track(e: React.PointerEvent<HTMLElement>) {
    const p = press.current;
    if (!drag || !p) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.moved = true;
    if (!p.moved) return;
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-index]');
    const over = under ? Number(under.dataset.index) : drag.from;
    setDrag((d) => (d && d.over !== over ? { ...d, over } : d));
  }
  function drop(e: React.PointerEvent<HTMLElement>) {
    if (!drag) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const { from, over } = drag;
    if (press.current?.moved && over !== null && over !== from) setBoard((b) => swap(b, from, over));
    setDrag(null);
    // `moved` has to outlive this event for the click that follows a drag, and no longer:
    // a cover opened from the keyboard sends a click with no press before it.
    setTimeout(() => {
      press.current = null;
    }, 0);
  }
  const handlers = { onPointerMove: track, onPointerUp: drop, onPointerCancel: () => setDrag(null) };

  function loadLists() {
    if (lists.state === 'loading' || lists.state === 'done') return;
    setLists({ state: 'loading' });
    fetch('/api/inspiration/browse')
      .then((r) => (r.ok ? (r.json() as Promise<{ lists: BrowseList[] }>) : Promise.reject(new Error(String(r.status)))))
      .then((d) => setLists({ state: 'done', lists: d.lists }))
      .catch(() => setLists({ state: 'failed' }));
  }

  function openAdd(index: number) {
    setTarget(index);
    setWin({ kind: 'add' });
    if (addTab === 'browse') loadLists();
  }

  function showTab(tab: AddTab) {
    setAddTab(tab);
    if (tab === 'browse') loadLists();
  }

  /** Puts a book on the board, or takes it off again when it is already there (the Browse tab's second click). */
  function toggleBook(work: { id: string; title: string; author?: string; coverId: string }) {
    const at = board.slots.findIndex((s) => s?.workId === work.id);
    let next: Board;
    if (at >= 0) {
      next = remove(board, at);
    } else {
      const free = target >= 0 && !board.slots[target] ? target : firstEmpty(board);
      if (free < 0) {
        setWin(null);
        return;
      }
      next = place(board, free, { workId: work.id, coverId: work.coverId });
      setNames((n) => ({ ...n, [work.id]: { title: work.title, author: work.author } }));
    }
    setBoard(next);
    const empty = firstEmpty(next);
    setTarget(empty);
    // The window stays for the next book until the board is full: nine books are nine searches, not nine openings.
    if (empty < 0) setWin(null);
  }

  function openCovers(index: number) {
    const slot = board.slots[index];
    if (!slot) return;
    setWin({ kind: 'covers', index });
    if (covers?.workId === slot.workId && covers.state === 'done') return;
    const workId = slot.workId;
    setCovers({ workId, state: 'loading' });
    fetch(`/api/inspiration/covers/${workId}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as (WorkCovers & { error?: string }) | null;
        if (!r.ok || !body) throw new Error(body?.error ?? 'Open Library did not answer. Try again in a moment.');
        return body;
      })
      // The reader may have opened another book's covers while Open Library answered.
      .then((data) => setCovers((c) => (c?.workId === workId ? { workId, state: 'done', data } : c)))
      .catch((err: unknown) => setCovers((c) => (c?.workId === workId ? { workId, state: 'failed', message: err instanceof Error ? err.message : 'Open Library did not answer. Try again in a moment.' } : c)));
  }

  async function finish() {
    setLink({ busy: true, note: '' });
    try {
      const res = await fetch('/api/inspiration/link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: boardQuery(board) }) });
      const body = (await res.json().catch(() => null)) as { path?: string; error?: string } | null;
      if (!res.ok || !body?.path) throw new Error(body?.error ?? 'The link could not be made. Try again in a moment.');
      router.push(body.path);
    } catch (err) {
      setLink({ busy: false, note: err instanceof Error ? err.message : 'The link could not be made. Try again in a moment.' });
    }
  }

  const coversSlot = win?.kind === 'covers' ? board.slots[win.index] : null;

  return (
    <>
      {/* The band: where the board stands and the way out, kept in sight — at the top on a wide screen, at the thumb on a phone. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-accent bg-ink text-bg sm:sticky sm:bottom-auto sm:top-14 sm:z-10 sm:border-t-0">
        <div className="mx-auto flex min-h-12 max-w-5xl items-center gap-4 px-4 py-2 sm:px-6 lg:px-8">
          <span className="text-[11px] uppercase tracking-[0.14em] text-bg/70">Your board</span>
          <span className="flex-1 font-display text-lg sm:text-xl" role="status">
            {link.busy ? 'Making the link…' : filled === SLOTS ? 'Nine. Done.' : `${filled} of 9`}
          </span>
          <button type="button" onClick={finish} disabled={filled === 0 || link.busy} className="rounded-full bg-bg px-4 py-0.5 text-sm text-ink hover:bg-surface disabled:opacity-40">
            Done — share it
          </button>
        </div>
      </div>

      {/*
        On a wide screen the words stand beside the board, which is 27rem wide: at 1280 × 800 the first
        two rows and the top of the third are in view (the board ends 120 px below the fold — narrower
        covers would not hold four tools). On a phone the two stack.
      */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-8 sm:px-6 sm:pb-24 lg:grid lg:grid-cols-[minmax(0,1fr)_27rem] lg:items-start lg:gap-x-16 lg:px-8">
        <div className="max-w-xl lg:sticky lg:top-32">
          <h1 className="text-3xl leading-tight text-ink sm:text-4xl">The books that inspired me</h1>
          <p className="mt-3 text-base text-ink-2">Nine books that changed how you see things — in the editions you read them in. Pick them, then share the picture.</p>
          {link.note && <p className="mt-3 text-sm text-accent" role="alert">{link.note}</p>}

          <input
            value={nameDraft}
            maxLength={NAME_MAX}
            placeholder="Your name or handle (optional)"
            aria-label="Your name or handle, shown on the picture"
            onChange={(e) => {
              setNameDraft(e.target.value);
              setBoard((b) => ({ ...b, by: cleanName(e.target.value) }));
            }}
            className="mt-5 block w-full max-w-sm rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-3"
          />
        </div>

        <section className="mt-6 max-w-xl lg:mt-0" aria-label="Your nine books">
            {/* Said in words, not only in a tile's `title`: a tooltip never shows on a touch screen (Arrange learnt this on 2026-10-04). */}
            <p className="text-sm text-ink-2">
              {filled === 0 ? (
                'Tap or click a + to add your first book.'
              ) : (
                <>
                  <span className="sm:hidden">Tap a cover to pick the edition you read. Drag ⠿ to move it.</span>
                  <span className="hidden sm:inline">Click a cover to pick the edition you read. Drag a cover to move it.</span>
                </>
              )}
            </p>
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
              {board.slots.map((slot, i) => {
                if (!slot) {
                  return (
                    <li key={i} data-index={i}>
                      <button
                        type="button"
                        aria-label={`Add a book in place ${i + 1}`}
                        onClick={() => openAdd(i)}
                        className={`flex aspect-[2/3] w-full items-center justify-center rounded-card border border-dashed text-3xl font-light text-ink-3 transition-colors hover:border-accent hover:text-accent ${drag?.over === i && drag.from !== i ? 'border-accent ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'border-line'}`}
                      >
                        +
                      </button>
                      <span className="mt-1.5 block h-9 sm:h-8" />
                    </li>
                  );
                }
                const src = coverUrlFor(slot.coverId, 'M');
                const name = nameOf(slot.workId);
                const lifted = drag !== null && drag.over !== null && drag.from === i;
                const over = drag !== null && drag.over === i && drag.from !== i;
                return (
                  <li key={i} data-index={i} className={lifted ? 'opacity-40' : ''}>
                    <button
                      type="button"
                      aria-label={`${name} — pick the edition you read`}
                      title="Click for the edition you read, drag to move it"
                      className={`cover-shadow relative block aspect-[2/3] w-full cursor-grab select-none overflow-hidden rounded-card border-0 bg-surface-2 p-0 ${over ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}
                      onPointerDown={(e) => {
                        // Every press starts clean: a drag whose click never came must not swallow the next tap.
                        press.current = null;
                        if (e.pointerType === 'mouse') pickUp(e, i);
                      }}
                      onClick={() => !press.current?.moved && openCovers(i)}
                      // The browser's own image drag would cancel the pointer events.
                      onDragStart={(e) => e.preventDefault()}
                      {...handlers}
                    >
                      {src && <CoverImage src={src} alt={names[slot.workId]?.title ?? ''} sizes="(max-width: 640px) 33vw, 190px" />}
                    </button>
                    {/* On a phone only the grip and ✕: four buttons do not fit under a 109 px cover. The arrows stay for a wide screen and the keyboard. */}
                    <span className="mt-1.5 flex items-center justify-around sm:justify-between">
                      <ToolButton label={`Move ${name} left`} hidden={i === 0} wide onClick={() => setBoard((b) => swap(b, i, i - 1))}>←</ToolButton>
                      <button
                        type="button"
                        aria-label={`Drag ${name} to another place`}
                        title="Drag to another place"
                        onPointerDown={(e) => pickUp(e, i)}
                        {...handlers}
                        className="h-9 w-9 cursor-grab touch-none rounded-full text-lg text-ink-3 hover:text-accent sm:h-8 sm:w-8"
                      >
                        ⠿
                      </button>
                      <ToolButton label={`Take ${name} out`} onClick={() => setBoard((b) => remove(b, i))}>✕</ToolButton>
                      <ToolButton label={`Move ${name} right`} hidden={i === SLOTS - 1} wide onClick={() => setBoard((b) => swap(b, i, i + 1))}>→</ToolButton>
                    </span>
                  </li>
                );
              })}
            </ul>
        </section>
      </main>

      {win?.kind === 'add' && (
        <Sheet
          kicker={`Book ${Math.min(filled + 1, SLOTS)} of 9`}
          title="Add a book"
          sub="Search for a book or browse a list. A click puts it on your board; you pick the edition afterwards."
          onClose={() => setWin(null)}
        >
          {/* The board in small: the window covers the real one. */}
          <div className="flex gap-1" aria-hidden="true">
            {board.slots.map((s, i) => {
              const src = s ? coverUrlFor(s.coverId, 'S') : null;
              return (
                <span key={i} className={`relative h-[42px] w-7 shrink-0 overflow-hidden rounded-[2px] bg-surface-2 ${i === target ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : ''}`}>
                  {src && <CoverImage src={src} alt="" sizes="28px" />}
                </span>
              );
            })}
          </div>
          <div className="mt-3 flex gap-1.5" role="tablist" aria-label="How to find a book">
            <button type="button" role="tab" aria-selected={addTab === 'search'} onClick={() => showTab('search')} className={pill(addTab === 'search')}>Search</button>
            <button type="button" role="tab" aria-selected={addTab === 'browse'} onClick={() => showTab('browse')} className={pill(addTab === 'browse')}>Browse</button>
          </div>
          {/* Both stay mounted: a search typed and a place in a list survive the other tab. */}
          <div hidden={addTab !== 'search'} className="mt-3">
            <SearchPane active={addTab === 'search'} onPick={toggleBook} />
          </div>
          <div hidden={addTab !== 'browse'} className="mt-3">
            <BrowsePane lists={lists} board={board} onPick={toggleBook} onRetry={loadLists} />
          </div>
        </Sheet>
      )}

      {win?.kind === 'covers' && coversSlot && (
        <Sheet
          kicker="The edition I read"
          title={[names[coversSlot.workId]?.title, names[coversSlot.workId]?.author].filter(Boolean).join(' · ') || 'This book'}
          // Julian's wording, 2026-10-05: the cover one loves counts as much as the printing one held.
          sub="Pick the cover of the edition you read or the one you love the most: it takes the place of the marked one on your board."
          onClose={() => setWin(null)}
        >
          <CoversPane
            covers={covers?.workId === coversSlot.workId ? covers : null}
            current={coversSlot.coverId}
            onPick={(coverId) => {
              const index = win.index;
              setBoard((b) => setCover(b, index, coverId));
              setWin(null);
            }}
          />
        </Sheet>
      )}
    </>
  );
}

function ToolButton({ label, hidden, wide, onClick, children }: { label: string; hidden?: boolean; wide?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`h-9 w-9 rounded-full border border-line bg-surface text-sm text-ink-2 hover:border-accent hover:text-accent sm:h-8 sm:w-8 ${wide ? 'hidden sm:inline-block' : ''} ${hidden ? 'invisible' : ''}`}
    >
      {children}
    </button>
  );
}

/**
 * The window over the board: a pop-up on a wide screen (the editor's cover
 * window), a sheet from the bottom on a phone (`CollectionSheet`). Escape and
 * the backdrop close it, the page behind does not scroll, focus goes in and
 * comes back.
 */
function Sheet({ kicker, title, sub, onClose, children }: { kicker: string; title: string; sub: string; onClose: () => void; children: React.ReactNode }) {
  const closer = useRef<HTMLButtonElement>(null);
  // Where the focus was when the window opened — read before a field inside takes it.
  const [opener] = useState(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)));
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    // A field inside takes the focus where there is one (the search); otherwise Close does.
    if (!closer.current?.closest('[role="dialog"]')?.contains(document.activeElement)) closer.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      opener?.focus?.();
    };
  }, [opener]);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 sm:flex sm:items-start sm:justify-center sm:overflow-y-auto sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-x-0 bottom-0 top-12 flex flex-col rounded-t-2xl bg-bg shadow-2xl sm:static sm:w-full sm:max-w-4xl sm:rounded-lg sm:border sm:border-line sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 sm:border-0 sm:p-0">
          <div className="min-w-0">
            <p className="kicker">{kicker}</p>
            <h2 className="font-display text-2xl text-ink">{title}</h2>
            <p className="mt-1 text-sm text-ink-2">{sub}</p>
          </div>
          <button ref={closer} type="button" onClick={onClose} className="shrink-0 rounded-full border border-line px-3 py-1 text-sm text-ink-2 hover:border-accent hover:text-accent">
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4 sm:mt-4 sm:overflow-visible sm:p-0">{children}</div>
      </div>
    </div>
  );
}

function SearchPane({ active, onPick }: { active: boolean; onPick: (work: { id: string; title: string; author?: string; coverId: string }) => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<Found>({ state: 'idle' });
  const [placed, setPlaced] = useState('');
  const run = useRef(0);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (active) field.current?.focus();
  }, [active]);

  async function search() {
    const query = q.trim();
    if (query.length < 3) return;
    const mine = ++run.current;
    setPlaced('');
    setFound({ state: 'loading' });
    const started = performance.now();
    // Open Library takes half a second for most searches and twelve for some; say so before the reader thinks it hangs.
    const slow = setTimeout(() => run.current === mine && setFound({ state: 'slow' }), 3000);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const body = (await res.json().catch(() => null)) as (SearchResult & { error?: string }) | null;
      if (run.current !== mine) return;
      // A source that did not answer is not "no books" (SPEC N12).
      if (!res.ok || !body) throw new Error(res.status === 503 ? 'Open Library did not answer. Try again in a moment.' : body?.error ?? 'The search did not answer. Try again in a moment.');
      const hits = body.works.slice(0, 12).map((w) => ({
        id: w.id,
        title: w.title,
        author: w.authors[0],
        year: w.firstPublishYear,
        // The work's best-known cover is the default; the edition is a second step.
        coverId: w.coverUrls.map((u) => coverRefFromUrl(u)?.coverId).find((id) => id?.startsWith('ol:')) ?? null,
      }));
      setFound({ state: 'done', hits, seconds: (performance.now() - started) / 1000 });
    } catch (err) {
      if (run.current === mine) setFound({ state: 'failed', message: err instanceof Error ? err.message : 'The search did not answer. Try again in a moment.' });
    } finally {
      clearTimeout(slow);
    }
  }

  return (
    <>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          ref={field}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a title or author"
          aria-label="Search a title or author"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-3"
        />
        <button type="submit" className="btn btn-accent">Search</button>
      </form>
      <p className="mt-2 min-h-5 text-sm text-ink-2" role="status">
        {placed ||
          (found.state === 'loading' ? 'Looking…'
            : found.state === 'slow' ? 'Still looking — Open Library can take a while.'
            : found.state === 'failed' ? found.message
            : found.state === 'done' && found.hits.length === 0 ? 'Open Library knows no book by that.'
            : found.state === 'done' ? `${found.seconds.toFixed(1)} s`
            : '')}
      </p>
      {found.state === 'done' && (
        <ul className="mt-1 grid gap-x-6 sm:grid-cols-2">
          {found.hits.map((w) => {
            const src = w.coverId ? coverUrlFor(w.coverId, 'S') : null;
            const meta = [w.author, w.year].filter(Boolean).join(', ');
            return (
              <li key={w.id} className="border-b border-line">
                <button
                  type="button"
                  disabled={!w.coverId}
                  onClick={() => {
                    if (!w.coverId) return;
                    onPick({ id: w.id, title: w.title, author: w.author, coverId: w.coverId });
                    setPlaced(`${w.title} is on your board.`);
                    setFound({ state: 'idle' });
                    setQ('');
                    field.current?.focus();
                  }}
                  className="flex w-full items-center gap-3 py-1.5 text-left hover:text-accent disabled:opacity-60 disabled:hover:text-ink"
                >
                  <span className="relative h-[60px] w-10 shrink-0 overflow-hidden rounded-[2px] bg-surface-2">{src && <CoverImage src={src} alt="" sizes="40px" />}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-base text-ink">{w.title}</span>
                    <span className="block truncate text-sm text-ink-3">{meta}{w.coverId ? '' : `${meta ? ' — ' : ''}no cover on record`}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function BrowsePane({ lists, board, onPick, onRetry }: { lists: Lists; board: Board; onPick: (work: BrowseWork) => void; onRetry: () => void }) {
  const [listId, setListId] = useState<BrowseList['id']>('curated');
  const [filter, setFilter] = useState('');
  // How many rows are drawn, per list and filter: a new key starts at the first chunk without an effect.
  const [more, setMore] = useState<{ key: string; count: number }>({ key: '', count: CHUNK });
  const sentinel = useRef<HTMLDivElement>(null);

  const list = lists.state === 'done' ? lists.lists.find((l) => l.id === listId) ?? lists.lists[0] : null;
  const needle = plain(filter.trim());
  const rows = list ? (needle ? list.works.filter((w) => plain(`${w.title} ${w.author}`).includes(needle)) : list.works) : [];
  const key = `${list?.id ?? ''}|${needle}`;
  const count = more.key === key ? more.count : CHUNK;
  const total = rows.length;

  // The next rows come on their own when the end of the list scrolls into view; the button is for where that does not fire.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || count >= total) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setMore({ key, count: count + CHUNK }), { rootMargin: '600px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [key, count, total]);

  if (lists.state === 'failed') {
    return (
      <p className="text-sm text-ink-2" role="status">
        The lists did not load.{' '}
        <button type="button" onClick={onRetry} className="text-accent underline underline-offset-4">Try again</button>
      </p>
    );
  }
  if (!list) return <p className="text-sm text-ink-2" role="status">Loading the lists…</p>;

  const onBoard = new Set(board.slots.flatMap((s) => (s ? [s.workId] : [])));
  const n = total.toLocaleString('en');
  return (
    <>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Which list">
        {lists.state === 'done' && lists.lists.map((l) => (
          <button key={l.id} type="button" role="tab" aria-selected={l.id === list.id} onClick={() => setListId(l.id)} className={pill(l.id === list.id)}>
            {LIST_LABELS[l.id]}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by title or author"
        aria-label="Filter the list by title or author"
        autoComplete="off"
        className="mt-3 block w-full rounded-md border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-3"
      />
      <p className="mt-2 text-sm text-ink-2" role="status">
        {needle
          ? total > 0 ? `${n} of ${list.works.length.toLocaleString('en')} match.` : 'Nothing in this list matches. The Search tab asks Open Library’s whole catalogue.'
          : list.id === 'curated' ? `${n} books the site picked a cover for by eye.`
          : `${n} works Open Library’s readers marked as read most often, most read first${list.builtAt ? ` (list of ${list.builtAt})` : ''}.`}
      </p>
      <ul className="mt-3 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6 sm:gap-x-3">
        {rows.slice(0, count).map((w) => {
          const src = coverUrlFor(w.coverId, 'M');
          const on = onBoard.has(w.id);
          return (
            <li key={w.id}>
              <button type="button" aria-label={`${w.title} by ${w.author}${on ? ' — on your board, click to take it out' : ''}`} onClick={() => onPick(w)} className="block w-full text-left">
                <span className={`cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 ${on ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}>
                  {src && <CoverImage src={src} alt="" sizes="(max-width: 640px) 33vw, 140px" />}
                  {on && <span className="absolute left-1 top-1 rounded-full bg-accent px-1.5 text-[10px] text-on-accent">on your board</span>}
                </span>
                <span className="mt-1.5 block break-words text-xs leading-snug text-ink-3">{w.title} · {w.author}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {count < total && (
        <div ref={sentinel} className="mt-4 text-center">
          <button type="button" onClick={() => setMore({ key, count: count + CHUNK })} className="btn">Show more</button>
        </div>
      )}
    </>
  );
}

function CoversPane({ covers, current, onPick }: { covers: Covers | null; current: string; onPick: (coverId: string) => void }) {
  if (!covers || covers.state === 'loading') return <p className="text-sm text-ink-2" role="status">Looking for the other editions…</p>;
  if (covers.state === 'failed') return <p className="text-sm text-accent" role="alert">{covers.message}</p>;
  const { covers: list, checked, total } = covers.data;
  return (
    <>
      <p className="text-sm text-ink-2" role="status">
        {list.length === 0
          ? 'Open Library has no other cover on record for this book.'
          : `${list.length} ${list.length === 1 ? 'cover' : 'covers'} from ${total > checked ? `the first ${checked} of ${total.toLocaleString('en')}` : checked} editions on record at Open Library, newest first.`}
      </p>
      <ul className="mt-3 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-6 sm:gap-x-3">
        {list.map((c) => {
          // M, not S: an S scan is about 40 px wide — too blurred to tell one printing from the next.
          const src = coverUrlFor(c.coverId, 'M');
          // Under the cover, not in a tooltip: a phone shows no tooltip, and year and publisher are how one tells printings apart.
          const caption = [c.year, c.publisher].filter(Boolean).join(' · ');
          const on = c.coverId === current;
          return (
            <li key={c.coverId}>
              <button type="button" aria-label={caption ? `The cover of ${caption}` : 'A cover with no year on record'} onClick={() => onPick(c.coverId)} className="block w-full text-left">
                <span className={`cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 ${on ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}>
                  {src && <CoverImage src={src} alt="" sizes="(max-width: 640px) 33vw, 140px" />}
                  {on && <span className="absolute left-1 top-1 rounded-full bg-accent px-1.5 text-[10px] text-on-accent">on your board</span>}
                </span>
                <span className="mt-1.5 block break-words text-xs leading-snug text-ink-3">{caption || 'no year on record'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
