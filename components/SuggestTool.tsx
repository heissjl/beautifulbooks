'use client';

import { useState } from 'react';
import CoverImage from './CoverImage';
import { olCover } from '@/lib/curated';
import type { CollectionKind } from '@/lib/collections';
import type { SearchResult } from '@/lib/search';

export interface SuggestCollection {
  slug: string;
  title: string;
  kind: CollectionKind;
  scope: string[];
  works: Array<{ id: string; title: string; author: string }>;
}

interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
}

interface CoverChoice {
  id: string;
  year?: number;
  publisher?: string;
}

const NEW = '__new__';

const field = 'w-full rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-accent focus:outline-none';
const button = 'rounded-md border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-accent hover:text-accent disabled:opacity-50';

function coverNumber(id: string): number {
  return Number(id.slice(3));
}

/**
 * The friends' suggestion tool (ROADMAP 5.10a, SPEC F8.4): a collection, a
 * book from our own search, a cover from its Open Library editions, a note.
 * Every request goes through the site's own routes; the covers route never
 * asks Google, and the search makes its one Open Library call as for anyone.
 */
export default function SuggestTool({ collections }: { collections: SuggestCollection[] }) {
  const [slug, setSlug] = useState(collections[0]?.slug ?? NEW);
  const [newTitle, setNewTitle] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Book[] | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [covers, setCovers] = useState<CoverChoice[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [by, setBy] = useState('');
  const [busy, setBusy] = useState<'search' | 'covers' | 'send' | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<Array<{ title: string; collection: string; coverId: string }>>([]);

  const collection = collections.find(c => c.slug === slug) ?? null;

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy('search');
    setError('');
    setBook(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error(res.status === 429 ? 'Too many searches. Wait a minute.' : 'The search did not answer.');
      const body = (await res.json()) as SearchResult;
      setResults(
        body.works
          .filter(w => /^OL\d+W$/.test(w.id))
          .slice(0, 12)
          .map(w => ({ id: w.id, title: w.title, author: w.authors[0] ?? '', coverUrl: w.coverUrls[0] })),
      );
    } catch (e) {
      // A search that failed is not "no books" (N12): say which it was.
      setResults(null);
      setError(e instanceof Error ? e.message : 'The search did not answer.');
    } finally {
      setBusy(null);
    }
  }

  async function loadCovers(target: Book, offset: number) {
    setBusy('covers');
    setError('');
    try {
      const res = await fetch(`/api/suggest/covers?id=${target.id}&offset=${offset}`);
      const body = (await res.json()) as { covers?: CoverChoice[]; next?: number | null; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'The covers did not load.');
      setCovers(prev => {
        const known = new Set(prev.map(c => c.id));
        return [...(offset === 0 ? [] : prev), ...(body.covers ?? []).filter(c => offset === 0 || !known.has(c.id))];
      });
      setNextOffset(body.next ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The covers did not load.');
    } finally {
      setBusy(null);
    }
  }

  function choose(b: Book) {
    setBook(b);
    setCover(null);
    setCovers([]);
    setNextOffset(null);
    void loadCovers(b, 0);
  }

  async function send() {
    if (!book || !cover) return;
    setBusy('send');
    setError('');
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          collection: slug === NEW ? null : slug,
          newCollection: slug === NEW ? newTitle : undefined,
          work: { id: book.id, title: book.title, author: book.author, coverId: cover },
          note,
          by,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(res.status === 401 ? 'You were signed out. Reload the page.' : (body.error ?? 'Not sent.'));
      setSent(prev => [{ title: book.title, collection: slug === NEW ? newTitle : (collection?.title ?? slug), coverId: cover }, ...prev]);
      setBook(null);
      setCover(null);
      setCovers([]);
      setNote('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Not sent.');
    } finally {
      setBusy(null);
    }
  }

  const alreadyIn = book && collection?.works.some(w => w.id === book.id);
  const offList = book && collection?.kind === 'authors' && book.author && !collection.scope.includes(book.author.normalize('NFC'));

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-display text-2xl text-ink">1. Collection</h2>
        <select value={slug} onChange={e => setSlug(e.target.value)} className={`${field} mt-3 max-w-md`}>
          {collections.map(c => (
            <option key={c.slug} value={c.slug}>{c.title} ({c.works.length} books)</option>
          ))}
          <option value={NEW}>An idea for a new collection…</option>
        </select>
        {slug === NEW ? (
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            maxLength={120}
            placeholder="What would it be called? e.g. Penguin Modern Classics"
            className={`${field} mt-3 max-w-md`}
          />
        ) : collection && (
          <div className="mt-3 max-w-2xl text-sm text-ink-2">
            {collection.kind === 'authors' && collection.scope.length > 0 && (
              <p>Authors in this collection: {collection.scope.join(', ')}. A book by someone else is welcome as a suggestion — Julian decides who joins the list.</p>
            )}
            {collection.kind === 'series' && collection.scope.length > 0 && <p>Publisher: {collection.scope.join(', ')}.</p>}
            {collection.works.length > 0 && (
              <p className="mt-2 text-ink-3">Already in it: {collection.works.map(w => w.title).join(' · ')}</p>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl text-ink">2. Book</h2>
        <form onSubmit={search} className="mt-3 flex max-w-md gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Title or author" className={field} />
          <button type="submit" disabled={busy === 'search'} className={button}>{busy === 'search' ? 'Searching…' : 'Search'}</button>
        </form>
        {results && results.length === 0 && <p className="mt-3 text-sm text-ink-3">Open Library found no book for that.</p>}
        {results && results.length > 0 && (
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {results.map(r => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => choose(r)}
                  className={`flex w-full items-center gap-3 rounded-md border p-2 text-left transition-colors hover:border-accent ${book?.id === r.id ? 'border-accent' : 'border-line'}`}
                >
                  <span className="relative block aspect-[2/3] w-10 shrink-0 overflow-hidden rounded bg-surface-2">
                    {r.coverUrl && <CoverImage src={r.coverUrl} alt="" sizes="40px" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                    <span className="block truncate text-xs text-ink-3">{r.author}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {book && (
        <section>
          <h2 className="font-display text-2xl text-ink">3. Cover of <em>{book.title}</em></h2>
          {alreadyIn && <p className="mt-2 text-sm text-ink-2">This book is already in the collection. Suggest a cover if you think a different one is better.</p>}
          {offList && <p className="mt-2 text-sm text-ink-2">{book.author} is not on this collection&rsquo;s list yet. Julian decides whether to add them.</p>}
          {busy === 'covers' && covers.length === 0 && <p className="mt-3 text-sm text-ink-3">Loading covers…</p>}
          {busy !== 'covers' && covers.length === 0 && !error && <p className="mt-3 text-sm text-ink-3">No covers among the editions Open Library lists for this record.</p>}
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6 sm:gap-4">
            {covers.map(c => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setCover(c.id)}
                  aria-pressed={cover === c.id}
                  className="group block w-full text-left"
                >
                  <span className={`cover-shadow relative block aspect-[2/3] overflow-hidden rounded-card bg-surface-2 ${cover === c.id ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'group-hover:ring-1 group-hover:ring-line'}`}>
                    <CoverImage src={olCover(coverNumber(c.id), 'M')} alt={`Cover ${[c.year, c.publisher].filter(Boolean).join(', ')}`} sizes="(max-width: 640px) 33vw, 16vw" fit="contain" />
                  </span>
                  <span className="mt-1 block truncate text-xs text-ink-3">{[c.year, c.publisher].filter(Boolean).join(' · ') || ' '}</span>
                </button>
              </li>
            ))}
          </ul>
          {nextOffset !== null && (
            <button type="button" disabled={busy === 'covers'} onClick={() => loadCovers(book, nextOffset)} className={`${button} mt-4`}>
              {busy === 'covers' ? 'Loading…' : 'More covers'}
            </button>
          )}
        </section>
      )}

      {book && cover && (
        <section className="max-w-xl">
          <h2 className="font-display text-2xl text-ink">4. Send</h2>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Why this one? (optional)"
            className={`${field} mt-3`}
          />
          <input
            value={by}
            onChange={e => setBy(e.target.value)}
            maxLength={60}
            placeholder="Your name, so Julian knows who to thank (optional)"
            className={`${field} mt-3`}
          />
          <button type="button" onClick={send} disabled={busy === 'send' || (slug === NEW && !newTitle.trim())} className={`${button} mt-3`}>
            {busy === 'send' ? 'Sending…' : 'Send suggestion'}
          </button>
        </section>
      )}

      {error && <p className="text-sm text-accent" role="alert">{error}</p>}

      {sent.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-ink">Sent, thank you</h2>
          <ul className="mt-3 space-y-2">
            {sent.map((s, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-ink-2">
                <span className="relative block aspect-[2/3] w-8 shrink-0 overflow-hidden rounded bg-surface-2">
                  <CoverImage src={olCover(coverNumber(s.coverId), 'M')} alt="" sizes="32px" />
                </span>
                <span><b className="font-medium text-ink">{s.title}</b> for {s.collection}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
