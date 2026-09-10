import Link from 'next/link';

interface SiteHeaderProps {
  /** Optional left slot, e.g. a back link on detail pages. */
  left?: React.ReactNode;
  /** Optional right slot, e.g. a share button. */
  right?: React.ReactNode;
  /**
   * The search field (ROADMAP 6.28), on every page that is not the search
   * itself. `relative` below is for it: on a phone the field opens over this
   * row rather than pushing the wordmark out of it.
   */
  search?: React.ReactNode;
}

export default function SiteHeader({ left, right, search }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          {left}
          <Link href="/" className="font-display text-xl italic tracking-tight text-ink hover:text-accent transition-colors">
            Beautiful Books
          </Link>
        </div>
        {/* The tagline is decoration and yields the room to the field. */}
        {!search && <p className="hidden text-sm text-ink-3 md:block">Covers, side by side.</p>}
        <div className="ml-auto flex items-center gap-2">
          {search}
          {right}
        </div>
      </div>
    </header>
  );
}
