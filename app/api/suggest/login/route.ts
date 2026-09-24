import { NextRequest } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import { readBody } from '@/app/api/versus/guard';
import { passwordMatches, SESSION_COOKIE, SESSION_DAYS, sessionToken, suggestEnabled } from '@/lib/suggest/auth';
import { json } from '../guard';

/**
 * The password in, a signed cookie out (ROADMAP 5.10a). The cookie holds an
 * expiry and a signature, nothing about the person; it is httpOnly, so no
 * script on the page can read it, and limited to what the tool needs.
 */
export async function POST(request: NextRequest) {
  if (!suggestEnabled()) return json({ error: 'Not found' }, 404);
  const limited = rateLimited(request, 'login');
  if (limited) return limited;
  const body = await readBody(request);
  if (!passwordMatches(body.password)) return json({ error: 'That is not the password.' }, 401);
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return response;
}
