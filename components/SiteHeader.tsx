'use client';

import Link from '@/components/Link';
import BrandMark from '@/components/BrandMark';
import LocaleSwitcher from '@/components/LocaleSwitcher';
import { useT } from '@/components/i18n';
import { SITE_NAME } from '@/lib/seo';

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

/**
 * A client component since 6.85: the tagline and the language switch read the
 * locale from context, and the header is rendered inside `BookDetail`, a
 * client component, anyway.
 */
export default function SiteHeader({ left, right, search }: SiteHeaderProps) {
  const t = useT();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          {left}
          {/*
            A hair of tracking (Julian, 2026-10-02: „gib minimal mehr
            buchstabenabstand"): with `tracking-tight` the narrow italic set
            the two words 4.1 px apart and the name read as one; at 0.01em
            the gap is 4.8 px. `Wordmark` in app/og.tsx carries the same.
          */}
          <Link href="/" className="group flex shrink-0 items-center gap-2 font-display text-xl italic tracking-[0.01em] text-ink hover:text-accent transition-colors">
            {/* The mark keeps its own tones on hover, so the picked tile stays picked out. */}
            <BrandMark className="h-6 w-auto" />
            {SITE_NAME}
          </Link>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/*
            The two ways into the rest of the site (Julian, 2026-10-03, from his
            mockup: „Collections · Game · DE“), on every page from `sm` up. On a
            phone the row already holds the back link, the wordmark, the
            magnifier, the language switch and a share button; two more words
            did not fit at 390 px, and the home page offers both below the field.
          */}
          <nav aria-label={t('Site')} className="hidden items-center gap-5 pr-2 text-sm text-ink-2 sm:flex">
            <Link href="/collections" className="transition-colors hover:text-ink">{t('Collections')}</Link>
            <Link href="/versus" className="transition-colors hover:text-ink">{t('Game')}</Link>
          </nav>
          {search}
          {/* The language switch (6.85), last on the right except for a page's own button. */}
          <LocaleSwitcher />
          {right}
        </div>
      </div>
    </header>
  );
}
