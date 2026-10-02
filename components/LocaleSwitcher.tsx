'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from './i18n';
import { LOCALE_COOKIE, LOCALE_NAME, LOCALES, type Locale } from '@/lib/i18n/locale';

/**
 * The language switch in the header (ROADMAP 6.82, E23). One small button
 * naming the *other* language, as Wikipedia does: on a 390 px phone the
 * header already holds the back link, the wordmark, the magnifier and the
 * share button, and two chips did not fit beside them.
 *
 * The choice is a cookie for a year and nothing else: no storage elsewhere,
 * nothing about the reader. `router.refresh()` re-renders the page, and
 * `proxy.ts` now serves it from the other tree.
 */
export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const other: Locale = LOCALES.find(l => l !== locale) ?? locale;
  const choose = (next: Locale) => {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };
  return (
    <button
      type="button"
      lang={other}
      onClick={() => choose(other)}
      className="shrink-0 rounded-md px-1.5 py-1 text-xs text-ink-2 transition-colors hover:text-ink"
      title={other === 'de' ? 'Diese Seite auf Deutsch lesen' : 'Read this site in English'}
    >
      {LOCALE_NAME[other]}
    </button>
  );
}
