'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import BookWorkCard, { type ResultOrigin } from './BookWorkCard';
import { shapeOf } from '@/lib/queryshape';
import CuratedWall from './CuratedWall';
import MosaicLoader from './MosaicLoader';
import { LANGUAGES } from './SearchBar';
import type { AuthorSearchResult, SearchCorrection, SearchResult } from '@/lib/search';

interface BookGridProps {
  searchQuery: string;
  language: string;
  /** `?exact=1`: no typo correction (ROADMAP 6.60). */
  exact?: boolean;
  /** The author mode, `?author=<name>[&key=OL…A]` (ROADMAP 6.60, SPEC F1.10). */
  author?: { name: string; key?: string };
}

type AnyResult = SearchResult | AuthorSearchResult;

/** What went wrong, in words the reader can act on. */
interface Failure {
  title: string;
  detail: string;
  /** Whether trying the same search again could plausibly work. */
  retryable: boolean;
}

/** Outcome of the most recent request, tagged with the request it answers. */
type Outcome = { key: string; result?: AnyResult; failure?: Failure };

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
 * query named over it. Until the picture is there, the heading stands over a
 * field of its size that breathes as the picture will (ROADMAP 6.33).
 */
export function GridSkeleton({ query }: { query?: string }) {
  return <MosaicLoader caption={query ? `Looking for \u201c${query}\u201d in Open Library` : 'Searching'} />;
}

/** `/?q=…` for a search, as the result list itself would link it. */
function textSearchHref(q: string, language: string, exact = false): string {
  const params = new URLSearchParams({ q });
  if (language && language !== 'all') params.set('lang', language);
  if (exact) params.set('exact', '1');
  return `/?${params}`;
}

/**
 * The line above the results when the spelling was corrected (SPEC F1.9):
 * what the results are for, and the way back to what was typed. Wording
 * stays with what happened — "showing results for" — and never calls the
 * reader's word wrong.
 */
function CorrectionLine({ correction, language, authorName }: { correction: SearchCorrection; language: string; authorName?: string }) {
  return (
    <p className="mb-4 text-sm text-ink-2" role="status">
      {authorName ? (
        <>Showing books by <strong className="font-medium text-ink">{authorName}</strong> for &ldquo;{correction.from}&rdquo;.</>
      ) : (
        <>
          Showing results for <strong className="font-medium text-ink">{correction.to}</strong>.{' '}
          <Link href={textSearchHref(correction.from, language, true)} className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
            Search for &ldquo;{correction.from}&rdquo; instead
          </Link>
        </>
      )}
    </p>
  );
}

