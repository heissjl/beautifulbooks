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
export default function BackLink({ href, label, title, truncate }: { href: string; label: string; title?: string; truncate?: boolean }) {
  return (
    <Link
      href={href}
      title={title}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-md py-1 pr-2 text-sm text-ink-2 transition-colors hover:text-ink"
    >
      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {/* A wall's name is cut short: the header has a logo and a search beside it. */}
      {truncate ? <span className="max-w-[9rem] truncate sm:max-w-[16rem]">{label}</span> : label}
    </Link>
  );
}
