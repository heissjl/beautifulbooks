'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/Link';
import CoverImage from './CoverImage';
import AdminCollections, { type AdminCollection } from './AdminCollections';
import { rich, useLocale, useT } from './i18n';
import { intlTag, type Locale } from '@/lib/i18n/locale';
import type { Translate } from '@/lib/i18n/translate';
import { olCover } from '@/lib/curated';
import type { Candidate } from '@/lib/collectionedit';
import type { Draft } from '@/lib/curate/drafts';
import type { FoundAuthor } from '@/lib/curate/catalog';
import { NOTHING_PENDING, hasPending, moveTo, pendingOps, pendingWorks, pickKey, removeTile, type Pending, type WallPick } from '@/lib/curate/pending';

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

type Origin = 'claude' | 'hand';

const field = 'w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-accent focus:outline-none';
const button = 'rounded-md border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50';
const primary = 'rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-on-accent transition-opacity hover:opacity-90 disabled:opacity-50';
const heading = 'text-xs font-semibold uppercase tracking-wider text-ink-3';
const badge = 'rounded-full border px-2 py-0.5 text-[11px] leading-none';

/** An image id of Open Library, or nothing for a site-served stopgap (`local:`), which has no thumbnail route here. */
const coverNumber = (id: string) => (id.startsWith('ol:') ? Number(id.slice(3)) : 0);

/** A hand edit counts if it came more than a few seconds after Claude's last push. */
const EDIT_AFTER_PUSH_MS = 5000;

async function call<T>(t: Translate, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? {} : {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401) throw new Error(t('You were signed out. Reload the page and enter the password again.'));
  if (res.status === 429) throw new Error(t('Too many requests. Wait a minute.'));
  if (!res.ok) throw new Error(data.error ?? t('That did not work.'));
  return data;
}

