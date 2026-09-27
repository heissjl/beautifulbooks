'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import CoverWall from './CoverWall';
import { useAuthorWorks } from './useAuthorWorks';
import { useIsDesktop } from './useIsDesktop';
import { authorRowHeading, authorSearchHref, excludeCurrent, ROW_DESKTOP, ROW_PHONE } from '@/lib/authorworks';

interface AuthorWorksProps {
  /** The work's first author, as the page shows her (Julian, 2026-09-26: only the first). */
  author: string;
  /** Her Open Library key; without one the row asks nothing and shows only the line. */
  authorKey?: string;
  workId: string;
  workTitle: string;
  siblingIds?: readonly string[];
  /** The wall has finished loading: ask even if the reader has not scrolled down (plan §3.5). */
  settled?: boolean;
  className?: string;
}

/** Literal strings, so Tailwind sees them. Three on a phone, six from `lg`. */
const GRID = 'grid grid-cols-3 gap-4 lg:grid-cols-6 lg:gap-6';

/**
 * "More by <author>" under a wall (ROADMAP 6.53, SPEC F2.15).
 *
 * Nothing shows until the row comes near the screen or the wall is done,
 * because nothing is asked before then. After that the heading is always a
 * link to the site's search for her, and the tiles appear only when Open
 * Library answered with at least one other work. **Silence and an empty
 * answer both leave just the line** (Julian, 2026-09-26): it points somewhere
 * and claims nothing about the catalogue, so it never reads as "no other
 * works" (SPEC N12).
 */
export default function AuthorWorks({ author, authorKey, workId, workTitle, siblingIds, settled = false, className = '' }: AuthorWorksProps) {
  const [near, setNear] = useState(false);
  const isDesktop = useIsDesktop();

  /*
    A callback ref, not a ref object (react-hooks/refs): the observer attaches
    when the sentinel mounts and lets go once the row has come near.
  */
  const sentinel = useCallback((element: HTMLElement | null) => {
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const enabled = near || settled;
  const state = useAuthorWorks(authorKey, enabled);

  if (!enabled) return <div ref={sentinel} className={`mt-16 h-px ${className}`} aria-hidden="true" />;

  const limit = isDesktop ? ROW_DESKTOP : ROW_PHONE;
  const works = state.status === 'ready'
    ? excludeCurrent(state.works, { id: workId, title: workTitle, siblingIds }, limit)
    : [];
  const loading = state.status === 'loading';

  return (
    <section className={`mt-16 ${className}`} aria-label={authorRowHeading(author)}>
      <h2 className="text-xl leading-tight text-ink sm:text-2xl">
        <Link href={authorSearchHref(author, authorKey)} className="transition-colors hover:text-accent">
          {authorRowHeading(author)} <span aria-hidden="true">→</span>
        </Link>
      </h2>
      {loading && (
        <ul className={`mt-5 ${GRID}`} aria-hidden="true">
          {Array.from({ length: limit }, (_, i) => (
            <li key={i}>
              <div className="aspect-[2/3] animate-pulse rounded-card bg-surface-2" />
              <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-surface-2" />
            </li>
          ))}
        </ul>
      )}
      {works.length > 0 && (
        <div className="mt-5">
          <CoverWall
            works={works.map(w => ({ id: w.id, title: w.title, author, coverId: w.coverId }))}
            hideAuthor
            gridClassName={GRID}
          />
        </div>
      )}
    </section>
  );
}
