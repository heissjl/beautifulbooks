import Link from 'next/link';
import { commerceEnabled } from '@/lib/sitemode';

/**
 * The same footer under every page (SPEC F6).
 *
 * It carries the sentences that must never be missing — where the images
 * come from, and, in shop mode only, that a purchase link can earn us
 * something — plus the way to the pages that explain both at length and to
 * the legal notice and privacy notice, which must be one click away from
 * everywhere (§ 18 Abs. 1 MStV: "unmittelbar erreichbar").
 *
 * In hobby mode (E20) the commission sentence is left out rather than
 * softened: no link earns anything, and saying "may" would be untrue (N12).
 */
export default function SiteFooter() {
  const link = 'text-ink-2 underline underline-offset-2 hover:text-accent';
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-ink-3 sm:px-6 lg:px-8">
        <p>Data from Open Library and Google Books. Cover images belong to their publishers.</p>
        <p className="flex items-center gap-4">
          {commerceEnabled() && <span>Purchase links may earn us a commission.</span>}
          <Link href="/about" className={link}>About</Link>
          <Link href="/contact" className={link}>Impressum</Link>
          <Link href="/privacy" className={link}>Privacy</Link>
        </p>
      </div>
    </footer>
  );
}
