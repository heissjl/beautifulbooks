/**
 * Accounts for readers' collections (ROADMAP 5.13h, SPEC F9.11, E23). Server
 * only: it hashes and signs.
 *
 * An account is nothing but a hash of (provider, the provider's subject id).
 * Signing in links this browser's visitor id (E22) to that account, so the
 * account owns every collection of every visitor linked to it — taketest's
 * "signing in on a device that already has results moves them onto the
 * account". The store keeps the account hash and the visitor hashes, never
 * a raw id, an email address, a name or a picture; the providers are asked
 * for the subject id only (scope `openid` at Google, none at Apple and Meta).
 *
 * The session is a cookie signed with `WALLS_SIGNIN_SECRET`, holding the
 * account hash, the provider's name and the time of signing in. No session
 * table: signing out deletes the cookie.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { signinEnabled } from './switch';
import { isProviderId, PROVIDER_LABELS, PROVIDER_ORDER, type ProviderId, type SigninOption } from './signin';

type Env = Record<string, string | undefined>;

export const ACCOUNT_COOKIE = 'bb_account';
/** Half a year; the visitor cookie keeps its two years (E22). */
export const ACCOUNT_MAX_AGE = 60 * 60 * 24 * 182;
/** The state of one sign-in on its way through the provider: ten minutes. */
export const OAUTH_COOKIE = 'bb_oauth';
export const OAUTH_MAX_AGE = 60 * 10;

export function hashAccount(provider: ProviderId, subject: string): string {
  return createHash('sha256').update(`account:${provider}:${subject}`).digest('hex');
}

/* ---------------------------------------------------------------- credentials */

export type ProviderConfig =
  | { id: 'google'; clientId: string; clientSecret: string }
  | { id: 'apple'; clientId: string; teamId: string; keyId: string; privateKey: string }
  | { id: 'facebook'; clientId: string; clientSecret: string };

const val = (env: Env, name: string): string => (env[name] ?? '').trim();

/** A provider's credentials, or null when any is missing — then its button does not show. */
export function providerConfig(id: ProviderId, env: Env = process.env): ProviderConfig | null {
  if (id === 'google') {
    const clientId = val(env, 'GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = val(env, 'GOOGLE_OAUTH_CLIENT_SECRET');
    return clientId && clientSecret ? { id, clientId, clientSecret } : null;
  }
  if (id === 'apple') {
    const clientId = val(env, 'APPLE_SIGNIN_CLIENT_ID');
    const teamId = val(env, 'APPLE_SIGNIN_TEAM_ID');
    const keyId = val(env, 'APPLE_SIGNIN_KEY_ID');
    const privateKey = val(env, 'APPLE_SIGNIN_PRIVATE_KEY');
    return clientId && teamId && keyId && privateKey ? { id, clientId, teamId, keyId, privateKey } : null;
  }
  const clientId = val(env, 'FACEBOOK_APP_ID');
  const clientSecret = val(env, 'FACEBOOK_APP_SECRET');
  return clientId && clientSecret ? { id, clientId, clientSecret } : null;
}

/** The session key; shorter than 32 characters counts as unset, so a placeholder never signs anything. */
export function signinSecret(env: Env = process.env): string | null {
  const s = val(env, 'WALLS_SIGNIN_SECRET');
  return s.length >= 32 ? s : null;
}

/** The buttons a page may show: sign-in on, a secret set, and the provider's credentials present. */
export function signinOptions(env: Env = process.env): SigninOption[] {
  if (!signinEnabled(env) || !signinSecret(env)) return [];
  return PROVIDER_ORDER.filter((id) => providerConfig(id, env)).map((id) => ({ id, label: PROVIDER_LABELS[id] }));
}

/* -------------------------------------------------------------------- session */

export interface Session {
  /** The account hash. */
  account: string;
  provider: ProviderId;
  /** Seconds since the epoch, when the reader signed in. */
  issuedAt: number;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');
const mac = (payload: string, secret: string) => createHmac('sha256', secret).update(`bb-session:${payload}`).digest();

export function signSession(session: Session, secret: string): string {
  const payload = b64url(JSON.stringify({ a: session.account, p: session.provider, t: session.issuedAt }));
  return `${payload}.${b64url(mac(payload, secret))}`;
}

/** The session in a cookie, or null when it is absent, forged, malformed or older than ACCOUNT_MAX_AGE. */
export function readSession(token: unknown, secret: string | null, nowSeconds: number = Math.floor(Date.now() / 1000)): Session | null {
  if (!secret || typeof token !== 'string' || token.length > 400) return null;
  const [payload, sig, extra] = token.split('.');
  if (!payload || !sig || extra !== undefined) return null;
  const given = Buffer.from(sig, 'base64url');
  const expected = mac(payload, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const raw = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { a?: unknown; p?: unknown; t?: unknown };
    if (typeof raw.a !== 'string' || !/^[0-9a-f]{64}$/.test(raw.a) || !isProviderId(raw.p) || typeof raw.t !== 'number') return null;
    if (raw.t > nowSeconds + 60 || nowSeconds - raw.t > ACCOUNT_MAX_AGE) return null;
    return { account: raw.a, provider: raw.p, issuedAt: raw.t };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- one sign-in in flight */

export interface Pending {
  provider: ProviderId;
  state: string;
  /** PKCE verifier (Google); empty for providers without PKCE. */
  verifier: string;
  back: string;
}

export const newState = (bytes: Buffer = randomBytes(24)) => bytes.toString('base64url');

export function packPending(p: Pending): string {
  return b64url(JSON.stringify(p));
}

export function unpackPending(raw: unknown): Pending | null {
  if (typeof raw !== 'string' || raw.length > 1200) return null;
  try {
    const p = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Pending>;
    if (!isProviderId(p.provider) || typeof p.state !== 'string' || p.state.length < 16) return null;
    if (typeof p.verifier !== 'string' || typeof p.back !== 'string') return null;
    return { provider: p.provider, state: p.state, verifier: p.verifier, back: p.back };
  } catch {
    return null;
  }
}

/** The state the provider sent back must be the one this browser started with — the CSRF check of OAuth. */
export function stateMatches(pending: Pending | null, provider: ProviderId, state: unknown): pending is Pending {
  if (!pending || pending.provider !== provider || typeof state !== 'string') return false;
  const a = Buffer.from(pending.state);
  const b = Buffer.from(state);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ------------------------------------------------------------------- id token */

export interface IdTokenCheck {
  issuers: readonly string[];
  audience: string;
}

/**
 * The subject of an ID token that came straight from the provider's token
 * endpoint over TLS. OpenID Connect Core 3.1.3.7 lets TLS stand in for the
 * signature in that case; issuer, audience and expiry are still checked here,
 * so a token minted for another app is refused. Nothing else in it is read.
 */
export function subjectFromIdToken(idToken: unknown, check: IdTokenCheck, nowSeconds: number = Math.floor(Date.now() / 1000)): string | null {
  if (typeof idToken !== 'string') return null;
  const parts = idToken.split('.');
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { iss?: unknown; aud?: unknown; exp?: unknown; sub?: unknown };
    if (typeof claims.iss !== 'string' || !check.issuers.includes(claims.iss)) return null;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(check.audience)) return null;
    if (typeof claims.exp !== 'number' || claims.exp < nowSeconds - 60) return null;
    if (typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 255) return null;
    return claims.sub;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------- linking */

/** Every owner hash this browser speaks for: its own visitor's and those its account linked. */
export function ownerHashes(visitorHash: string | null, linked: readonly string[]): string[] {
  return [...new Set([...(visitorHash ? [visitorHash] : []), ...linked])];
}
