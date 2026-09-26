'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PublishToggle from './PublishToggle';
import { moveTo } from '@/lib/curate/pending';

export interface AdminCollection {
  slug: string;
  title: string;
  works: number;
  published: boolean;
}

/** How many published collections the home page shows (CollectionsShelf's SHELF_MAX). */
const ON_HOME = 6;

/**
 * The collections on the site, on /curate (ROADMAP 5.10g, 5.10h). For Julian
 * as admin: publish or unpublish each, and arrange them by dragging (Julian,
 * 2026-09-26: „das hin und her schieben der collections muss per drag and
 * drop gehen"; the arrows stay for a phone, where a drag does not start). The
 * order here is the order on the site, and the first six published ones are
 * the home page's. A drop is saved at once; no deploy.
 *
 * For a friend the same list without the controls. Either way each row says
 * how many drafts exist for that collection, and opens them (`onDrafts`).
 */
export default function AdminCollections({ collections, admin, draftsBySlug, onDrafts }: {
  collections: AdminCollection[];
  admin: boolean;
  draftsBySlug: Record<string, number>;
  onDrafts: (slug: string) => void;
}) {
  const router = useRouter();
  const [list, setList] = useState(collections);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<number | null>(null);

  async function save(next: AdminCollection[]) {
    const before = list;
    setList(next);
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/curate/order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slugs: next.map(c => c.slug) }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Not saved.');
      router.refresh();
    } catch (e) {
      setList(before);
      setError(e instanceof Error ? e.message : 'Not saved.');
    } finally {
      setBusy(false);
    }
  }

  function place(slug: string, to: number) {
    const ids = moveTo(list.map(c => c.slug), slug, to);
    if (ids.join() === list.map(c => c.slug).join()) return;
    void save(ids.map(id => list.find(c => c.slug === id)!));
  }

  let publishedSeen = 0;
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl text-ink">Collections on the site</h2>
        <p className="text-xs text-ink-3">
          {list.filter(c => c.published).length} published · {list.filter(c => !c.published).length} not published
        </p>
      </div>
      {admin && (
        <p className="mt-1 text-xs text-ink-3">
          Drag a row to reorder — saved at once. The order here is the order on the site; the first {ON_HOME} published ones are on the home page.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-accent" role="alert">{error}</p>}
      <ul className="mt-3 divide-y divide-line rounded-md border border-line text-sm">
        {list.map((c, i) => {
          const onHome = c.published && publishedSeen++ < ON_HOME;
          const drafts = draftsBySlug[c.slug] ?? 0;
          return (
            <li
              key={c.slug}
              draggable={admin && !busy}
              onDragStart={e => { setDragging(c.slug); e.dataTransfer.effectAllowed = 'move'; }}
              onDragEnd={() => { setDragging(null); setOver(null); }}
              onDragOver={e => { if (dragging) { e.preventDefault(); setOver(i); } }}
              onDrop={e => {
                e.preventDefault();
                // Dropped on a row: the dragged collection takes that row's place.
                if (dragging) place(dragging, i);
                setDragging(null);
                setOver(null);
              }}
              className={`flex items-center gap-2 px-2 py-2 ${dragging === c.slug ? 'opacity-40' : ''} ${over === i && dragging !== c.slug ? 'bg-accent/10' : ''} ${admin ? 'cursor-grab active:cursor-grabbing' : ''}`}
            >
              {admin && (
                <span className="flex shrink-0 items-center gap-1 text-ink-3">
                  <span aria-hidden="true" className="select-none px-1 text-base leading-none">⠿</span>
                  <span className="flex flex-col sm:hidden">
                    <button type="button" disabled={busy || i === 0} onClick={() => place(c.slug, i - 1)} aria-label={`Move ${c.title} up`} className="px-1 leading-none hover:text-accent disabled:opacity-30">▲</button>
                    <button type="button" disabled={busy || i === list.length - 1} onClick={() => place(c.slug, i + 1)} aria-label={`Move ${c.title} down`} className="px-1 leading-none hover:text-accent disabled:opacity-30">▼</button>
                  </span>
                </span>
              )}
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-ink-3">{i + 1}</span>
              <Link href={`/collections/${c.slug}`} draggable={false} className="min-w-0 flex-1 truncate text-ink underline-offset-4 hover:text-accent hover:underline">{c.title}</Link>
              {onHome && <span className="hidden rounded-full border border-accent/40 px-2 py-0.5 text-[11px] text-accent sm:inline">home page</span>}
              {drafts > 0 && (
                <button type="button" onClick={() => onDrafts(c.slug)} className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-2 hover:border-accent hover:text-accent">
                  {drafts} {drafts === 1 ? 'draft' : 'drafts'}
                </button>
              )}
              <span className="hidden shrink-0 text-xs tabular-nums text-ink-3 sm:inline">{c.works} books</span>
              {/* On a phone the button says it; the title needs the room. */}
              <span className={`${admin ? 'hidden sm:inline' : ''} shrink-0 text-xs ${c.published ? 'text-ink-2' : 'text-accent'}`}>{c.published ? 'published' : 'not published'}</span>
              {admin && <PublishToggle slug={c.slug} title={c.title} published={c.published} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
