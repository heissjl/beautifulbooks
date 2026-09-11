'use client';

import { useSyncExternalStore } from 'react';

/** Tailwind's `lg`, the width at which the detail page grows a sidebar. */
const DESKTOP = '(min-width: 1024px)';

/**
 * Is there room for the sidebar?
 *
 * The detail page shows the selected cover's details in a sidebar on wide
 * screens and in a bottom sheet on narrow ones (SPEC §10 E13). Rendering both
 * and hiding one with CSS would load the cover image twice on the connection
 * that can least afford it, so the two are exclusive and this decides.
 *
 * The server answer is "desktop" by default, which is never seen: the wall
 * exists only after the first edition page has arrived in the browser. The
 * home page's ring of covers asks for "not desktop" instead, so the server
 * never renders it: its seven covers carry preload links, and a phone fetched
 * all seven for a picture it never showed (measured 2026-09-11, ROADMAP 1.9).
 */
export function useIsDesktop(serverAnswer = true): boolean {
  return useSyncExternalStore(
    onChange => {
      const query = window.matchMedia(DESKTOP);
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => serverAnswer,
  );
}