function when(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(intlTag(locale), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function originOf(d: Draft): Origin {
  return d.pushedAt ? 'claude' : 'hand';
}

function editedSincePush(d: Draft): boolean {
  return !!d.pushedAt && Date.parse(d.updatedAt) - Date.parse(d.pushedAt) > EDIT_AFTER_PUSH_MS;
}

function Thumb({ coverId, size, sizes }: { coverId: string; size: 'S' | 'M'; sizes: string }) {
  const t = useT();
  const n = coverNumber(coverId);
  return n ? <CoverImage src={olCover(n, size)} alt="" sizes={sizes} /> : <span className="flex h-full items-center justify-center text-[9px] text-ink-3">{t('own image')}</span>;
}

/** Where a draft came from and what happened to it since, in a row of small labels. */
function DraftBadges({ d, collections }: { d: Draft; collections: AdminCollection[] }) {
  const t = useT();
  const locale = useLocale();
  const site = collections.find(c => c.slug === d.slug);
  return (
    <span className="flex flex-wrap gap-1">
      {d.pushedAt
        ? <span className={`${badge} border-ink-3/40 text-ink-2`} title={t('Last pushed by Claude {when}', { when: when(d.pushedAt, locale) })}>Claude · {when(d.pushedAt, locale)}</span>
        : <span className={`${badge} border-accent/40 text-accent`}>{t('by hand')}{d.by ? ` · ${d.by}` : ''}</span>}
      {editedSincePush(d) && <span className={`${badge} border-accent/40 text-accent`}>{t('edited by hand since')}</span>}
      {d.publishedOn && <span className={`${badge} border-ink-3/40 text-ink-2`}>{t('published from here {when}', { when: when(d.publishedOn, locale) })}</span>}
      {d.importedOn && <span className={`${badge} border-ink-3/40 text-ink-2`}>{t('taken into the file {date}', { date: d.importedOn })}</span>}
      {site
        ? <span className={`${badge} border-line text-ink-3`}>{site.published ? t('collection is live') : t('collection not published')}</span>
        : <span className={`${badge} border-line text-ink-3`}>{t('new collection')}</span>}
    </span>
  );
}

/**
 * The collection curation tool, online for friends (ROADMAP 5.10b, SPEC
 * F8.5): the same steps as Julian's `lab/collections/`, working on drafts in
 * the site's store. A draft never changes a page; Julian takes it over.
 *
 * Reworked 2026-09-26 (Julian: „mach die curate seite übersichtlicher. es muss
 * klar sein welche drafts händisch kamen und welche von claude gepusht wurden
 * … speichern button … ein bild einfach ganz nach vorn … mehr übersichtlichkeit
 * über collections und drafts"): the start page lists the collections on the
 * site with their drafts, and the drafts by origin; editing a wall collects
 * the changes until Save (`lib/curate/pending.ts`), which sends them in one
 * request.
 */
export default function CurateTool({ initialDrafts, startingPoints, collections, initialId, admin = false }: {
  initialDrafts: Draft[];
  startingPoints: StartingPoint[];
  /** The collections of the site, in the site's order. */
  collections: AdminCollection[];
  initialId?: string;
  /** Julian signed in as admin: he may publish a draft on the site (5.10g). */
  admin?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [currentId, setCurrentId] = useState<string | null>(
    initialDrafts.some(d => d.id === initialId) ? (initialId ?? null) : null,
  );
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Pending>(NOTHING_PENDING);
  const [creating, setCreating] = useState({ title: '', kind: 'authors', by: '', from: '' });
  const [authorQuery, setAuthorQuery] = useState('');
  const [found, setFound] = useState<FoundAuthor[] | null>(null);
  const [publisher, setPublisher] = useState('');
  const [candidates, setCandidates] = useState<Record<string, Candidate[] | 'loading' | { error: string }>>({});
  const [picking, setPicking] = useState<Picking | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  /** In the cover picker: add the cover as a further tile and keep the one on the wall (two printings, two designs). */
  const [pickAgain, setPickAgain] = useState(false);
  const [dropAt, setDropAt] = useState<string | null>(null);
  const [filter, setFilter] = useState<{ origin: 'all' | Origin; slug: string; text: string }>({ origin: 'all', slug: '', text: '' });
  // Which work the cover window is searching for; read only in handlers, so the
  // background search stops when the window closes or another book opens.
  const searching = useRef<string | null>(null);

  const draft = drafts.find(d => d.id === currentId) ?? null;
  const dirty = hasPending(pending);
  const wall: WallPick[] = useMemo(() => (draft ? pendingWorks(draft.works, pending) : []), [draft, pending]);

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function open(id: string | null) {
    if (dirty && !window.confirm(t('You have unsaved changes. Leave without saving?'))) return;
    setPending(NOTHING_PENDING);
    setCurrentId(id);
    setFound(null);
    setError('');
    setSaved('');
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('d', id);
    else url.searchParams.delete('d');
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0 });
  }

  function take(next: Draft) {
    setDrafts(prev => (prev.some(d => d.id === next.id) ? prev.map(d => (d.id === next.id ? next : d)) : [next, ...prev]));
    setSaved(t('Saved {time}', { time: new Date().toLocaleTimeString(intlTag(locale), { hour: '2-digit', minute: '2-digit' }) }));
  }

  /** A change that goes to the server at once: authors, publishers, publish, delete. */
  async function change(op: Record<string, unknown>) {
    if (!draft) return;
    setError('');
    try {
      const { draft: next } = await call<{ draft: Draft }>(t, `/api/curate/drafts/${draft.id}`, op);
      if (next.deleted) {
        setDrafts(prev => prev.filter(d => d.id !== next.id));
        setPending(NOTHING_PENDING);
        open(null);
        return;
      }
      take(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Not saved.'));
    }
  }

  async function save() {
    if (!draft || !dirty) return;
    setError('');
    setSaving(true);
    try {
      const { draft: next } = await call<{ draft: Draft }>(t, `/api/curate/drafts/${draft.id}`, { op: 'batch', ops: pendingOps(pending, wall.map(pickKey)) });
      take(next);
      setPending(NOTHING_PENDING);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : t('Not saved.')} ${t('Your changes are still here; try Save again.')}`);
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (window.confirm(t('Throw away the changes since the last save?'))) setPending(NOTHING_PENDING);
  }

  async function refresh() {
    setError('');
    try {
      setDrafts((await call<{ drafts: Draft[] }>(t, '/api/curate/drafts')).drafts);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Could not load the drafts.'));
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const { draft: d } = await call<{ draft: Draft }>(t, '/api/curate/drafts', {
        title: creating.title,
        kind: creating.kind,
        by: creating.by,
        ...(creating.from ? { from: creating.from } : {}),
      });
      take(d);
      open(d.id);
      setCreating(c => ({ ...c, title: '', from: '' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Not created.'));
    }
  }

  /**
   * Edit a collection as the site shows it now (Julian, 2026-10-05): opens the
   * draft that still holds that version, or copies a new one from the site.
   */
  async function edit(slug: string) {
    setError('');
    try {
      const { draft: d } = await call<{ draft: Draft }>(t, '/api/curate/drafts', { from: slug, reuse: true, by: creating.by });
      setDrafts(prev => (prev.some(x => x.id === d.id) ? prev : [d, ...prev]));
      open(d.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Not created.'));
    }
  }

  async function findAuthor(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setFound(null);
    try {
      setFound((await call<{ found: FoundAuthor[] }>(t, `/api/curate/find-author?q=${encodeURIComponent(authorQuery)}`)).found);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('The search did not answer.'));
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
        t,
        `/api/curate/candidates?draft=${draft.id}&source=${encodeURIComponent(source)}`,
      );
      setCandidates(c => ({ ...c, [key]: list }));
    } catch (e) {
      // A failure is said as one, and the next open asks again (N12).
      setCandidates(c => ({ ...c, [key]: { error: e instanceof Error ? e.message : t('Open Library did not answer.') } }));
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
          t,
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
        setPicking({ ...state, loading: false, error: e instanceof Error ? e.message : t('The covers did not load.') });
        return;
      }
    }
  }

  function startPicking(work: Picking['work'], chosen?: string) {
    const p: Picking = { work, chosen, covers: [], next: 0, loading: true, error: '', scanned: 0, total: null, capped: false };
    setPicking(p);
    setPickAgain(false);
    void loadCovers(p, 0);
  }

  function closePicking() {
    searching.current = null;
    setPicking(null);
  }

  /**
   * A chosen cover waits for Save like every other edit; choosing takes a
   * removed book back. The tile being changed is the one the picker opened
   * from (its current cover is `chosen`); with `again`, the cover becomes a
   * further tile and the old one stays.
   */
  function choose(coverId: string) {
    if (!picking) return;
    const { work, chosen } = picking;
    const again = pickAgain;
    closePicking();
    const shownKey = chosen !== undefined && wall.some(w => w.id === work.id && w.coverId === chosen) ? `${work.id}|${chosen}` : null;
    const nextKey = `${work.id}|${coverId}`;
    setPending(p => {
      const picks = { ...p.picks };
      if (again || !shownKey) {
        if (wall.some(w => pickKey(w) === nextKey)) return p;
        picks[nextKey] = { ...work, coverId, ...(again ? { again: true } : {}) };
        return { ...p, picks, order: p.order ? [...p.order, nextKey] : null };
      }
      // A tile whose cover was already changed keeps its saved key, so Save can say which tile it replaces.
      const savedKey = Object.keys(picks).find(k => pickKey(picks[k]) === shownKey) ?? shownKey;
      picks[savedKey] = { ...picks[savedKey], ...work, coverId };
      return { ...p, picks, removed: p.removed.filter(k => k !== savedKey), order: p.order?.map(k => (k === shownKey ? nextKey : k)) ?? null };
    });
  }

  function remove(key: string) {
    const saved = new Set((draft?.works ?? []).map(pickKey));
    setPending(p => removeTile(p, saved, key));
  }

  function place(key: string, to: number) {
    const keys = wall.map(pickKey);
    const next = moveTo(keys, key, to);
    if (next.join() !== keys.join()) setPending(p => ({ ...p, order: next }));
  }

  function drop(onto: string) {
    if (!drag || drag === onto) return;
    place(drag, wall.findIndex(w => pickKey(w) === onto));
    setDrag(null);
    setDropAt(null);
  }

  const sources = draft ? (draft.kind === 'authors' ? (draft.authors ?? []).map(a => a.name) : (draft.publishers ?? [])) : [];
  const onWall = new Set(wall.map(w => w.id));
  const shownTitle = pending.title ?? draft?.title ?? '';
  const shownIntro = pending.intro ?? draft?.intro ?? '';
  const shownBy = pending.by ?? draft?.by ?? '';
  const pendingCount = pendingOps(pending, wall.map(pickKey)).length;

  const draftsBySlug = useMemo(() => {
    const out: Record<string, number> = {};
    for (const d of drafts) out[d.slug] = (out[d.slug] ?? 0) + 1;
    return out;
  }, [drafts]);
  const listed = drafts
    .filter(d => filter.origin === 'all' || originOf(d) === filter.origin)
    .filter(d => !filter.slug || d.slug === filter.slug)
    .filter(d => !filter.text || d.title.toLowerCase().includes(filter.text.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const counts = { all: drafts.length, claude: drafts.filter(d => originOf(d) === 'claude').length, hand: drafts.filter(d => originOf(d) === 'hand').length };

  return (
    <div className="space-y-10">
      {error && <p className="rounded-md border border-accent/40 px-3 py-2 text-sm text-accent" role="alert">{error}</p>}

      {!draft && (
        <>
          <AdminCollections
            key={collections.map(c => `${c.slug}:${c.published}`).join()}
            collections={collections}
            admin={admin}
            draftsBySlug={draftsBySlug}
            onEdit={slug => void edit(slug)}
            onDrafts={slug => { setFilter({ origin: 'all', slug, text: '' }); document.getElementById('drafts')?.scrollIntoView({ behavior: 'smooth' }); }}
          />

          <section id="drafts" className="scroll-mt-20">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl text-ink">{t('Drafts')}</h2>
              <button type="button" onClick={refresh} className={button}>{t('Refresh')}</button>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {rich(t('{claude} marks a draft Claude pushed from the collections file; {hand} one started here. A draft changes no page until it is published.'), {
                claude: <b className="font-medium text-ink-2">Claude</b>,
                hand: <b className="font-medium text-accent">{t('by hand')}</b>,
              })}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(['all', 'claude', 'hand'] as const).map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setFilter(f => ({ ...f, origin: o }))}
                  aria-pressed={filter.origin === o}
                  className={`${badge} px-3 py-1 text-xs ${filter.origin === o ? 'border-accent bg-accent text-on-accent' : 'border-line text-ink-2 hover:border-accent'}`}
                >
                  {o === 'all' ? t('All') : o === 'claude' ? t('Pushed by Claude') : t('By hand')} ({counts[o]})
                </button>
              ))}
              {filter.slug && (
                <button type="button" onClick={() => setFilter(f => ({ ...f, slug: '' }))} className={`${badge} border-accent/40 px-3 py-1 text-xs text-accent`}>
                  {collections.find(c => c.slug === filter.slug)?.title ?? filter.slug} ×
                </button>
              )}
              <input value={filter.text} onChange={e => setFilter(f => ({ ...f, text: e.target.value }))} placeholder={t('Find a draft')} className="ml-auto w-full rounded-md border border-line bg-surface px-3 py-1 text-sm text-ink focus:border-accent focus:outline-none sm:w-56" />
            </div>
            {listed.length === 0 && <p className="mt-3 text-sm text-ink-3">{drafts.length === 0 ? t('No drafts yet. Start one below.') : t('No draft matches.')}</p>}
            <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {listed.map(d => (
                <li key={d.id}>
                  <button type="button" onClick={() => open(d.id)} className={`flex w-full gap-3 rounded-md border p-3 text-left transition-colors hover:border-accent ${originOf(d) === 'hand' ? 'border-accent/30' : 'border-line'}`}>
                    <span className="flex shrink-0 gap-1">
                      {d.works.slice(0, 4).map(w => (
                        <span key={`${w.id}:${w.coverId}`} className="relative block aspect-[2/3] w-9 overflow-hidden rounded bg-surface-2">
                          <Thumb coverId={w.coverId} size="S" sizes="36px" />
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium text-ink">{d.title}</span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-3">{d.works.length === 1 ? t('1 book') : t('{n} books', { n: d.works.length })}</span>
                      </span>
                      <span className="block text-xs text-ink-3">{t('changed {when}', { when: when(d.updatedAt, locale) })} · /collections/{d.slug}{draftsBySlug[d.slug] > 1 ? ` · ${t('{n} drafts for this address', { n: draftsBySlug[d.slug] })}` : ''}</span>
                      <DraftBadges d={d} collections={collections} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="max-w-xl">
            <h2 className="font-display text-2xl text-ink">{t('Start a draft')}</h2>
            <form onSubmit={create} className="mt-4 space-y-3">
              <select value={creating.from} onChange={e => setCreating(c => ({ ...c, from: e.target.value }))} className={field}>
                <option value="">{t('A new collection')}</option>
                {startingPoints.map(p => (
                  <option key={p.slug} value={p.slug}>{t('Continue “{title}” ({n} books)', { title: p.title, n: p.works })}</option>
                ))}
              </select>
              {!creating.from && (
                <>
                  <input value={creating.title} onChange={e => setCreating(c => ({ ...c, title: e.target.value }))} maxLength={120} placeholder={t('Title, e.g. Penguin Modern Classics')} className={field} />
                  <div className="flex gap-4 text-sm text-ink-2">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={creating.kind === 'authors'} onChange={() => setCreating(c => ({ ...c, kind: 'authors' }))} /> {t('Books by a list of authors')}
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={creating.kind === 'series'} onChange={() => setCreating(c => ({ ...c, kind: 'series' }))} /> {t('A publisher’s series')}
                    </label>
                  </div>
                </>
              )}
              <input value={creating.by} onChange={e => setCreating(c => ({ ...c, by: e.target.value }))} maxLength={60} placeholder={t('Your name, so Julian knows who to thank (optional)')} className={field} />
              <button type="submit" disabled={!creating.from && !creating.title.trim()} className={button}>{t('Start')}</button>
            </form>
          </section>
        </>
      )}

      {draft && (
        <>
          {/* The save bar stays in view while scrolling a long wall. */}
          <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
            <button type="button" onClick={() => open(null)} className="text-sm text-ink-2 hover:text-accent">{t('← All drafts')}</button>
            <span className="min-w-0 flex-1 truncate font-display text-lg text-ink">{shownTitle}</span>
            {dirty ? (
              <>
                <span className="text-xs text-accent">{pendingCount === 1 ? t('1 unsaved change') : t('{n} unsaved changes', { n: pendingCount })}</span>
                <button type="button" onClick={discard} disabled={saving} className={button}>{t('Discard')}</button>
                <button type="button" onClick={save} disabled={saving} className={primary}>{saving ? t('Saving…') : t('Save')}</button>
              </>
            ) : (
              <span className="text-xs text-ink-3">{saved || t('No unsaved changes')}</span>
            )}
          </div>

          <div className="space-y-2">
            <DraftBadges d={draft} collections={collections} />
            <p className="text-xs text-ink-3">
              /collections/{draft.slug} · {t('{n} books', { n: draft.works.length })} · {t('changed {when}', { when: when(draft.updatedAt, locale) })}
              {collections.some(c => c.slug === draft.slug) && <> · <Link href={`/collections/${draft.slug}`} className="underline underline-offset-2 hover:text-accent">{t('see the collection')}</Link></>}
            </p>
            {draft.importedOn && <p className="text-xs text-accent">{t('Taken over by Julian on {date}; later changes are not on the site until published.', { date: draft.importedOn })}</p>}
          </div>

          <section className="max-w-2xl space-y-3">
            <h2 className={heading}>{t('Page')}</h2>
            <input value={shownTitle} maxLength={120} onChange={e => { const v = e.target.value; setPending(p => ({ ...p, title: v === draft.title ? undefined : v })); }} className={`${field} font-display text-xl`} aria-label={t('Title')} />
            <textarea value={shownIntro} maxLength={1200} rows={3} onChange={e => { const v = e.target.value; setPending(p => ({ ...p, intro: v === draft.intro ? undefined : v })); }} placeholder={t('A paragraph for the page: what holds these books together?')} className={field} aria-label={t('Introduction')} />
            <input value={shownBy} maxLength={60} onChange={e => { const v = e.target.value; setPending(p => ({ ...p, by: v === (draft.by ?? '') ? undefined : v })); }} placeholder={t('Your name (optional)')} className={field} aria-label={t('Your name')} />
          </section>

          <section>
            <h2 className={heading}>{t('Wall ({n})', { n: wall.length })}</h2>
            <p className="mt-1 text-xs text-ink-3">
              {rich(t('Drag a cover onto another to put it there, or use {front} (to the front), the arrows and ×. Tap a cover to choose another. Nothing is kept until you press {save}.'), { front: <b className="font-medium">⇤</b>, save: <b className="font-medium">{t('Save')}</b> })}
            </p>
            {wall.length === 0 && <p className="mt-3 text-sm text-ink-3">{t('Nothing on the wall yet. Open an author below and pick a book.')}</p>}
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
              {wall.map((w, i) => {
                const key = pickKey(w);
                const changed = Object.values(pending.picks).some(x => pickKey(x) === key);
                return (
                  <li
                    key={key}
                    draggable
                    onDragStart={e => { setDrag(key); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDrag(null); setDropAt(null); }}
                    onDragOver={e => { if (drag) { e.preventDefault(); setDropAt(key); } }}
                    onDrop={e => { e.preventDefault(); drop(key); }}
                    className={`relative cursor-grab active:cursor-grabbing ${drag === key ? 'opacity-40' : ''}`}
                  >
                    {dropAt === key && drag !== key && <span aria-hidden="true" className="absolute -left-2 top-0 bottom-0 w-1 rounded-full bg-accent sm:-left-2.5" />}
                    <button type="button" onClick={() => startPicking(w, w.coverId)} className="block w-full text-left">
                      <span className={`cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 ${changed ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''}`}>
                        <Thumb coverId={w.coverId} size="M" sizes="(max-width: 640px) 33vw, 16vw" />
                      </span>
                    </button>
                    <span className="absolute left-1 top-1 rounded bg-bg/90 px-1.5 text-[11px] tabular-nums text-ink-2 shadow">{i + 1}</span>
                    {/* Taking a book off the wall, where the eye already is (Julian, 2026-09-25: „i also need a button to delete a work"). */}
                    <button
                      type="button"
                      onClick={() => remove(key)}
                      aria-label={t('Remove {title} from the collection', { title: w.title })}
                      title={t('Remove from the collection')}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-bg/90 text-base leading-none text-ink shadow transition-colors hover:bg-accent hover:text-on-accent"
                    >
                      ×
                    </button>
                    <p className="mt-1.5 line-clamp-2 text-xs font-medium leading-snug text-ink">{w.title}</p>
                    <p className="line-clamp-1 text-xs text-ink-3">{w.author}</p>
                    <div className="mt-1 flex items-center gap-0.5 text-xs text-ink-3">
                      <button type="button" disabled={i === 0} onClick={() => place(key, 0)} aria-label={t('Move {title} to the front', { title: w.title })} title={t('To the front')} className="rounded px-1.5 text-sm leading-none hover:text-accent disabled:opacity-30">⇤</button>
                      <button type="button" disabled={i === 0} onClick={() => place(key, i - 1)} aria-label={t('Move earlier')} className="ml-auto rounded px-1.5 hover:text-accent disabled:opacity-30">←</button>
                      <button type="button" disabled={i === wall.length - 1} onClick={() => place(key, i + 1)} aria-label={t('Move later')} className="rounded px-1.5 hover:text-accent disabled:opacity-30">→</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className={heading}>{draft.kind === 'authors' ? t('Authors ({n})', { n: sources.length }) : t('Publisher spellings ({n})', { n: sources.length })}</h2>
            <p className="mt-1 text-xs text-ink-3">
              {draft.kind === 'authors'
                ? t('Only books whose first author is on this list can go on the wall. Removing an author takes their books off it.')
                : t('Only covers of editions filed under exactly one of these names, as Open Library spells them.')}
              {' '}{dirty ? t('These changes are saved at once — save the wall first.') : t('These changes are saved at once.')}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {sources.map(name => (
                <li key={name} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2">
                  {name}
                  <button type="button" disabled={dirty} aria-label={t('Remove {name}', { name })} className="px-1 text-ink-3 hover:text-accent disabled:opacity-30" onClick={() => {
                    const n = draft.works.filter(w => w.author === name).length;
                    if (n && !window.confirm(t('Remove {name}? {n} book(s) leave the wall with them.', { name, n }))) return;
                    void change(draft.kind === 'authors' ? { op: 'removeAuthor', name } : { op: 'removePublisher', name });
                  }}>×</button>
                </li>
              ))}
            </ul>
            {draft.kind === 'authors' ? (
              <>
                <form onSubmit={findAuthor} className="mt-3 flex max-w-md gap-2">
                  <input value={authorQuery} onChange={e => setAuthorQuery(e.target.value)} placeholder={t('Add an author, e.g. Virginia Woolf')} className={field} />
                  <button type="submit" className={button}>{t('Find')}</button>
                </form>
                {found && (
                  <ul className="mt-2 max-w-2xl divide-y divide-line text-sm">
                    {found.length === 0 && <li className="py-2 text-ink-3">{t('Open Library knows nobody by that name.')}</li>}
                    {found.map(a => (
                      <li key={a.key} className="flex items-center gap-3 py-2">
                        <span className="min-w-0 flex-1">
                          <b className="font-medium text-ink">{a.name}</b>{' '}
                          <span className="text-xs text-ink-3">{t('{n} works', { n: a.works })}{a.topWork ? ` · ${a.topWork}` : ''}{a.born ? ` · ${t('born {year}', { year: a.born })}` : ''}</span>
                        </span>
                        <button type="button" disabled={dirty} className={button} onClick={() => { setFound(null); setAuthorQuery(''); void change({ op: 'addAuthor', name: a.name, key: a.key }); }}>{t('Add')}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <form onSubmit={e => { e.preventDefault(); void change({ op: 'addPublisher', name: publisher }); setPublisher(''); }} className="mt-3 flex max-w-md gap-2">
                <input value={publisher} onChange={e => setPublisher(e.target.value)} placeholder={t('e.g. Penguin Classics')} className={field} />
                <button type="submit" disabled={dirty} className={button}>{t('Add')}</button>
              </form>
            )}
          </section>

          <section>
            <h2 className={heading}>{t('Books to choose from')}</h2>
            <p className="mt-1 text-xs text-ink-3">{t('The most-printed works at Open Library. Open a name to list them; tap a book to see its covers.')}</p>
            <div className="mt-3 space-y-2">
              {sources.map(source => {
                const list = candidates[`${draft.id}|${source}`];
                return (
                  <details key={source} className="rounded-md border border-line bg-surface" onToggle={e => (e.currentTarget as HTMLDetailsElement).open && loadCandidates(source)}>
                    <summary className="cursor-pointer px-3 py-2 font-medium text-ink">{source}</summary>
                    <div className="px-3 pb-3">
                      {list === undefined || list === 'loading' ? (
                        <p className="text-sm text-ink-3">{t('Loading…')}</p>
                      ) : 'error' in list ? (
                        <p className="text-sm text-accent">{list.error} {t('Close and open again to retry.')}</p>
                      ) : list.length === 0 ? (
                        <p className="text-sm text-ink-3">{t('No works found with this name as first author.')}</p>
                      ) : (
                        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                          {list.map(c => (
                            <li key={c.id}>
                              <button type="button" onClick={() => startPicking(c, wall.find(w => w.id === c.id)?.coverId)} className="flex w-full items-center gap-2 rounded p-1 text-left hover:bg-bg">
                                <span className="relative block aspect-[2/3] w-8 shrink-0 overflow-hidden rounded bg-surface-2">
                                  {c.coverId && <Thumb coverId={c.coverId} size="S" sizes="32px" />}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm text-ink">{c.title}{onWall.has(c.id) && <span className="text-accent"> · {t('on the wall')}</span>}</span>
                                  <span className="block text-xs text-ink-3">{c.firstPublished ?? '?'} · {t('{n} editions', { n: c.editions })}{draft.kind === 'series' && c.author ? ` · ${c.author}` : ''}</span>
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
              <h2 className={heading}>{t('Publish · admin')}</h2>
              <p className="mt-1 text-sm text-ink-2">
                {startingPoints.some(p => p.slug === draft.slug)
                  ? t('Puts this draft on the site now, at /collections/{slug}, in place of the collection there. No deploy needed.', { slug: draft.slug })
                  : t('Puts this draft on the site now, at /collections/{slug}, as a new collection. No deploy needed.', { slug: draft.slug })}
                {draft.publishedOn ? ` ${t('Last published {when}.', { when: when(draft.publishedOn, locale) })}` : ''}
                {dirty ? ` ${t('Save your changes first.')}` : ''}
              </p>
              <button
                type="button"
                disabled={dirty}
                className={`${button} mt-3`}
                onClick={() => window.confirm(t('Publish the draft “{title}” ({n} books) on the site now?', { title: draft.title, n: draft.works.length })) && change({ op: 'publish' })}
              >
                {t('Publish this draft')}
              </button>
            </section>
          )}

          <section>
            <button type="button" className={button} onClick={() => window.confirm(t('Delete the draft “{title}” for everybody?', { title: draft.title })) && change({ op: 'delete' })}>
              {t('Delete this draft')}
            </button>
          </section>
        </>
      )}

      {picking && (
        <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={t('Covers of {title}', { title: picking.work.title })} onClick={e => e.target === e.currentTarget && closePicking()}>
          <div className="w-full max-w-5xl rounded-lg border border-line bg-bg p-4 sm:p-6">
            <div className="flex items-baseline gap-3">
              <h3 className="min-w-0 flex-1 truncate font-display text-xl text-ink">{picking.work.title}</h3>
              <button type="button" onClick={closePicking} className={button}>{t('Close')}</button>
            </div>
            <p className="mt-1 text-sm text-ink-3">{picking.work.author} · {t('{n} covers', { n: picking.covers.length })} · {t('tap one to put it on the wall (then Save)')}</p>
            {wall.some(w => w.id === picking.work.id) && (
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-ink-2">
                <input id="curate-pick-again" type="checkbox" checked={pickAgain} onChange={e => setPickAgain(e.target.checked)} />
                {t('Add as a further cover and keep the one on the wall')}
              </label>
            )}
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
                  ? `${t('Search stopped after {scanned} of {total} editions.', { scanned: picking.scanned, total: picking.total ?? '?' })} `
                  : picking.loading
                    ? picking.total
                      ? t('Still looking — {scanned} of {total} editions looked through…', { scanned: picking.scanned, total: picking.total })
                      : t('Still looking — {scanned} editions looked through…', { scanned: picking.scanned })
                    : `${picking.total === 0 ? t('Done — looked through the editions') : t('Done — looked through {total} editions', { total: picking.total ?? 0 })}${picking.capped ? ` ${t('(the site stops at 1,500)')}` : ''}.`}
                {picking.error && (
                  <button type="button" onClick={() => loadCovers(picking, picking.next ?? picking.scanned)} className="underline underline-offset-2 hover:text-accent">
                    {t('Try again')}
                  </button>
                )}
              </p>
            </div>
            {picking.error && <p className="mt-2 text-sm text-accent">{picking.error}</p>}
            {!picking.loading && !picking.error && picking.covers.length === 0 && (
              <p className="mt-3 text-sm text-ink-3">{draft?.kind === 'series' ? t('No edition with a cover under these publisher names.') : t('No covers among these editions.')}</p>
            )}
            <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {picking.covers.map(c => (
                <li key={c.id}>
                  <button type="button" onClick={() => choose(c.id)} className="group block w-full text-left">
                    <span className={`cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 ${picking.chosen === c.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'group-hover:ring-2 group-hover:ring-line'}`}>
                      <CoverImage src={olCover(coverNumber(c.id), 'M')} alt={t('Cover {detail}', { detail: [c.year, c.publisher].filter(Boolean).join(', ') })} sizes="(max-width: 640px) 33vw, 16vw" fit="contain" />
                    </span>
                    <span className="mt-1 block truncate text-xs text-ink-3">{[c.year, c.publisher].filter(Boolean).join(' · ') || ' '}</span>
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
