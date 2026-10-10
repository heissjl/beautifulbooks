/**
 * The response headers that tell the browser what it may not do with the
 * site (ROADMAP 2.12, security review of 2026-10-02 §3). Pure; `next.config.ts`
 * sends them on every route.
 *
 * Until 2026-10-09 production sent only `strict-transport-security`. What is
 * added, and why each:
 *
 * - `X-Content-Type-Options: nosniff` — the browser trusts our content type
 *   instead of guessing from the bytes, so an uploaded "image" with a script
 *   in it is never run as a script. Readers do upload photos (5.11a).
 * - `Referrer-Policy: strict-origin-when-cross-origin` — a click to a shop
 *   tells the shop `https://buyitscovers.com`, not which book page the reader
 *   was on. The privacy notice says nothing about the reader goes along.
 * - `X-Frame-Options: DENY` and `frame-ancestors 'none'` — nobody may show
 *   the site inside a frame of theirs, which is what clickjacking needs.
 * - `Permissions-Policy` — camera, microphone, location and payment are off
 *   for the page and anything in it. The shelf photo takes a file through
 *   the file dialog (a phone offers its camera there itself), never the
 *   camera API, so nothing of ours needs them.
 * - `Content-Security-Policy-Report-Only` — where scripts, styles, images and
 *   connections may come from. **Report-only on purpose:** Next writes
 *   inline scripts of its own and Vercel's analytics loads beside them, so a
 *   rule that is one host short breaks the site silently. The browser sends
 *   each violation to `/api/csp` (one log line, nothing about the reader);
 *   after a week of reading, the policy can be enforced (follow-up in the
 *   roadmap). `'unsafe-inline'` for scripts is what Next needs without
 *   nonces; it weakens the policy and is noted, not hidden.
 *
 * The image hosts are the ones `lib/coverurl.ts` and the cover route may
 * hand to the browser directly: Open Library's cover host, which redirects
 * to the Internet Archive, and Google's book images.
 */
export interface Header { key: string; value: string }

/** Where the browser may load images from besides the site itself. */
export const IMAGE_HOSTS = [
  'https://covers.openlibrary.org',
  'https://*.archive.org',
  'https://books.google.com',
  'https://books.google.de',
] as const;

/** Where Vercel's web analytics sends its page views (the script itself is served from `/_vercel/`). */
export const CONNECT_HOSTS = ['https://vitals.vercel-insights.com'] as const;

export const CSP_REPORT_PATH = '/api/csp';

export function contentSecurityPolicy({ dev = false }: { dev?: boolean } = {}): string {
  // Turbopack and React's dev tools evaluate code at run time; production does not.
  const script = `'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`;
  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGE_HOSTS.join(' ')}`,
    "font-src 'self' data:",
    `connect-src 'self' ${CONNECT_HOSTS.join(' ')}`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
    'report-to csp',
  ].join('; ');
}

export function securityHeaders({ dev = false }: { dev?: boolean } = {}): Header[] {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    { key: 'Reporting-Endpoints', value: `csp="${CSP_REPORT_PATH}"` },
    { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy({ dev }) },
  ];
}
