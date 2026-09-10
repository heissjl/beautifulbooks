import MosaicLoader from '@/components/MosaicLoader';
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
 * **The same picture as the search** (Julian, 2026-09-10: „baue den
 * Ladebildschirm auch ein für das Laden beim Wechsel von Coverwall zu Decade
 * Wall"), so a wait looks like a wait everywhere on the site — and the reader
 * keeps the author they were given for this session, because `MosaicLoader`
 * draws the template once and remembers it.
 *
 * This is the wait the mosaic was built for. A search comes back in one or
 * two seconds far more often than in ten, so the animation there is usually
 * cut off; here it has 4.5 to 12.9 s and runs to the end, and then holds the
 * finished face until the page arrives.
 *
 * No back link: the header's own is enough, and a link to a page that is
 * still assembling would be a second thing to reason about.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-8 sm:px-6">
        {/* Same rhythm as the finished page: a title-sized block, then the picture. */}
        <div className="h-9 w-2/3 max-w-md animate-pulse rounded-md bg-surface-2 sm:h-10" />
        <div className="mt-3 h-4 w-40 animate-pulse rounded-md bg-surface-2" />
        <MosaicLoader caption="Sorting these covers by decade" />
      </main>
    </div>
  );
}
