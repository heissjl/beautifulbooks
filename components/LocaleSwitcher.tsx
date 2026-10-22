'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from './i18n';
import { localeCookieString, LOCALE_NAME, LOCALES, type Locale } from '@/lib/i18n/locale';

/**
 * The language switch in the header (ROADMAP 6.85, E23). One small control
 * naming the *other* language, as Wikipedia does: on a 390 px phone the
 * header already holds the back link, the wordmark, the magnifier and the
 * share button, and two chips did not fit beside them.
 *
 * A link, not a button (ROADMAP 6.106, red team U6): before the page has
 * hydrated an `onClick` is dead, and in Chrome the first click three seconds
 * after loading did nothing. The link's target `/api/locale/<other>` sets the
 * cookie on the server and answers 303 back to this page — it works without
 * JavaScript. Once hydrated the handler takes over and does the same without
 * a reload: cookie in the browser, `router.refresh()`, and `proxy.ts` serves
 * the other tree. Both writers use the one attribute list in lib/i18n/locale.
 *
 * `usePathname`, never `useSearchParams`: the header is on every page, and
 * reading the query here would turn each static page dynamic. The query is
 * kept anyway — the server prefers the referer, which carries it.
 *
 * The choice is a cookie for a year and nothing else: no storage elsewhere,
 * nothing about the reader.
 */
export default function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  // Under the German rewrite the server sees `/de/about` while the browser's address is `/about`:
  // strip the tree prefix so both render the same href, or hydration would disagree.
  const pathname = (usePathname() ?? '/').replace(/^\/de(?=\/|$)/, '') || '/';
  const other: Locale = LOCALES.find(l => l !== locale) ?? locale;
  const href = `/api/locale/${other}?back=${encodeURIComponent(pathname)}`;
  const choose = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // A modified click (new tab) keeps the browser's own behaviour; the route answers it just as well.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    document.cookie = localeCookieString(other);
    router.refresh();
  };
  return (
    <a
      href={href}
      rel="nofollow"
      lang={other}
      onClick={choose}
      className="hit inline-flex shrink-0 items-center rounded-md px-1.5 py-1 text-xs text-ink-2 transition-colors hover:text-ink"
      title={other === 'de' ? 'Diese Seite auf Deutsch lesen' : 'Read this site in English'}
    >
      {LOCALE_NAME[other]}
    </a>
  );
}
