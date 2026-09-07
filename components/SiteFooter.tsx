import Link from 'next/link';

/**
 * The same footer under every page (SPEC §10 B4).
 *
 * It carries the two sentences that must never be missing — where the images
 * come from, and that a purchase link can earn us something — plus the way to
 * the page that explains both at length.
 */
export default function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-ink-3 sm:px-6 lg:px-8">
        <p>Data from Open Library and Google Books. Cover images belong to their publishers.</p>
        <p className="flex items-center gap-4">
          <span>Purchase links may earn us a commission.</span>
          <Link href="/about" className="text-ink-2 underline underline-offset-2 hover:text-accent">
            About
          </Link>
        </p>
      </div>
    </footer>
  );
}
