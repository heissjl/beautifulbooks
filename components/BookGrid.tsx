'use client';

import { useEffect, useState } from 'react';
import BookWorkCard from './BookWorkCard';
import CuratedWall from './CuratedWall';
import MosaicLoader from './MosaicLoader';
import { LANGUAGES } from './SearchBar';
import type { SearchResult } from '@/lib/search';

interface BookGridProps {
  searchQuery: string;
  language: string;
}

/** What went wrong, in words the reader can act on. */
interface Failure {
  title: string;
  detail: string;
  /** Whether trying the same search again could plausibly work. */
  retryable: boolean;
}

/** Outcome of the most recent request, tagged with the request it answers. */
type Outcome = { key: string; result?: SearchResult; failure?: Failure };

/**
 * Turns a response into a failure the reader can act on.
 *
 * The distinction that matters: a catalogue that stayed silent has said
 * nothing about the book, and the page must not fill that silence with "no
 * books found" (SPEC §3 F1.7). Measured on 2026-09-07, four of roughly
 * fourteen cold searches ended here.
 */
async function failureFor(res: Response): Promise<Failure> {
  const detail = await res
    .json()
    .then((body: { error?: string }) => body.error)
    .catch(() => undefined);
  if (res.status === 503) {
    return {
      title: 'The catalogue did not answer',
      detail: 'Open Library was too slow just now. This says nothing about the book you looked for.',
      retryable: true,
    };
  }
  if (res.status === 429) {
    return { title: 'Too many searches at once', detail: 'Give it a few seconds and try again.', retryable: true };
  }
  if (res.status === 400) {
    return { title: 'Not enough to go on', detail: detail ?? 'Type a little more.', retryable: false };
  }
  return { title: 'Something went wrong', detail: detail ?? `The search failed (${res.status}).`, retryable: true };
}

function Notice({
  title, children, tone = 'neutral', onRetry,
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'error';
  onRetry?: () => void;
}) {
  return (
    <div className="py-16 text-center">
      <p className={`font-display text-2xl ${tone === 'error' ? 'text-accent' : 'text-ink'}`}>{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">{children}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-accent mt-5">
          Try again
        </button>
      )}
    </div>
  );
}

/**
 * What a search looks like while it runs (SPEC §8.1, ROADMAP 6.19a): an
 * author's face assembling out of the covers of their own books, with the
 * query named under it. Falls back to the plain cover wall while the picture
 * is on its way, and for good if it does not arrive — the work page's first
 * seconds still use that wall, so both waits look like the same site.
 */
export function GridSkeleton({ query }: { query?: string }) {
  return <MosaicLoader caption={query ? `Looking for \u201c${query}\u201d in Open Library` : 'Searching'} />;
}

export default function BookGrid({ searchQuery, language }: BookGridProps) {
  // A retry has to change the request key, or the effect would not run again
  // and the reader would press a button that does nothing.
  const [attempt, setAttempt] = useState(0);
  const key = searchQuery ? `${searchQuery} ${language} #${attempt}` : '';
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ q: searchQuery });
    if (language && language !== 'all') params.set('lang', language);

    fetch(`/api/search?${params}`, { signal: controller.signal })
      .then(async res => {
        if (!res.ok) {
          setOutcome({ key, failure: await failureFor(res) });
          return;
        }
        setOutcome({ key, result: (await res.json()) as SearchResult });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setOutcome({
          key,
          failure: { title: 'No connection', detail: 'The search could not be sent. Check the connection and try again.', retryable: true },
        });
      });

    return () => controller.abort();
  }, [key, searchQuery, language]);

  if (!key) return <CuratedWall />;

  // Loading = the latest outcome does not answer the current request.
  const current = outcome?.key === key ? outcome : null;
  if (!current) return <GridSkeleton query={searchQuery} />;

  // An outcome carries a result or a failure, never both and never neither.
  if (!current.result) {
    const failure: Failure = current.failure ?? { title: 'Something went wrong', detail: 'The search failed.', retryable: true };
    return (
      <Notice title={failure.title} tone="error" onRetry={failure.retryable ? () => setAttempt(a => a + 1) : undefined}>
        {failure.detail}
      </Notice>
    );
  }

  const { works } = current.result;
  if (works.length === 0) {
    // Name the language filter only when one is set: suggesting the reader
    // remove a filter they never applied sends them the wrong way.
    const filter = language && language !== 'all' ? LANGUAGES.find(l => l.code === language)?.label : undefined;
    return (
      <Notice title="No books found">
        {filter
          ? `Open Library knows nothing under this title with a ${filter} edition. Try another title, or remove the language filter.`
          : 'Open Library knows nothing under this title. Try another spelling, or add the author.'}
      </Notice>
    );
  }

  const totalEditions = works.reduce((sum, w) => sum + (w.editionCount ?? 0), 0);

  return (
    <section aria-label="Search results">
      <p className="kicker mb-5">
        {works.length} {works.length === 1 ? 'book' : 'books'} · {totalEditions.toLocaleString('en')} editions
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {works.map(work => (
          <BookWorkCard key={work.id} work={work} query={searchQuery} language={language} />
        ))}
      </div>
    </section>
  );
}