export default function BookGrid({ searchQuery, language, exact = false, author }: BookGridProps) {
  // A retry has to change the request key, or the effect would not run again
  // and the reader would press a button that does nothing.
  const [attempt, setAttempt] = useState(0);
  const authorName = author?.name ?? '';
  const authorKey = author?.key ?? '';
  const key = author
    ? `author:${authorName}:${authorKey} #${attempt}`
    : searchQuery ? `${searchQuery} ${language} ${exact ? 'exact' : ''} #${attempt}` : '';
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const router = useRouter();
  // Memoised: the effect depends on it, and a fresh object each render would
  // restart the search on every render.
  const pasted = useMemo(() => shapeOf(searchQuery), [searchQuery]);

  useEffect(() => {
    if (!key) return;
    /*
      A pasted work id is an address, not a question (ROADMAP 6.29). Open
      Library finds nothing for `OL1168083W` and the page used to answer "No
      books found" about a work whose page exists — so go there instead of
      asking. `replace`, not `push`: the search that was never really a search
      has no business in the back button.
    */
    if (!authorName && !authorKey && pasted.kind === 'work') {
      router.replace(`/book/${pasted.workId}`);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (authorName || authorKey) {
      params.set('author', authorName);
      if (authorKey) params.set('key', authorKey);
    } else {
      params.set('q', searchQuery);
      if (language && language !== 'all') params.set('lang', language);
      if (exact) params.set('exact', '1');
    }

    fetch(`/api/search?${params}`, { signal: controller.signal })
      .then(async res => {
        if (!res.ok) {
          setOutcome({ key, failure: await failureFor(res) });
          return;
        }
        setOutcome({ key, result: (await res.json()) as AnyResult });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setOutcome({
          key,
          failure: { title: 'No connection', detail: 'The search could not be sent. Check the connection and try again.', retryable: true },
        });
      });

    return () => controller.abort();
  }, [key, searchQuery, language, exact, authorName, authorKey, pasted, router]);

  if (!key) return <CuratedWall />;

  // Loading = the latest outcome does not answer the current request.
  const current = outcome?.key === key ? outcome : null;
  if (!current) return <GridSkeleton query={authorName || searchQuery} />;

  // An outcome carries a result or a failure, never both and never neither.
  if (!current.result) {
    const failure: Failure = current.failure ?? { title: 'Something went wrong', detail: 'The search failed.', retryable: true };
    return (
      <Notice title={failure.title} tone="error" onRetry={failure.retryable ? () => setAttempt(a => a + 1) : undefined}>
        {failure.detail}
      </Notice>
    );
  }

  if (author) return <AuthorResults result={current.result as AuthorSearchResult} typed={authorName} origin={{ author: authorName, authorKey }} />;

  const result = current.result as SearchResult;
  const { works, correction } = result;
  const shape = pasted;
  if (works.length === 0) {
    /*
      A sentence about the input, not about the world (N12, ROADMAP 6.29).
      An ISBN that the catalogue does not hold is a different fact from a
      title nobody wrote, and "try another spelling" is useless advice for a
      thirteen-digit number.
    */
    if (shape.kind === 'isbn') {
      return (
        <Notice title="No book under this ISBN">
          The number is a valid ISBN, but Open Library has no edition recorded under it. Searching
          for the title and author usually finds the book anyway.
        </Notice>
      );
    }
    // Name the language filter only when one is set: suggesting the reader
    // remove a filter they never applied sends them the wrong way.
    const filter = language && language !== 'all' ? LANGUAGES.find(l => l.code === language)?.label : undefined;
    return (
      <Notice title="No books found">
        {filter
          ? `Open Library knows nothing under this title with a ${filter} edition. Try another title, or remove the language filter.`
          : 'Open Library knows nothing under this title. Try another spelling, or add the author.'}
        {/* A suggestion the catalogue was not asked about in time: offered, not claimed (N12). */}
        {correction && !correction.applied && (
          <>
            {' '}
            <Link href={textSearchHref(correction.to, language)} className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
              Did you mean &ldquo;{correction.to}&rdquo;?
            </Link>
          </>
        )}
      </Notice>
    );
  }

  const totalEditions = works.reduce((sum, w) => sum + (w.editionCount ?? 0), 0);

  return (
    <section aria-label="Search results">
      {/*
        The number was an ISBN, and Open Library did not find an edition under
        it — it fell back to searching for the digits (ROADMAP 6.29). Measured
        2026-09-10 over eight ISBNs: five real ones returned **exactly one**
        book each, while two valid but unknown ones returned 8 and 15 loose
        matches and one returned none. So more than one hit means the number
        was not found, and saying nothing would let a reader take *Harry
        Potter* for the book in their hand (N12).
      */}
      {shape.kind === 'isbn' && works.length > 1 && (
        <Notice title="No edition under this ISBN">
          Open Library has nothing recorded under this number and searched for the digits instead.
          What follows are text matches, not the book you are holding.
        </Notice>
      )}
      {correction?.applied && <CorrectionLine correction={correction} language={language} />}
      <p className="kicker mb-5">
        {works.length} {works.length === 1 ? 'book' : 'books'} · {totalEditions.toLocaleString('en')} editions
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {works.map(work => (
          <BookWorkCard
            key={work.id}
            work={work}
            origin={{ query: correction?.applied ? correction.to : searchQuery, language }}
            /*
              Only when the ISBN picked out a single book: with several hits
              the number did not identify one edition, and pointing at a cover
              would claim more than was asked (ROADMAP 6.29).
            */
            isbn={shape.kind === 'isbn' && works.length === 1 ? shape.isbn13 : undefined}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * The author mode's results (ROADMAP 6.60, SPEC F1.10): her books, most-printed
 * first, as the same cards a search shows. Two empty states, because they are
 * different facts: nobody under this name, or a person without a covered book.
 */
function AuthorResults({ result, typed, origin }: { result: AuthorSearchResult; typed: string; origin: ResultOrigin }) {
  const { works, author, correction } = result;
  if (!author) {
    return (
      <Notice title="No author found">
        Open Library knows no one under this name. Try another spelling, or search titles and authors together.
        {typed && (
          <>
            {' '}
            <Link href={textSearchHref(typed, '')} className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
              Search &ldquo;{typed}&rdquo; everywhere
            </Link>
          </>
        )}
      </Notice>
    );
  }
  if (works.length === 0) {
    return (
      <Notice title={`No books by ${author.name} with a cover`}>
        Open Library lists {author.name}, but none of the records under this name has a cover.
      </Notice>
    );
  }
  const totalEditions = works.reduce((sum, w) => sum + (w.editionCount ?? 0), 0);
  return (
    <section aria-label={`Books by ${author.name}`}>
      {correction?.applied && <CorrectionLine correction={correction} language="" authorName={author.name} />}
      <h2 className="mb-1 text-2xl leading-tight text-ink sm:text-3xl">Books by {author.name}</h2>
      <p className="kicker mb-5">
        {works.length} {works.length === 1 ? 'book' : 'books'} · {totalEditions.toLocaleString('en')} editions · most printed first
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {works.map(work => (
          <BookWorkCard key={work.id} work={work} origin={{ ...origin, author: origin.author || author.name, authorKey: origin.authorKey || author.key }} />
        ))}
      </div>
    </section>
  );
}
