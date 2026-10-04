import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE, normalizeLocale, DEFAULT_LOCALE } from '@/lib/i18n/locale';

/**
 * Serves the site in the reader's language without changing its addresses
 * (ROADMAP 6.85, SPEC E23).
 *
 * A request carrying `locale=de` is rewritten to the mirrored tree under
 * `app/de/`, whose pages render the same modules with the German locale. The
 * address stays `/book/OL…W`; the cache key becomes `/de/book/OL…W`, so the
 * English page keeps its prerender and the German one is cached beside it.
 * Reading the cookie in the root layout instead would have turned every
 * route dynamic, which the book page's 24-hour prerender was kept out of on
 * purpose (app/book/[id]/cover/[coverId]/page.tsx).
 *
 * `/de/…` is never a public address: asked for directly it redirects to the
 * plain path, so no second copy of a page can be indexed.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/de' || pathname.startsWith('/de/')) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(3) || '/';
    return NextResponse.redirect(url, 308);
  }
  const locale = normalizeLocale(request.cookies.get(LOCALE_COOKIE)?.value) ?? DEFAULT_LOCALE;
  if (locale === DEFAULT_LOCALE) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  /*
    Pages only. Not the API, the image proxy, the click counter, Julian's
    analytics (German only, no mirror under /de), Next's own
    files, anything with an extension, nor the generated images and feeds that
    have none (`/opengraph-image`, `/sitemap.xml` has one, `/icon.svg` too).
  */
  matcher: ['/((?!api/|img/|go/|admin/|_next/|.*\\..*|.*/opengraph-image$|opengraph-image$).*)'],
};
