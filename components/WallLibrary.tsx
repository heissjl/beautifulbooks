'use client';

import { useEffect, useRef, useState } from 'react';
import WallProposal, { type Destination, type Proposal } from './WallProposal';
import { rich, useT } from './i18n';
import { cleanBook, type BookQuery } from '@/lib/calibre/clean';
import { libraryFromDb, type LibraryBook } from '@/lib/calibre/library';
import { CALIBRE_BOOKS_PER_REQUEST, MAX_CALIBRE_BOOKS, MAX_CALIBRE_FILE_BYTES, MAX_GOODREADS_FILE_BYTES } from '@/lib/calibre/limits';
import { libraryFromGoodreadsCsv, type GoodreadsBook } from '@/lib/goodreads/export';
import { normalizeAuthor, normalizeTitle } from '@/lib/normalize';
import type { PublicWall, Tile } from '@/lib/walls/model';
import type { CalibreMatch } from '@/lib/walls/calibre';

/** Where the books come from: a Calibre `metadata.db` or a Goodreads export (ROADMAP 5.19). */
export type LibrarySource = 'calibre' | 'goodreads';

/** How long to wait when the site says "too many" (the `wallsCalibre` bucket refills 12 a minute), and how often. */
const PAUSE_MS = 15_000;
const MAX_PAUSES = 12;

/** Goodreads' three shelves, in the order offered; "all" is every book of the export. */
const SHELVES = ['read', 'currently-reading', 'to-read'] as const;
type Shelf = (typeof SHELVES)[number] | 'all';

interface Library {
  /** A key for this file (and shelf), so a second file starts a fresh list. */
  key: string;
  books: number;
  /** Without an author or a title: nothing to ask with. */
  skipped: number;
  /** More books than one library may look up: the most recently added were taken. */
  capped: boolean;
  queries: BookQuery[];
}

/** A Goodreads export that has been read, waiting for a shelf to be chosen or changed. */
interface Export {
  key: string;
  books: GoodreadsBook[];
  shelf: Shelf;
}

type State =
  | { step: 'idle' }
  | { step: 'reading' }
  | { step: 'looking'; lib: Library; matches: (CalibreMatch | undefined)[]; waiting: boolean }
  | { step: 'done'; lib: Library; matches: CalibreMatch[] }
  | { step: 'error'; message: string; lib?: Library; matches?: (CalibreMatch | undefined)[] };

/** The books to ask about: cleaned, each title and author once, at most `MAX_CALIBRE_BOOKS` — the newest. */
function prepare(books: LibraryBook[], key: string): Library {
  const seen = new Set<string>();
  const usable: { query: BookQuery; added: string; order: number }[] = [];
  books.forEach((b, order) => {
    const query = cleanBook(b);
    if (!query) return;
    // Two copies of one book in the library are one question.
    const id = `${normalizeTitle(query.title)}|${normalizeAuthor(query.author)}`;
    if (seen.has(id)) return;
    seen.add(id);
    usable.push({ query, added: b.added, order });
  });
  const capped = usable.length > MAX_CALIBRE_BOOKS;
  const kept = capped ? [...usable].sort((a, b) => b.added.localeCompare(a.added)).slice(0, MAX_CALIBRE_BOOKS).sort((a, b) => a.order - b.order) : usable;
  return { key, books: books.length, skipped: books.filter((b) => !cleanBook(b)).length, capped, queries: kept.map((u) => u.query) };
}

const onShelf = (books: GoodreadsBook[], shelf: Shelf): GoodreadsBook[] => (shelf === 'all' ? books : books.filter((b) => b.shelf === shelf));

/** "read" when there is anything on it — the books someone has held — otherwise every book. */
const firstShelf = (books: GoodreadsBook[]): Shelf => (books.some((b) => b.shelf === 'read') ? 'read' : 'all');

/**
 * A collection from a reader's own library file: a Calibre library (ROADMAP
 * 5.17a, after lab/calibre-import, 5.17; Julian, 2026-10-03: „das soll ja
 * einfach erstmal nur eine sammlung initialisieren aus einer calibre datei,
 * die man hochlädt") or a Goodreads export (5.19; Julian, 2026-10-05: a toggle
 * between the two, not a card of its own). The reader chooses `metadata.db`
 * or `goodreads_library_export.csv`; **it is read in this browser and never
 * sent** (`lib/calibre/sqlite.ts`, `lib/goodreads/export.ts`), and the site
 * never asks Goodreads (6.11). What goes to the server is a title, a first
 * author and the ISBNs per book, eight books a request, one request after
 * another, and the list to tick grows as the answers come — matches ticked,
 * suggestions as "maybe", like the photo. A Goodreads export is looked up one
 * shelf at a time, "read" first.
 */
