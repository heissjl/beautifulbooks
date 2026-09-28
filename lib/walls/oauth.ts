/**
 * The three providers of the optional sign-in (ROADMAP 5.13h, SPEC F9.11).
 * Server only. Arctic (MIT, three small dependencies) builds the authorization
 * URLs and exchanges the code; everything after — the account hash, the
 * session, the link to a visitor — is ours, in lib/walls/account.ts.
 *
 * Each provider is asked for the least it will give: Google `openid` (no
 * `email`, no `profile`), Apple no scope (so no name and no email, and the
 * answer comes back as a GET, which keeps the `SameSite=Lax` state cookie
 * working), Meta no scope beyond its implicit public profile, of which only
 * the app-scoped `id` is read.
 */
import { Apple, Facebook, generateCodeVerifier, Google, type OAuth2Tokens } from 'arctic';
import { subjectFromIdToken, type ProviderConfig } from './account';
import type { ProviderId } from './signin';

export function redirectUri(origin: string, provider: ProviderId): string {
  return `${origin}/api/walls/signin/${provider}/callback`;
}

/** An Apple key as downloaded (.p8, PEM), with real or escaped newlines, to PKCS#8 bytes. */
export function pkcs8FromPem(pem: string): Uint8Array {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  return new Uint8Array(Buffer.from(body, 'base64'));
}

function client(config: ProviderConfig, redirect: string) {
  if (config.id === 'google') return new Google(config.clientId, config.clientSecret, redirect);
  if (config.id === 'apple') return new Apple(config.clientId, config.teamId, config.keyId, pkcs8FromPem(config.privateKey), redirect);
  return new Facebook(config.clientId, config.clientSecret, redirect);
}

/** A PKCE verifier for the providers that take one (Google); empty for the others. */
export function verifierFor(provider: ProviderId): string {
  return provider === 'google' ? generateCodeVerifier() : '';
}

export function authorizationUrl(config: ProviderConfig, redirect: string, state: string, verifier: string): URL {
  const c = client(config, redirect);
  if (c instanceof Google) return c.createAuthorizationURL(state, verifier, ['openid']);
  return c.createAuthorizationURL(state, []);
}

export class SigninError extends Error {}

/** Exchanges the code and answers the provider's subject id — nothing else is read. Throws SigninError. */
export async function subjectFor(config: ProviderConfig, redirect: string, code: string, verifier: string): Promise<string> {
  const c = client(config, redirect);
  let tokens: OAuth2Tokens;
  try {
    tokens = c instanceof Google ? await c.validateAuthorizationCode(code, verifier) : await c.validateAuthorizationCode(code);
  } catch (err) {
    throw new SigninError(`token exchange failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const read = (f: () => string): string | null => {
    try {
      return f();
    } catch {
      return null;
    }
  };
  let subject: string | null = null;
  if (config.id === 'google') {
    subject = subjectFromIdToken(read(() => tokens.idToken()), { issuers: ['https://accounts.google.com', 'accounts.google.com'], audience: config.clientId });
  } else if (config.id === 'apple') {
    subject = subjectFromIdToken(read(() => tokens.idToken()), { issuers: ['https://appleid.apple.com'], audience: config.clientId });
  } else {
    const access = read(() => tokens.accessToken());
    if (!access) throw new SigninError('no access token in the answer');
    const res = await fetch('https://graph.facebook.com/v16.0/me?fields=id', {
      headers: { authorization: `Bearer ${access}` },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    const body = res && res.ok ? ((await res.json().catch(() => null)) as { id?: unknown } | null) : null;
    subject = typeof body?.id === 'string' && body.id.length > 0 ? body.id : null;
  }
  if (!subject) throw new SigninError('no subject in the answer');
  return subject;
}
