import { SESSION_COOKIE, suggestEnabled } from '@/lib/suggest/auth';
import { json } from '../guard';

/**
 * Signs out of `/suggest` and `/curate` by clearing the cookie (ROADMAP 5.10b).
 * Added 2026-09-25 when Julian, signed in from an earlier visit, could not
 * tell that the password gate was there at all.
 */
export async function POST() {
  if (!suggestEnabled()) return json({ error: 'Not found' }, 404);
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
  return response;
}
