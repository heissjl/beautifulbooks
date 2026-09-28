import { NextRequest, NextResponse } from 'next/server';
import { hashAccount, OAUTH_COOKIE, providerConfig, signinSecret, stateMatches, unpackPending } from '@/lib/walls/account';
import { redirectUri, subjectFor } from '@/lib/walls/oauth';
import { hashVisitor, newVisitorId } from '@/lib/walls/owner';
import { isProviderId, safeBack, SIGNIN_NOTE_COOKIE, type SigninNote } from '@/lib/walls/signin';
import { signinEnabled } from '@/lib/walls/switch';
import { json, openWalls, setAccount, setVisitor, visitorOf } from '../../../guard';

/**
 * GET /api/walls/signin/<provider>/callback — the provider sends the reader
 * back here (ROADMAP 5.13h, SPEC F9.11, E23). The state must match the
 * cookie; the code is exchanged for the provider's subject id and nothing
 * else; the account is the hash of (provider, subject); this browser's
 * visitor id — a new one if it has none — is linked to the account, which
 * from now on owns every collection of every visitor linked to it.
 *
 * A failure goes back to the page with a one-minute note it can read, never
 * silently (N12). Nothing about the reader is logged.
 */
function back(request: NextRequest, path: string): NextResponse {
  const response = NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(OAUTH_COOKIE, '', { path: '/api/walls/signin', maxAge: 0 });
  return response;
}

function failed(request: NextRequest, path: string, note: SigninNote): NextResponse {
  const response = back(request, path);
  response.cookies.set(SIGNIN_NOTE_COOKIE, note, { path: '/', maxAge: 60, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return response;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const { provider } = await params;
  const secret = signinSecret();
  const config = isProviderId(provider) && signinEnabled() && secret ? providerConfig(provider) : null;
  if (!isProviderId(provider) || !config || !secret) return json({ error: 'Not found' }, 404);

  const q = request.nextUrl.searchParams;
  const pending = unpackPending(request.cookies.get(OAUTH_COOKIE)?.value);
  const path = safeBack(pending?.back);
  if (q.get('error')) return failed(request, path, 'cancelled');
  const code = q.get('code');
  if (!code || !stateMatches(pending, provider, q.get('state'))) return failed(request, path, 'failed');

  let subject: string;
  try {
    subject = await subjectFor(config, redirectUri(request.nextUrl.origin, provider), code, pending.verifier);
  } catch {
    return failed(request, path, 'failed');
  }

  const account = hashAccount(provider, subject);
  const existing = visitorOf(request);
  const visitor = existing ?? newVisitorId();
  try {
    await open.store.link(account, hashVisitor(visitor));
  } catch {
    return failed(request, path, 'failed');
  }
  const response = setAccount(back(request, path), { account, provider, issuedAt: Math.floor(Date.now() / 1000) }, secret);
  return existing ? response : setVisitor(response, visitor);
}
