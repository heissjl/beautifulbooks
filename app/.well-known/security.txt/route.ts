import { readImprint } from '@/lib/imprint';

/**
 * `/.well-known/security.txt` (RFC 9116, ROADMAP 2.12): where someone who
 * finds a security fault can write. The address is the legal notice's, read
 * from `IMPRINT_EMAIL` and never from the repository (lib/imprint.ts). The
 * file must carry an `Expires` line less than a year ahead, so it is
 * rendered per request rather than at build time.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const { email } = readImprint();
  const expires = new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString();
  const body = [
    `Contact: mailto:${email}`,
    `Expires: ${expires}`,
    'Preferred-Languages: en, de',
    'Canonical: https://buyitscovers.com/.well-known/security.txt',
    '',
  ].join('\n');
  return new Response(body, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
}
