import { NextRequest, NextResponse } from 'next/server';
import { newState, OAUTH_COOKIE, OAUTH_MAX_AGE, packPending, providerConfig, signinSecret } from '@/lib/walls/account';
import { authorizationUrl, redirectUri, verifierFor } from '@/lib/walls/oauth';
import { isProviderId, safeBack } from '@/lib/walls/signin';
import { signinEnabled } from '@/lib/walls/switch';
import { json, openWalls } from '../../guard';

/**
 * GET /api/walls/signin/<provider>?back=/c/<id> — starts the optional sign-in
 * (ROADMAP 5.13h, SPEC F9.11): a random state (and a PKCE verifier for Google)
 * in a short httpOnly cookie, then off to the provider. Nothing is stored.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const { provider } = await params;
  const config = isProviderId(provider) && signinEnabled() && signinSecret() ? providerConfig(provider) : null;
  if (!isProviderId(provider) || !config) return json({ error: 'Not found' }, 404);

  const state = newState();
  const verifier = verifierFor(provider);
  const back = safeBack(request.nextUrl.searchParams.get('back'));
  const url = authorizationUrl(config, redirectUri(request.nextUrl.origin, provider), state, verifier);
  const response = NextResponse.redirect(url, 303);
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(OAUTH_COOKIE, packPending({ provider, state, verifier, back }), {
    path: '/api/walls/signin',
    maxAge: OAUTH_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
