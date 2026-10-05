import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/**
 * The site's link: `next/link` that does not prefetch (ROADMAP 2.18a).
 *
 * Next fetches every link that enters the viewport, and since Next 16 in
 * several requests per link. Measured in production on 2026-10-05, one visit
 * of 81 seconds rendered 14 book pages nobody opened — each a function run
 * with its catalogue requests — and asked for `/`, `/create` and `/versus`,
 * which render in a function on every call, four to six times each. A
 * collection of 198 books would prefetch 198 book pages while it scrolls.
 * That is function time and Open Library's patience spent on pages most
 * readers never open, so a page is fetched when it is asked for.
 *
 * A link that should warm its target on purpose passes `prefetch` itself or
 * calls `router.prefetch` on hover, as `DecadeLink` does. Import this, not
 * `next/link`: `lib/__tests__/link.test.ts` fails on a second importer.
 */
export default function Link(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}
