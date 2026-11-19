'use client';

import { useLinkStatus } from './Link';

/**
 * A small ring beside a link's words while the page it leads to is on its way
 * (ROADMAP 6.114). Links do not prefetch (2.18a), so a heavy page such as the
 * collections hub can take seconds on a phone; without a sign the tap looks
 * like it did nothing (Julian, 2026-11-19). Must sit inside a `Link`. Takes no
 * room when idle, so the line does not move.
 */
/** `before` for a link at the screen's right edge, where a ring after it would leave the page. */
export default function LinkPending({ before = false }: { before?: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span aria-hidden="true" className="relative inline-block w-0 align-middle">
      {pending && (
        <span className={`absolute top-1/2 ${before ? 'right-1.5' : 'left-1.5'} block h-3 w-3 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-accent`} />
      )}
    </span>
  );
}
