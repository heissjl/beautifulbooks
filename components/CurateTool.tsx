'use client';

import { useRef, useState } from 'react';
import CoverImage from './CoverImage';
import { olCover } from '@/lib/curated';
import type { Candidate } from '@/lib/collectionedit';
import type { Draft } from '@/lib/curate/drafts';
import type { FoundAuthor } from '@/lib/curate/catalog';

/** A collection in the site's file that a friend can start a draft from. */
export interface StartingPoint {
  slug: string;
  title: string;
  works: number;
}

interface CoverChoice {
  id: string;
  year?: number;
  publisher?: string;
}

interface Picking {
  work: { id: string; title: string; author: string; firstPublished?: number };
  chosen?: string;
  covers: CoverChoice[];
  next: number | null;
  loading: boolean;
  error: string;
  /** Editions looked through so far, and how many there are to look through. */
  scanned: number;
  total: number | null;
  capped: boolean;
}

const field = 'w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-accent focus:outline-none';
const button = 'rounded-md border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50';
const heading = 'text-xs font-semibold uppercase tracking-wider text-ink-3';

const coverNumber = (id: string) => Number(id.slice(3));

async function call<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? {} : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401) throw new Error('You were signed out. Reload the page and enter the password again.');
  if (res.status === 429) throw new Error('Too many requests. Wait a minute.');
  if (!res.ok) throw new Error(data.error ?? 'That did not work.');
  return data;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * The collection curation tool, online for friends (ROADMAP 5.10b, SPEC
 * F8.5): the same steps as Julian's `lab/collections/`, working on drafts in
 * the site's store. A draft never changes a page; Julian takes it over.
 */
