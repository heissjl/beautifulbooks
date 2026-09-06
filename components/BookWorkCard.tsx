'use client';

import Link from 'next/link';
import CoverMosaic from './CoverMosaic';
import type { WorkSummary } from '@/lib/model';

interface BookWorkCardProps {
  work: WorkSummary;
  /** Current search state, carried to the detail page for its back link (SPEC F2.7). */
  query?: string;
  language?: string;
}

/**
 * Search results carry no edition data, so translators cannot be detected
 * there (SPEC §2.1). Lists of three or more names on Open Library are almost
 * always author + translators, so the card shows the primary author alone.
 */
export function displayAuthors(authors: readonly string[]): string {
  return authors.length > 2 ? authors[0] : authors.join(', ');
}

export function detailHref(workId: string, query?: string, language?: string): string {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (language && language !== 'all') params.set('lang', language);
  const qs = params.toString();
  return qs ? `/book/${workId}?${qs}` : `/book/${workId}`;
}

export default function BookWorkCard({ work, query, language }: BookWorkCardProps) {
  const editionCount = work.editionCount ?? work.coverUrls.length;
  const href = detailHref(work.id, query, language);
  const facts = [
    editionCount > 1 ? `${editionCount} editions` : undefined,
    work.languages.length > 1 ? `${work.languages.length} languages` : undefined,
  ].filter(Boolean).join(' · ');

  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <div className="cover-shadow relative aspect-[2/3] overflow-hidden rounded-card bg-surface-2 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg">
        <CoverMosaic coverUrls={work.coverUrls} title={work.title} />
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
