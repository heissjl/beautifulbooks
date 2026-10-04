'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

/**
 * The decade page when the catalogue did not answer (ROADMAP 6.43, 6.71).
 *
 * The page throws rather than render a part of the book, so a silent
 * catalogue is said as such and nothing is cached: ISR keeps the last good
 * version where there is one, and this page is never stored. Same words as
 * the work page's (6.75).
 */
export default function DecadesError({ reset }: { error: Error; reset: () => void }) {
  const { id } = useParams<{ id: string }>();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-24 text-center sm:px-6">
      <p className="font-display text-2xl text-ink">Open Library did not answer</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
        The catalogue this page is built from is slow or down at the moment. That says nothing about the book.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
        <button type="button" onClick={reset} className="btn btn-accent">Try again</button>
        <Link href={`/book/${id}`} className="text-sm text-accent hover:underline">The wall</Link>
      </div>
    </main>
  );
}