export default function WallLibrary({ source, walls, onCommit }: { source: LibrarySource; walls?: PublicWall[]; onCommit: (dest: Destination, tiles: Tile[]) => Promise<void> }) {
  const t = useT();
  const [state, setState] = useState<State>({ step: 'idle' });
  const [goodreads, setGoodreads] = useState<Export | null>(null);
  const [over, setOver] = useState(false);
  const run = useRef<AbortController | null>(null);

  // Leaving the page stops the lookups it started.
  useEffect(() => () => run.current?.abort(), []);

  function unreadable(err: unknown): string {
    const message = err instanceof Error ? err.message : '';
    if (source === 'goodreads') {
      if (message.includes('not a Goodreads export')) return t('This is not a Goodreads export. Choose goodreads_library_export.csv — Goodreads makes it under My Books → Import and export.');
      return t('The file could not be read — it may be damaged or cut off. Choose goodreads_library_export.csv again.');
    }
    if (message.includes('not a Calibre library')) return t('This is a database, but not a Calibre library. Choose metadata.db from your Calibre library folder.');
    if (message.includes('not an SQLite file')) return t('This is not a Calibre library file. Choose metadata.db from your Calibre library folder.');
    return t('The file could not be read — it may be damaged or cut off. Choose metadata.db again.');
  }

  async function read(file: File | undefined) {
    if (!file) return;
    run.current?.abort();
    setGoodreads(null);
    const tooLarge = source === 'goodreads' ? file.size > MAX_GOODREADS_FILE_BYTES : file.size > MAX_CALIBRE_FILE_BYTES;
    if (tooLarge) {
      setState({
        step: 'error',
        message: source === 'goodreads' ? t('This file is larger than 20 MB — that is not a Goodreads export this page can read.') : t('This file is larger than 200 MB — that is not a Calibre library this page can read.'),
      });
      return;
    }
    setState({ step: 'reading' });
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (source === 'goodreads') {
      let books: GoodreadsBook[];
      try {
        books = libraryFromGoodreadsCsv(await file.text());
      } catch (err) {
        setState({ step: 'error', message: unreadable(err) });
        return;
      }
      chooseShelf({ key, books, shelf: firstShelf(books) });
      return;
    }
    let lib: Library;
    try {
      lib = prepare(libraryFromDb(await file.arrayBuffer()), key);
    } catch (err) {
      setState({ step: 'error', message: unreadable(err) });
      return;
    }
    void look(lib);
  }

  /** Another shelf of the same export: the lookups so far stop, the list starts again. */
  function chooseShelf(next: Export) {
    run.current?.abort();
    setGoodreads(next);
    void look(prepare(onShelf(next.books, next.shelf), `${next.key}:${next.shelf}`));
  }

  async function look(lib: Library) {
    const controller = new AbortController();
    run.current = controller;
    let matches: (CalibreMatch | undefined)[] = new Array(lib.queries.length).fill(undefined);
    setState({ step: 'looking', lib, matches, waiting: false });

    for (let from = 0; from < lib.queries.length; from += CALIBRE_BOOKS_PER_REQUEST) {
      const chunk = lib.queries.slice(from, from + CALIBRE_BOOKS_PER_REQUEST);
      let answer: CalibreMatch[] | null = null;
      for (let pause = 0; answer === null; pause++) {
        if (controller.signal.aborted) return;
        let res: Response;
        try {
          res = await fetch('/api/walls/calibre', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ books: chunk, source }), signal: controller.signal });
        } catch {
          if (controller.signal.aborted) return;
          // The site did not answer for these books: they say so, and the rest go on (N12).
          answer = chunk.map(() => ({ status: 'failed' as const }));
          break;
        }
        if (res.status === 429 && pause < MAX_PAUSES) {
          setState({ step: 'looking', lib, matches, waiting: true });
          await new Promise((r) => setTimeout(r, PAUSE_MS));
          continue;
        }
        if (controller.signal.aborted) return;
        if (res.status === 404 || res.status === 503) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setState({ step: 'error', lib, matches, message: res.status === 404 ? t('Collections are switched off on this site just now.') : (data.error ?? t('The site could not look the books up just now. Try again in a moment.')) });
          return;
        }
        const data = res.ok ? ((await res.json().catch(() => null)) as { matches?: CalibreMatch[] } | null) : null;
        answer = data?.matches?.length === chunk.length ? data.matches : chunk.map(() => ({ status: 'failed' as const }));
      }
      if (controller.signal.aborted) return;
      matches = [...matches.slice(0, from), ...answer, ...matches.slice(from + chunk.length)];
      setState({ step: 'looking', lib, matches, waiting: false });
    }
    setState({ step: 'done', lib, matches: matches.map((m) => m ?? { status: 'failed' }) });
  }

  function shelfName(shelf: Shelf): string {
    if (shelf === 'read') return t('Read');
    if (shelf === 'currently-reading') return t('Currently reading');
    if (shelf === 'to-read') return t('Want to read');
    return t('All');
  }

  const lib = state.step === 'looking' || state.step === 'done' || state.step === 'error' ? state.lib : undefined;
  const matches: (CalibreMatch | undefined)[] = state.step === 'looking' || state.step === 'done' ? state.matches : state.step === 'error' ? (state.matches ?? []) : [];
  // Only the books that have an answer: a library is hundreds of rows, and "looking it up…" on each says nothing the count does not.
  const answered = lib ? lib.queries.flatMap((query, i) => (matches[i] ? [{ query, match: matches[i] as CalibreMatch }] : [])) : [];
  const proposals: Proposal[] = answered.map(({ query, match }) => ({
    label: query.title,
    sub: match.status === 'match' ? undefined : query.author,
    ...(match.tile ? { tile: match.tile } : {}),
    ...(match.status === 'suggestion' ? { unsure: true, why: t('maybe — your library has “{read}”', { read: `${query.title}, ${query.author}` }) } : {}),
    ...(match.status === 'failed' ? { failed: true, missing: t('the search did not answer') } : { missing: t('not in the catalogue') }),
  }));

  const count = (status: CalibreMatch['status']) => answered.filter((a) => a.match.status === status).length;
  const found = count('match');
  const maybe = count('suggestion');
  const notFound = count('none');
  const failed = count('failed');
  const counts = [
    t('{n} found with a cover', { n: found }),
    maybe ? t('{n} maybe', { n: maybe }) : '',
    notFound ? t('{n} not in the catalogue', { n: notFound }) : '',
    failed ? (failed === 1 ? t('1 search did not answer') : t('{n} searches did not answer', { n: failed })) : '',
  ].filter(Boolean);
  const about = lib
    ? [
        goodreads && goodreads.shelf !== 'all'
          ? lib.books === 1
            ? t('1 book on this shelf')
            : t('{n} books on this shelf', { n: lib.books })
          : lib.books === 1
            ? t('1 book in the library')
            : t('{n} books in the library', { n: lib.books }),
        lib.skipped ? t('{n} without an author or title left out', { n: lib.skipped }) : '',
        lib.capped ? t('the {max} most recently added looked up', { max: MAX_CALIBRE_BOOKS }) : '',
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const summary =
    state.step === 'looking'
      ? `${about}. ${t('Looking them up at Open Library… {done} of {total}', { done: answered.length, total: lib?.queries.length ?? 0 })}${answered.length ? `: ${counts.join(', ')}` : ''}. ${state.waiting ? t('The catalogue is being asked a lot — going on in a moment.') : t('You can tick and add while the rest come in.')}`
      : `${about}: ${counts.join(', ')}. ${t('Each starts with the cover of your printing where Open Library knows it, otherwise the book’s usual one — you can change it in the collection’s editor.')}`;

  return (
    <div className="mt-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          read(e.dataTransfer.files[0]);
        }}
        className={`block cursor-pointer rounded-card border-[1.5px] border-dashed bg-surface px-4 py-7 text-center text-sm text-ink-2 transition-colors ${over ? 'border-accent' : 'border-line hover:border-accent'}`}
      >
        {source === 'goodreads' ? (
          <>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />
            {rich(t('{choose} or drop it here'), { choose: <span className="font-medium text-ink">{t('Choose goodreads_library_export.csv')}</span> })}
            <span className="mt-1 block text-xs text-ink-3">{t('Goodreads makes it under My Books → Import and export → Export Library. The file stays on your device: only titles, authors and ISBNs are sent, to look the books up.')}</span>
          </>
        ) : (
          <>
            <input type="file" accept=".db,application/vnd.sqlite3,application/x-sqlite3" className="sr-only" onChange={(e) => read(e.target.files?.[0])} />
            {rich(t('{choose} or drop it here'), { choose: <span className="font-medium text-ink">{t('Choose metadata.db')}</span> })}
            <span className="mt-1 block text-xs text-ink-3">{t('It is in your Calibre library folder. The file stays on your device: only titles, authors and ISBNs are sent, to look the books up.')}</span>
          </>
        )}
      </label>

      {goodreads && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t('Shelf')}>
          {[...SHELVES.filter((shelf) => goodreads.books.some((b) => b.shelf === shelf)), 'all' as const].map((shelf) => (
            <button
              key={shelf}
              type="button"
              aria-pressed={goodreads.shelf === shelf}
              onClick={() => goodreads.shelf !== shelf && chooseShelf({ ...goodreads, shelf })}
              className={`rounded-full border px-3 py-0.5 text-sm tabular-nums transition-colors ${goodreads.shelf === shelf ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink-2 hover:border-accent hover:text-accent'}`}
            >
              {shelfName(shelf)} {onShelf(goodreads.books, shelf).length}
            </button>
          ))}
        </div>
      )}

      {state.step === 'reading' && <p className="mt-3 text-sm text-ink-2" role="status">{t('Reading your library…')}</p>}
      {state.step === 'error' && <p className="mt-3 text-sm text-accent" role="alert">{state.message}</p>}
      {lib && lib.queries.length === 0 && state.step !== 'error' && <p className="mt-3 text-sm text-ink-2">{t('No book in this library has an author and a title to look up.')}</p>}
      {lib && lib.queries.length > 0 && (
        <WallProposal key={lib.key} proposals={proposals} defaultTitle={source === 'goodreads' ? t('My Goodreads books') : t('My Calibre library')} walls={walls} onCommit={onCommit} summary={summary} scroll />
      )}
    </div>
  );
}
