import Link from '@/components/Link';

/**
 * The link at the left of the header that leads one step back (ROADMAP 6.64).
 *
 * The book page said "‹ Results", the decade page "← The wall", a collection
 * "← Collections": three glyphs for one gesture (the review from outside,
 * 2026-09-28). Now one component draws the chevron and the hit area, and each
 * page keeps its own target and word — where it leads differs, how it looks
 * does not. Server and client pages both use it, so it takes the translated
 * label rather than translating itself.
 */
export default function BackLink({ href, label, title, truncate, wordBelowSm = true }: {
  href: string;
  label: string;
  title?: string;
  truncate?: boolean;
  /**
   * False when the header also carries a page's own button (the book page's
   * Share before a cover is chosen, ROADMAP 6.110a): at 375 px the row then
   * holds chevron, mark and wordmark, magnifier, language switch and that
   * button, and the word was the part that gave way — squeezed to 8 px with
   * its letters under the mark. Below `sm` only the chevron shows and the
   * word stays as the link's name; from `sm` up nothing changes.
   */
  wordBelowSm?: boolean;
}) {
  const word = truncate ? 'max-w-[9rem] truncate sm:max-w-[16rem]' : '';
  return (
    <Link
      href={href}
      title={title}
      aria-label={wordBelowSm ? undefined : label}
      className="inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-md py-1 pr-2 text-sm text-ink-2 transition-colors hover:text-ink"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {/* A wall's name is cut short: the header has a logo and a search beside it. */}
      <span className={`${word} ${wordBelowSm ? '' : 'hidden sm:inline'}`.trim() || undefined}>{label}</span>
    </Link>
  );
}
