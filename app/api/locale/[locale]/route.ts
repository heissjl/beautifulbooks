import { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { backTarget, isLocale, localeCookieOptions, LOCALE_COOKIE } from '@/lib/i18n/locale';

/**
 * GET /api/locale/<en|de>[?back=/path] — the language switch as a server
 * answer (ROADMAP 6.106, red team U6). The switch in the header is a plain
 * link to this route, so it works before the page has hydrated and without
 * JavaScript at all: in Chrome the first click on "Deutsch" three seconds
 * after loading did nothing while the button was still a dead `onClick`.
 *
 * Sets the cookie for a year and answers 303 back to where the reader was
 * (`backTarget`: the same-origin referer with its query, else a plain `back`
 * path, else `/`) — never to an address the request made up. `proxy.ts`
 * then serves the German tree for the same address. An unknown locale sets
 * nothing and only sends the reader back. `no-store`, and the route counts
 * nothing: the analytics never see it, and a 303 does not change the next
 * page's referrer.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const limited = rateLimited(request, 'locale');
  if (limited) return limited;
  const { locale } = await params;
  const target = backTarget(request.headers.get('referer'), request.nextUrl.searchParams.get('back'), request.nextUrl.origin);
  const response = NextResponse.redirect(new URL(target, request.nextUrl.origin), 303);
  response.headers.set('Cache-Control', 'no-store');
  if (isLocale(locale)) response.cookies.set(LOCALE_COOKIE, locale, localeCookieOptions());
  return response;
}