export default function CurateTool({ initialDrafts, startingPoints, initialId, admin = false }: {
  initialDrafts: Draft[];
  startingPoints: StartingPoint[];
  initialId?: string;
  /** Julian signed in as admin: he may publish a draft on the site (5.10g). */
  admin?: boolean;
}) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [currentId, setCurrentId] = useState<string | null>(
    initialDrafts.some(d => d.id === initialId) ? (initialId ?? null) : null,
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [creating, setCreating] = useState({ title: '', kind: 'authors', by: '', from: '' });
  const [authorQuery, setAuthorQuery] = useState('');
  const [found, setFound] = useState<FoundAuthor[] | null>(null);
  const [publisher, setPublisher] = useState('');
  const [candidates, setCandidates] = useState<Record<string, Candidate[] | 'loading' | { error: string }>>({});
  const [picking, setPicking] = useState<Picking | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  // Which work the cover window is searching for; read only in handlers, so the
  // background search stops when the window closes or another book opens.
  const searching = useRef<string | null>(null);

  const draft = drafts.find(d => d.id === currentId) ?? null;

  function open(id: string | null) {
    setCurrentId(id);
    setFound(null);
    setError('');
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('d', id);
    else url.searchParams.delete('d');
    window.history.replaceState(null, '', url);
  }

  function take(next: Draft) {
    setDrafts(prev => (prev.some(d => d.id === next.id) ? prev.map(d => (d.id === next.id ? next : d)) : [next, ...prev]));
    setSaved(`Saved ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`);
  }

  async function change(op: Record<string, unknown>) {
    if (!draft) return;
    setError('');
    try {
      const { draft: next } = await call<{ draft: Draft }>(`/api/curate/drafts/${draft.id}`, op);
      if (next.deleted) {
        setDrafts(prev => prev.filter(d => d.id !== next.id));
        open(null);
        return;
      }
      take(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not saved.');
    }
  }

  async function refresh() {
    setError('');
    try {
      setDrafts((await call<{ drafts: Draft[] }>('/api/curate/drafts')).drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the drafts.');
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const { draft: d } = await call<{ draft: Draft }>('/api/curate/drafts', {
        title: creating.title,
        kind: creating.kind,
        by: creating.by,
        ...(creating.from ? { from: creating.from } : {}),
      });
      take(d);
      open(d.id);
      setCreating(c => ({ ...c, title: '', from: '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not created.');
    }
  }

  async function findAuthor(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setFound(null);
    try {
      setFound((await call<{ found: FoundAuthor[] }>(`/api/curate/find-author?q=${encodeURIComponent(authorQuery)}`)).found);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The search did not answer.');
    }
  }

  async function loadCandidates(source: string) {
    if (!draft) return;
    const key = `${draft.id}|${source}`;
    const have = candidates[key];
    if (Array.isArray(have) || have === 'loading') return;
    setCandidates(c => ({ ...c, [key]: 'loading' }));
    try {
      const { candidates: list } = await call<{ candidates: Candidate[] }>(
        `/api/curate/candidates?draft=${draft.id}&source=${encodeURIComponent(source)}`,
      );
      setCandidates(c => ({ ...c, [key]: list }));
    } catch (e) {
      // A failure is said as one, and the next open asks again (N12).
      setCandidates(c => ({ ...c, [key]: { error: e instanceof Error ? e.message : 'Open Library did not answer.' } }));
    }
  }

  /**
   * Looks through a book's editions a hundred at a time and keeps going by
   * itself until the last page (Julian, 2026-09-25: „show me a progress
   * whether the site is still looking for more covers or whether it has ended
   * the search"). A page that fails stops the search and says so; „Try again"
   * resumes where it stopped.
   */
  async function loadCovers(p: Picking, offset: number) {
    if (!draft) return;
    const workId = p.work.id;
    searching.current = workId;
    let state: Picking = { ...p, loading: true, error: '' };
    setPicking(state);
    let at: number | null = offset;
    while (at !== null) {
      try {
        const body: { covers: CoverChoice[]; next: number | null; scanned: number; total: number; capped: boolean } = await call(
          `/api/curate/covers?draft=${draft.id}&work=${workId}&offset=${at}`,
        );
        if (searching.current !== workId) return; // closed, or another book opened
        const known = new Set(state.covers.map(c => c.id));
        state = {
          ...state,
          covers: [...state.covers, ...body.covers.filter(c => !known.has(c.id))],
          next: body.next,
          scanned: body.scanned,
          total: body.total,
          capped: body.capped,
          loading: body.next !== null,
        };
        setPicking(state);
        at = body.next;
      } catch (e) {
        if (searching.current !== workId) return;
        setPicking({ ...state, loading: false, error: e instanceof Error ? e.message : 'The covers did not load.' });
        return;
      }
    }
  }

  function startPicking(work: Picking['work'], chosen?: string) {
    const p: Picking = { work, chosen, covers: [], next: 0, loading: true, error: '', scanned: 0, total: null, capped: false };
    setPicking(p);
    void loadCovers(p, 0);
  }

  function closePicking() {
    searching.current = null;
    setPicking(null);
  }

  async function choose(coverId: string) {
    if (!picking) return;
    const { work } = picking;
    closePicking();
    await change({ op: 'pick', ...work, coverId });
  }

  function move(id: string, by: number) {
    if (!draft) return;
    const ids = draft.works.map(w => w.id);
    const at = ids.indexOf(id);
    const to = Math.max(0, Math.min(ids.length - 1, at + by));
    ids.splice(at, 1);
    ids.splice(to, 0, id);
    void change({ op: 'order', ids });
  }

  function drop(onto: string) {
    if (!draft || !drag || drag === onto) return;
    const ids = draft.works.map(w => w.id).filter(id => id !== drag);
    ids.splice(ids.indexOf(onto), 0, drag);
    setDrag(null);
    void change({ op: 'order', ids });
  }

  const sources = draft ? (draft.kind === 'authors' ? (draft.authors ?? []).map(a => a.name) : (draft.publishers ?? [])) : [];
  const onWall = new Set(draft?.works.map(w => w.id));

  return (
    <div className="space-y-10">
      {error && <p className="rounded-md border border-accent/40 px-3 py-2 text-sm text-accent" role="alert">{error}</p>}

      {!draft && (
        <>
          <section>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl text-ink">Drafts</h2>
              <button type="button" onClick={refresh} className={button}>Refresh</button>
            </div>
            {drafts.length === 0 && <p className="mt-3 text-sm text-ink-3">No drafts yet. Start one below.</p>}
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {drafts.map(d => (
                <li key={d.id}>
                  <button type="button" onClick={() => open(d.id)} className="flex w-full gap-3 rounded-md border border-line p-3 text-left transition-colors hover:border-accent">
                    <span className="flex shrink-0 gap-1">
                      {d.works.slice(0, 3).map(w => (
                        <span key={w.id} className="relative block aspect-[2/3] w-9 overflow-hidden rounded bg-surface-2">
                          <CoverImage src={olCover(coverNumber(w.coverId), 'S')} alt="" sizes="36px" />
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{d.title}</span>
                      <span className="block text-xs text-ink-3">
                        {d.works.length} {d.works.length === 1 ? 'book' : 'books'}
                        {d.by ? ` · by ${d.by}` : ''} · {when(d.updatedAt)}
                        {d.importedOn ? ' · taken over by Julian' : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="max-w-xl">
            <h2 className="font-display text-2xl text-ink">Start a collection</h2>
            <form onSubmit={create} className="mt-4 space-y-3">
              <select value={creating.from} onChange={e => setCreating(c => ({ ...c, from: e.target.value }))} className={field}>
                <option value="">A new collection</option>
                {startingPoints.map(p => (
                  <option key={p.slug} value={p.slug}>Continue “{p.title}” ({p.works} books)</option>
                ))}
              </select>
              {!creating.from && (
                <>
                  <input value={creating.title} onChange={e => setCreating(c => ({ ...c, title: e.target.value }))} maxLength={120} placeholder="Title, e.g. Penguin Modern Classics" className={field} />
                  <div className="flex gap-4 text-sm text-ink-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={creating.kind === 'authors'} onChange={() => setCreating(c => ({ ...c, kind: 'authors' }))} /> Books by a list of authors
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={creating.kind === 'series'} onChange={() => setCreating(c => ({ ...c, kind: 'series' }))} /> A publisher&rsquo;s series
                    </label>
                  </div>
                </>
              )}
              <input value={creating.by} onChange={e => setCreating(c => ({ ...c, by: e.target.value }))} maxLength={60} placeholder="Your name, so Julian knows who to thank (optional)" className={field} />
              <button type="submit" disabled={!creating.from && !creating.title.trim()} className={button}>Start</button>
            </form>
          </section>
        </>
      )}

      {draft && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => open(null)} className="text-sm text-ink-2 hover:text-accent">← All drafts</button>
            <span className="text-xs text-ink-3">{saved}</span>
            {draft.importedOn && <span className="text-xs text-accent">Taken over by Julian on {draft.importedOn}; later changes are not on the site.</span>}
          </div>

          <section className="max-w-2xl space-y-3">
            <h2 className={heading}>Page</h2>
            <input key={`t-${draft.id}-${draft.updatedAt}`} defaultValue={draft.title} maxLength={120} onBlur={e => e.target.value !== draft.title && change({ op: 'meta', title: e.target.value })} className={`${field} font-display text-xl`} aria-label="Title" />
            <textarea key={`i-${draft.id}-${draft.updatedAt}`} defaultValue={draft.intro} maxLength={1200} rows={3} onBlur={e => e.target.value !== draft.intro && change({ op: 'meta', intro: e.target.value })} placeholder="A paragraph for the page: what holds these books together?" className={field} aria-label="Introduction" />
            <input key={`b-${draft.id}-${draft.updatedAt}`} defaultValue={draft.by ?? ''} maxLength={60} onBlur={e => e.target.value !== (draft.by ?? '') && change({ op: 'meta', by: e.target.value })} placeholder="Your name (optional)" className={field} aria-label="Your name" />
          </section>

          <section>
            <h2 className={heading}>{draft.kind === 'authors' ? `Authors (${sources.length})` : `Publisher spellings (${sources.length})`}</h2>
            <p className="mt-1 text-xs text-ink-3">
              {draft.kind === 'authors'
                ? 'Only books whose first author is on this list can go on the wall. Removing an author takes their books off it.'
                : 'Only covers of editions filed under exactly one of these names, as Open Library spells them.'}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {sources.map(name => (
                <li key={name} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2">
                  {name}
                  <button type="button" aria-label={`Remove ${name}`} className="px-1 text-ink-3 hover:text-accent" onClick={() => {
                    const n = draft.works.filter(w => w.author === name).length;
                    if (n && !window.confirm(`Remove ${name}? ${n} book(s) leave the wall with them.`)) return;
                    void change(draft.kind === 'authors' ? { op: 'removeAuthor', name } : { op: 'removePublisher', name });
                  }}>×</button>
                </li>
              ))}
            </ul>
            {draft.kind === 'authors' ? (
              <>
                <form onSubmit={findAuthor} className="mt-3 flex max-w-md gap-2">
                  <input value={authorQuery} onChange={e => setAuthorQuery(e.target.value)} placeholder="Add an author, e.g. Virginia Woolf" className={field} />
                  <button type="submit" className={button}>Find</button>
                </form>
                {found && (
                  <ul className="mt-2 max-w-2xl divide-y divide-line text-sm">
                    {found.length === 0 && <li className="py-2 text-ink-3">Open Library knows nobody by that name.</li>}
                    {found.map(a => (
                      <li key={a.key} className="flex items-center gap-3 py-2">
                        <span className="min-w-0 flex-1">
                          <b className="font-medium text-ink">{a.name}</b>{' '}
                          <span className="text-xs text-ink-3">{a.works} works{a.topWork ? ` · ${a.topWork}` : ''}{a.born ? ` · born ${a.born}` : ''}</span>
                        </span>
                        <button type="button" className={button} onClick={() => { setFound(null); setAuthorQuery(''); void change({ op: 'addAuthor', name: a.name, key: a.key }); }}>Add</button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <form onSubmit={e => { e.preventDefault(); void change({ op: 'addPublisher', name: publisher }); setPublisher(''); }} className="mt-3 flex max-w-md gap-2">
                <input value={publisher} onChange={e => setPublisher(e.target.value)} placeholder="e.g. Penguin Classics" className={field} />
                <button type="submit" className={button}>Add</button>
              </form>
            )}
          </section>

          <section>
            <h2 className={heading}>Wall ({draft.works.length})</h2>
            <p className="mt-1 text-xs text-ink-3">Drag or use the arrows to reorder; the order here is the order on the page. Tap a cover to change it, × to remove the book.</p>
            {draft.works.length === 0 && <p className="mt-3 text-sm text-ink-3">Nothing on the wall yet. Open an author below and pick a book.</p>}
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
              {draft.works.map((w, i) => (
                <li
                  key={w.id}
                  draggable
                  onDragStart={() => setDrag(w.id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => drop(w.id)}
                  className={`relative ${drag === w.id ? 'opacity-40' : ''}`}
                >
                  <button type="button" onClick={() => startPicking(w, w.coverId)} className="block w-full text-left">
                    <span className="cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2">
                      <CoverImage src={olCover(coverNumber(w.coverId), 'M')} alt={`${w.title} by ${w.author}`} sizes="(max-width: 640px) 33vw, 16vw" />
                    </span>
                  </button>
                  {/* Taking a book off the wall, where the eye already is (Julian, 2026-09-25: „i also need a button to delete a work"). */}
                  <button
                    type="button"
                    onClick={() => change({ op: 'remove', id: w.id })}
                    aria-label={`Remove ${w.title} from the collection`}
                    title="Remove from the collection"
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-bg/90 text-base leading-none text-ink shadow transition-colors hover:bg-accent hover:text-on-accent"
                  >
                    ×
                  </button>
                  <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug text-ink">{w.title}</p>
                  <p className="line-clamp-1 text-xs text-ink-3">{w.author}</p>
                  <div className="mt-1 flex gap-1 text-xs text-ink-3">
                    <button type="button" disabled={i === 0} onClick={() => move(w.id, -1)} aria-label="Move earlier" className="rounded px-1.5 hover:text-accent disabled:opacity-30">←</button>
                    <button type="button" disabled={i === draft.works.length - 1} onClick={() => move(w.id, 1)} aria-label="Move later" className="rounded px-1.5 hover:text-accent disabled:opacity-30">→</button>
                    <button type="button" onClick={() => change({ op: 'remove', id: w.id })} aria-label={`Remove ${w.title} from the collection`} className="ml-auto rounded px-1.5 hover:text-accent">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className={heading}>Books to choose from</h2>
            <p className="mt-1 text-xs text-ink-3">The most-printed works at Open Library. Open a name to list them; tap a book to see its covers.</p>
            <div className="mt-3 space-y-2">
              {sources.map(source => {
                const list = candidates[`${draft.id}|${source}`];
                return (
                  <details key={source} className="rounded-md border border-line bg-surface" onToggle={e => (e.currentTarget as HTMLDetailsElement).open && loadCandidates(source)}>
                    <summary className="cursor-pointer px-3 py-2 font-medium text-ink">{source}</summary>
                    <div className="px-3 pb-3">
                      {list === undefined || list === 'loading' ? (
                        <p className="text-sm text-ink-3">Loading…</p>
                      ) : 'error' in list ? (
                        <p className="text-sm text-accent">{list.error} Close and open again to retry.</p>
                      ) : list.length === 0 ? (
                        <p className="text-sm text-ink-3">No works found with this name as first author.</p>
                      ) : (
                        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                          {list.map(c => (
                            <li key={c.id}>
                              <button type="button" onClick={() => startPicking(c, draft.works.find(w => w.id === c.id)?.coverId)} className="flex w-full items-center gap-2 rounded p-1 text-left hover:bg-bg">
                                <span className="relative block aspect-[2/3] w-8 shrink-0 overflow-hidden rounded bg-surface-2">
                                  {c.coverId && <CoverImage src={olCover(coverNumber(c.coverId), 'S')} alt="" sizes="32px" />}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm text-ink">{c.title}{onWall.has(c.id) && <span className="text-accent"> ✓</span>}</span>
                                  <span className="block text-xs text-ink-3">{c.firstPublished ?? '?'} · {c.editions} editions{draft.kind === 'series' && c.author ? ` · ${c.author}` : ''}</span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </section>

          {/*
            Julian only (5.10g): the draft goes on the site as it is — covers,
            order, text — in place of the collection at the same address.
          */}
          {admin && (
            <section className="max-w-2xl rounded-md border border-accent/40 p-4">
              <h2 className={heading}>Publish · admin</h2>
              <p className="mt-1 text-sm text-ink-2">
                Puts this draft on the site now, at /collections/{draft.slug}
                {startingPoints.some(p => p.slug === draft.slug) ? ', in place of the collection there' : ', as a new collection'}. No deploy needed.
                {draft.publishedOn ? ` Last published ${when(draft.publishedOn)}.` : ''}
              </p>
              <button
                type="button"
                className={`${button} mt-3`}
                onClick={() => window.confirm(`Publish the draft “${draft.title}” (${draft.works.length} books) on the site now?`) && change({ op: 'publish' })}
              >
                Publish this draft
              </button>
            </section>
          )}

          <section>
            <button type="button" className={button} onClick={() => window.confirm(`Delete the draft “${draft.title}” for everybody?`) && change({ op: 'delete' })}>
              Delete this draft
            </button>
          </section>
        </>
      )}

      {picking && (
        <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`Covers of ${picking.work.title}`} onClick={e => e.target === e.currentTarget && closePicking()}>
          <div className="w-full max-w-5xl rounded-lg border border-line bg-bg p-4 sm:p-6">
            <div className="flex items-baseline gap-3">
              <h3 className="min-w-0 flex-1 truncate font-display text-xl text-ink">{picking.work.title}</h3>
              <button type="button" onClick={closePicking} className={button}>Close</button>
            </div>
            <p className="mt-1 text-sm text-ink-3">{picking.work.author} · {picking.covers.length} covers · tap one to put it on the wall</p>
            {/* Where the search stands: still looking, done, or stopped by an error (N12: a stop is not an end). */}
            <div className="mt-3" aria-live="polite">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${picking.error ? 'bg-accent/50' : 'bg-accent'}`}
                  style={{ width: `${picking.total ? Math.round((100 * picking.scanned) / picking.total) : picking.loading ? 5 : 100}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-3">
                {picking.error
                  ? `Search stopped after ${picking.scanned} of ${picking.total ?? '?'} editions. `
                  : picking.loading
                    ? `Still looking — ${picking.scanned}${picking.total ? ` of ${picking.total}` : ''} editions looked through…`
                    : `Done — looked through ${picking.total === 0 ? 'the editions' : `all ${picking.total} editions`}${picking.capped ? ' (the site stops at 1,500)' : ''}.`}
                {picking.error && (
                  <button type="button" onClick={() => loadCovers(picking, picking.next ?? picking.scanned)} className="underline underline-offset-2 hover:text-accent">
                    Try again
                  </button>
                )}
              </p>
            </div>
            {picking.error && <p className="mt-2 text-sm text-accent">{picking.error}</p>}
            {!picking.loading && !picking.error && picking.covers.length === 0 && (
              <p className="mt-3 text-sm text-ink-3">{draft?.kind === 'series' ? 'No edition with a cover under these publisher names.' : 'No covers among these editions.'}</p>
            )}
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {picking.covers.map(c => (
                <li key={c.id}>
                  <button type="button" onClick={() => choose(c.id)} className="group block w-full text-left">
                    <span className={`cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 ${picking.chosen === c.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'group-hover:ring-2 group-hover:ring-line'}`}>
                      <CoverImage src={olCover(coverNumber(c.id), 'M')} alt={`Cover ${[c.year, c.publisher].filter(Boolean).join(', ')}`} sizes="(max-width: 640px) 33vw, 16vw" fit="contain" />
                    </span>
                    <span className="mt-1 block truncate text-xs text-ink-3">{[c.year, c.publisher].filter(Boolean).join(' · ') || ' '}</span>
                  </button>
                </li>
              ))}
            </ul>

          </div>
        </div>
      )}
    </div>
  );
}
