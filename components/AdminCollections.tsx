'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PublishToggle from './PublishToggle';

export interface AdminCollection {
  slug: string;
  title: string;
  works: number;
  published: boolean;
}

/** How many published collections the home page shows (CollectionsShelf's SHELF_MAX). */
const ON_HOME = 4;

/**
 * Julian's list of the collections on /curate (ROADMAP 5.10g, 5.10h): publish
 * or unpublish each, and arrange them — the order here is the order on the
 * site, and the first four published ones are the home page's (Julian,
 * 2026-09-25: „i need a way to arrange the 4 collections shown on the
 * starting page"). Each move is saved at once; no deploy.
 */
export default function AdminCollections({ collections }: { collections: AdminCollection[] }) {
  const router = useRouter();
  const [list, setList] = useState(collections);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function move(index: number, by: number) {
    const to = index + by;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
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
      setList(list);
      setError(e instanceof Error ? e.message : 'Not saved.');
    } finally {
      setBusy(false);
    }
  }

  let publishedSeen = 0;
  return (
    <section className="mt-6 max-w-2xl">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Collections on the site · admin</h2>
      <p className="mt-1 text-xs text-ink-3">The order here is the order on the site; the first {ON_HOME} published ones are on the home page.</p>
      {error && <p className="mt-2 text-xs text-accent" role="alert">{error}</p>}
      <ul className="mt-2 divide-y divide-line text-sm">
        {list.map((c, i) => {
          const onHome = c.published && publishedSeen++ < ON_HOME;
          return (
            <li key={c.slug} className="flex items-center gap-2 py-2">
              <span className="flex shrink-0 flex-col">
                <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Move ${c.title} up`} className="px-1 leading-none text-ink-3 hover:text-accent disabled:opacity-30">▲</button>
                <button type="button" disabled={busy || i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${c.title} down`} className="px-1 leading-none text-ink-3 hover:text-accent disabled:opacity-30">▼</button>
              </span>
              <Link href={`/collections/${c.slug}`} className="min-w-0 flex-1 truncate text-ink underline-offset-4 hover:text-accent hover:underline">{c.title}</Link>
              {onHome && <span className="rounded-full border border-accent/40 px-2 py-0.5 text-[11px] text-accent">home page</span>}
              <span className="text-xs text-ink-3">{c.works} books</span>
              <span className={`text-xs ${c.published ? 'text-ink-2' : 'text-accent'}`}>{c.published ? 'published' : 'draft'}</span>
              <PublishToggle slug={c.slug} title={c.title} published={c.published} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
