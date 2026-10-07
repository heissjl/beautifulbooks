'use client';

import Link from '@/components/Link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import BookWorkCard, { type ResultOrigin } from './BookWorkCard';
import { shapeOf } from '@/lib/queryshape';
import { groupByAuthor } from '@/lib/searchgroups';
import CuratedWall from './CuratedWall';
import MosaicLoader from './MosaicLoader';
import type { AuthorSearchResult, SearchCorrection, SearchResult } from '@/lib/search';
import { rich, useT } from './i18n';
import type { Translate } from '@/lib/i18n/translate';
import { useSearchSignal } from './useInsights';

interface BookGridProps {
  searchQuery: string;
  language: string;
  /** `?exact=1`: no typo correction (ROADMAP 6.60). */
  exact?: boolean;
  /** The author mode, `?author=<name>[&key=OL…A]` (ROADMAP 6.60, SPEC F1.10). */
  author?: { name: string; key?: string };
}

type AnyResult = SearchResult | AuthorSearchResult;

/**
 * Up to this many books by other authors stand open under their heading;
 * more are folded behind it, with the number (ROADMAP 6.81). Four is one row
 * on a desktop, two on a phone.
 */
const OPEN_OTHERS = 4;

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
async function failureFor(res: Response, t: Translate): Promise<Failure> {
  // The route's own sentence is translated where the catalogue knows it, and shown as it came otherwise.
  const detail = await res
    .json()
    .then((body: { error?: string }) => (body.error ? t(body.error) : undefined))
    .catch(() => undefined);
  if (res.status === 503) {
    return {
      title: t('The catalogue did not answer'),
      detail: t('Open Library was too slow just now. This says nothing about the book you looked for.'),
      retryable: true,
    };
  }
  if (res.status === 429) {
    return { title: t('Too many searches at once'), detail: t('Give it a few seconds and try again.'), retryable: true };
  }
  if (res.status === 400) {
    return { title: t('Not enough to go on'), detail: detail ?? t('Type a little more.'), retryable: false };
  }
  return { title: t('Something went wrong'), detail: detail ?? t('The search failed ({status}).', { status: String(res.status) }), retryable: true };
}

