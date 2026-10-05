'use client';

import Link from '@/components/Link';
import { useT } from '@/components/i18n';
import { commerceEnabled } from '@/lib/sitemode';

/**
 * The footer as rendered (SPEC F6); `SiteFooter` is the server wrapper that
 * decides `walls`. Split in 6.85 so the sentences can be translated: the
 * switch for readers' walls can only be read on the server, the locale only
 * from the client context.
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
export default function SiteFooterView({ walls }: { walls: boolean }) {
  const t = useT();
  const link = 'text-ink-2 underline underline-offset-2 hover:text-accent';
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-ink-3 sm:px-6 lg:px-8">
        <p>{t('Data from Open Library and Google Books. Cover images belong to their publishers.')}</p>
        <p className="flex items-center gap-4">
          {commerceEnabled() && <span>{t('Purchase links may earn us a commission.')}</span>}
          {walls && <Link href="/create" className={link}>{t('Your collections')}</Link>}
          <Link href="/about" className={link}>{t('About')}</Link>
          <Link href="/contact" className={link}>Impressum</Link>
          <Link href="/privacy" className={link}>{t('Privacy')}</Link>
        </p>
      </div>
    </footer>
  );
}
