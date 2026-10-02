import Link from 'next/link';

/**
 * The way to a reader's own wall (ROADMAP 5.13b), where a page shows walls
 * of covers anyway: the home page, the collections. Rendered by server
 * pages only, which decide the switch (`wallsEnabled`) before they call it.
 */
export default function WallsInvite({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-sm ${className}`}>
      <Link
        href="/create"
        className="inline-flex items-center gap-1.5 text-accent underline decoration-line underline-offset-4 transition-colors hover:decoration-accent"
      >
        {children}
      </Link>
    </p>
  );
}