function Notice({
  title, children, tone = 'neutral', onRetry,
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'neutral' | 'error';
  onRetry?: () => void;
}) {
  const t = useT();
  return (
    <div className="py-16 text-center">
      <p className={`font-display text-2xl ${tone === 'error' ? 'text-accent' : 'text-ink'}`}>{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">{children}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-accent mt-5">
          {t('Try again')}
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
  const t = useT();
  return <MosaicLoader caption={query ? t('Looking for “{query}” in Open Library', { query }) : t('Searching')} />;
}

const GRID = 'grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

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
  const t = useT();
  return (
    <p className="mb-4 text-sm text-ink-2" role="status">
      {authorName ? (
        rich(t('Showing books by {author} for “{from}”.', { from: correction.from }), { author: <strong className="font-medium text-ink">{authorName}</strong> })
      ) : (
        <>
          {rich(t('Showing results for {to}.'), { to: <strong className="font-medium text-ink">{correction.to}</strong> })}{' '}
          <Link href={textSearchHref(correction.from, language, true)} className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
            {t('Search for “{from}” instead', { from: correction.from })}
          </Link>
        </>
      )}
    </p>
  );
}

export default function BookGrid({ searchQuery, language, exact = false, author }: BookGridProps) {
  const t = useT();
  // A retry has to change the request key, or the effect would not run again
  // and the reader would press a button that does nothing.
  const [attempt, setAttempt] = useState(0);
  const authorName = author?.name ?? '';
  const authorKey = author?.key ?? '';
  const key = author
    ? `author:${authorName}:${authorKey} #${attempt}`
    : searchQuery ? `${searchQuery} ${exact ? 'exact' : ''} #${attempt}` : '';
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /*
    Which search the reader unfolded "By other authors" for (ROADMAP 6.81).
    Keyed by the request, so a new search starts folded again without an
    effect resetting anything.
  */
  const [othersOpenFor, setOthersOpenFor] = useState<string | null>(null);
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
      // `lang` is not sent: since 6.60 (§6.1) it no longer filters the list,
      // it only rides along to the detail page as the tab to open.
      params.set('q', searchQuery);
      if (exact) params.set('exact', '1');
    }

    fetch(`/api/search?${params}`, { signal: controller.signal })
      .then(async res => {
        if (!res.ok) {
          setOutcome({ key, failure: await failureFor(res, t) });
          return;
        }
        setOutcome({ key, result: (await res.json()) as AnyResult });
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setOutcome({
          key,
          failure: { title: t('No connection'), detail: t('The search could not be sent. Check the connection and try again.'), retryable: true },
        });
      });

    return () => controller.abort();
  }, [key, searchQuery, exact, authorName, authorKey, pasted, router, t]);

  /*
    One summary of this search when the reader leaves it or asks another
    (ROADMAP 3.1b): outcome, number of books in classes, which card was
    clicked, and the words only when nothing was found (kept 90 days).
  */
  const answered = outcome?.key === key ? outcome : null;
  useSearchSignal({
    key,
    outcome: !answered ? null : answered.failure ? 'failed' : (answered.result as AnyResult | undefined)?.works.length ? 'results' : 'empty',
    results: (answered?.result as AnyResult | undefined)?.works.length ?? 0,
    mode: author ? 'author' : pasted.kind === 'isbn' ? 'isbn' : 'title',
    query: authorName || searchQuery,
    hrefs: () => [...document.querySelectorAll('[data-results] a[href^="/book/"]')].map(a => a.getAttribute('href') ?? ''),
  });

  if (!key) return <CuratedWall />;

  // Loading = the latest outcome does not answer the current request.
  const current = outcome?.key === key ? outcome : null;
  if (!current) return <GridSkeleton query={authorName || searchQuery} />;

  // An outcome carries a result or a failure, never both and never neither.
  if (!current.result) {
    const failure: Failure = current.failure ?? { title: t('Something went wrong'), detail: t('The search failed.'), retryable: true };
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
        <Notice title={t('No book under this ISBN')}>
          {t('The number is a valid ISBN, but Open Library has no edition recorded under it. Searching for the title and author usually finds the book anyway.')}
        </Notice>
      );
    }
    return (
      <Notice title={t('No books found')}>
        {t('Open Library knows nothing under this title. Try another spelling, or add the author.')}
        {/* A suggestion the catalogue was not asked about in time: offered, not claimed (N12). */}
        {correction && !correction.applied && (
          <>
            {' '}
            <Link href={textSearchHref(correction.to, language)} className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
              {t('Did you mean “{to}”?', { to: correction.to })}
            </Link>
          </>
        )}
      </Notice>
    );
  }

  const totalEditions = works.reduce((sum, w) => sum + (w.editionCount ?? 0), 0);
  // With several hits an ISBN matched nothing and these are loose text matches (6.29): no first author to group by.
  const { main, others } = shape.kind === 'isbn' && works.length > 1 ? { main: works, others: [] } : groupByAuthor(works);
  const othersOpen = othersOpenFor === key;
  const card = (work: (typeof works)[number]) => (
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
  );

  return (
    <section aria-label={t('Search results')} data-results>
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
        <Notice title={t('No edition under this ISBN')}>
          {t('Open Library has nothing recorded under this number and searched for the digits instead. What follows are text matches, not the book you are holding.')}
        </Notice>
      )}
      {correction?.applied && <CorrectionLine correction={correction} language={language} />}
      <p className="kicker mb-5">
        {works.length === 1 ? t('{n} book', { n: 1 }) : t('{n} books', { n: works.length })}, {t('{n} editions', { n: totalEditions })}
      </p>
      <div className={GRID}>{main.map(card)}</div>
      {/*
        The first card's author on top, everyone else below (ROADMAP 6.81,
        SPEC F1.11): "the great gatsby" returned twelve books by other authors
        among fifteen, most of them study guides called plainly "The Great
        Gatsby". Who wrote a book is on the record; whether it is *about* the
        novel is not, so the heading says only the first. Folded above four,
        and the cards are not even rendered until unfolded, so their mosaics
        do not load for a reader who never looks.
      */}
      {others.length > 0 && (
        <section className="mt-12 border-t border-line pt-6" aria-label={t('By other authors')}>
          {others.length <= OPEN_OTHERS ? (
            <h2 className="kicker">{t('By other authors ({n})', { n: others.length })}</h2>
          ) : (
            <button
              type="button"
              aria-expanded={othersOpen}
              onClick={() => setOthersOpenFor(othersOpen ? null : key)}
              className="hit kicker inline-flex items-center gap-2 transition-colors hover:text-ink"
            >
              <span aria-hidden="true" className={`inline-block text-accent transition-transform ${othersOpen ? 'rotate-90' : ''}`}>▸</span>
              {t('By other authors ({n})', { n: others.length })}
            </button>
          )}
          {(others.length <= OPEN_OTHERS || othersOpen) && <div className={`${GRID} mt-5`}>{others.map(card)}</div>}
        </section>
      )}
    </section>
  );
}

/**
 * The author mode's results (ROADMAP 6.60, SPEC F1.10): her books, most-printed
 * first, as the same cards a search shows. Two empty states, because they are
 * different facts: nobody under this name, or a person without a covered book.
 */
function AuthorResults({ result, typed, origin }: { result: AuthorSearchResult; typed: string; origin: ResultOrigin }) {
  const t = useT();
  const { works, author, correction } = result;
  if (!author) {
    return (
      <Notice title={t('No author found')}>
        {t('Open Library knows no one under this name. Try another spelling, or search titles and authors together.')}
        {typed && (
          <>
            {' '}
            <Link href={textSearchHref(typed, '')} className="text-accent underline decoration-line underline-offset-4 hover:decoration-accent">
              {t('Search “{q}” everywhere', { q: typed })}
            </Link>
          </>
        )}
      </Notice>
    );
  }
  if (works.length === 0) {
    return (
      <Notice title={t('No books by {author} with a cover', { author: author.name })}>
        {t('Open Library lists {author}, but none of the records under this name has a cover.', { author: author.name })}
      </Notice>
    );
  }
  const totalEditions = works.reduce((sum, w) => sum + (w.editionCount ?? 0), 0);
  return (
    <section aria-label={t('Books by {author}', { author: author.name })} data-results>
      {correction?.applied && <CorrectionLine correction={correction} language="" authorName={author.name} />}
      <h2 className="mb-1 text-2xl leading-tight text-ink sm:text-3xl">{t('Books by {author}', { author: author.name })}</h2>
      <p className="kicker mb-5">
        {works.length === 1 ? t('{n} book', { n: 1 }) : t('{n} books', { n: works.length })} {t('and {n} editions, the most printed first.', { n: totalEditions })}
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {works.map(work => (
          <BookWorkCard key={work.id} work={work} origin={{ ...origin, author: origin.author || author.name, authorKey: origin.authorKey || author.key }} />
        ))}
      </div>
    </section>
  );
}
