'use client';

import Link from '@/components/Link';
import CoverMosaic from './CoverMosaic';
import { useCardCovers } from './useCardCovers';
import { storeWorkPreview } from './useWorkPreview';
import type { WorkSummary } from '@/lib/model';
import { useT } from './i18n';

/** The search a card was found by, carried to the detail page for its back link (SPEC F2.7). */
export interface ResultOrigin {
  query?: string;
  language?: string;
  /** The author mode (ROADMAP 6.60): `?author=<name>&key=OL…A`. */
  author?: string;
  authorKey?: string;
}

interface BookWorkCardProps {
  work: WorkSummary;
  origin?: ResultOrigin;
  /** Set when the search was an ISBN that found exactly this one book. */
  isbn?: string;
}

/**
 * Search results carry no edition data, so translators cannot be detected
 * there (SPEC §2.1). Lists of three or more names on Open Library are almost
 * always author + translators, so the card shows the primary author alone.
 */
export function displayAuthors(authors: readonly string[]): string {
  return authors.length > 2 ? authors[0] : authors.join(', ');
}

/**
 * Where a result card points.
 *
 * `isbn` is set only when the search was an ISBN that found a single book
 * (ROADMAP 6.29). It travels as its own parameter rather than being read back
 * out of `q`: the query is the reader's words and belongs to the search, and
 * a page that guessed at the shape of `q` a second time could disagree with
 * the first reading.
 */
export function detailHref(workId: string, query?: string, language?: string, isbn?: string, author?: { name?: string; key?: string }): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (language && language !== 'all') params.set('lang', language);
  if (isbn) params.set('isbn', isbn);
  if (author?.name) params.set('author', author.name);
  if (author?.key) params.set('key', author.key);
  const qs = params.toString();
  return qs ? `/book/${workId}?${qs}` : `/book/${workId}`;
}

export default function BookWorkCard({ work, origin = {}, isbn }: BookWorkCardProps) {
  // The search gives one cover; the rest of the mosaic is fetched once the
  // card nears the viewport (SPEC §9.3 step 14).
  const t = useT();
  const coverUrls = useCardCovers(work.id, work.coverUrls);
  const editionCount = work.editionCount ?? work.coverUrls.length;
  const href = detailHref(work.id, origin.query, origin.language, isbn, { name: origin.author, key: origin.authorKey });
  const facts = [
    editionCount > 1 ? t('{n} editions', { n: editionCount }) : undefined,
    work.languages.length > 1 ? t('{n} languages', { n: work.languages.length }) : undefined,
  ].filter(Boolean).join(' · ');

  return (
    <Link
      href={href}
      className="group block focus-visible:outline-none"
      onClick={() => storeWorkPreview(work.id, { title: work.title, authors: [displayAuthors(work.authors)], coverUrls })}
    >
      <div className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg">
        <CoverMosaic coverUrls={coverUrls} title={work.title} />
        {facts && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 text-xs font-medium text-white opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
            {facts}
          </div>
        )}
      </div>
      <div className="mt-3 space-y-0.5">
        <h3 className="line-clamp-2 font-sans text-[15px] font-medium leading-snug text-ink group-hover:text-accent transition-colors">
          {work.title}
        </h3>
        <p className="line-clamp-1 text-sm text-ink-2">{displayAuthors(work.authors)}</p>
        {work.firstPublishYear && <p className="text-xs text-ink-3">{work.firstPublishYear}</p>}
      </div>
    </Link>
  );
}
