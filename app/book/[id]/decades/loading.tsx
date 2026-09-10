import AssemblingWall from '@/components/AssemblingWall';
import HeaderSearch from '@/components/HeaderSearch';
import SiteHeader from '@/components/SiteHeader';

/**
 * What the reader sees while the decade page is being built (Julian,
 * 2026-09-09: „die decade wall braucht auch eine kurze ladeseite").
 *
 * This page is rendered on the server and takes seconds when the catalogue is
 * cold — 4.5 s locally, 12.9 s in production on 2026-09-09. Without a
 * `loading.tsx` the browser sits on the previous page for that whole time and
 * the link looks broken; with one, the shell and this wall appear at once and
 * the page streams in behind it.
 *
 * The same picture as the search and the cover wall use, so a wait looks like
 * a wait everywhere on the site. No back link here: the header's own is
 * enough, and a link to a page that is still assembling would be a second
 * thing to reason about.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader search={<HeaderSearch />} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        {/* Same rhythm as the finished page: a title-sized block, then the wall. */}
        <div className="h-9 w-2/3 max-w-md animate-pulse rounded-md bg-surface-2 sm:h-10" />
        <div className="mt-3 h-4 w-40 animate-pulse rounded-md bg-surface-2" />
        <AssemblingWall caption="Sorting these covers by decade" tiles={12} />
      </main>
    </div>
  );
}
