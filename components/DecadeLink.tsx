'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

/**
 * The link to a work's decade page, which fetches that page ahead of time
 * when a mouse comes to rest on it (Julian, 2026-09-09: „vorladen bei absicht
 * nur wenn der link überfahren wird (desktop) und mobile nie").
 *
 * **What is prefetched is the page, not its pictures.** The decade page
 * renders on the server and that is where the seconds go — 9.6 s locally and
 * 12.9 s in production on 2026-09-09, against images that lazy-load as the
 * reader scrolls. Warming the render is worth a request; warming a hundred
 * covers nobody asked for is not, on a phone least of all.
 *
 * **Never on a touch screen.** `prefetch={false}` turns off Next's own
 * viewport prefetching, and the hover handler only fires where the browser
 * reports a real pointer: mobile browsers do send `mouseenter` on a tap, and
 * a prefetch there would spend a reader's data on the page they are already
 * navigating to.
 */
export default function DecadeLink({ workId }: { workId: string }) {
  const router = useRouter();
  const done = useRef(false);

  const warm = () => {
    if (done.current) return;
    // A coarse pointer is a finger; matchMedia is the only honest test here,
    // since a touch device happily reports mouse events.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    done.current = true;
    router.prefetch(`/book/${workId}/decades`);
  };

  return (
    <p>
      <Link
        href={`/book/${workId}/decades`}
        prefetch={false}
        onMouseEnter={warm}
        onFocus={warm}
        className="text-sm text-accent hover:underline"
      >
        See these covers by decade →
      </Link>
    </p>
  );
}
