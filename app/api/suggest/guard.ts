import { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import type { RateBucketName } from '@/lib/ratelimit';
import { ADMIN_COOKIE, adminMatches, adminSessionValid, SESSION_COOKIE, sessionValid, suggestEnabled } from '@/lib/suggest/auth';
import { suggestStoreFromEnv, type SuggestStore } from '@/lib/suggest/store';
import { missingStoreMessage } from '@/lib/hotornot/store';

/**
 * Who may use a suggestion route (ROADMAP 5.10a), each refusal said as
 * itself: switched off (404, as if it did not exist), too many requests
 * (429), not signed in (401), or no store on this deployment (503).
 */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

type Gate = { store: SuggestStore } | { response: NextResponse };

function open(request: NextRequest, allowed: boolean, bucket: RateBucketName): Gate {
  if (!suggestEnabled()) return { response: json({ error: 'Not found' }, 404) };
  const limited = rateLimited(request, bucket);
  if (limited) return { response: limited };
  if (!allowed) return { response: json({ error: 'Sign in first.' }, 401) };
  const store = suggestStoreFromEnv();
  if (!store) return { response: json({ error: missingStoreMessage() }, 503) };
  return { store };
}

/** A friend with the cookie from the password page. */
export function friendGate(request: NextRequest): Gate {
  return open(request, sessionValid(request.cookies.get(SESSION_COOKIE)?.value), 'suggest');
}

/** Julian's local tool, with the admin password as a bearer token. */
export function adminGate(request: NextRequest): Gate {
  const header = request.headers.get('authorization') ?? '';
  const allowed = adminMatches(header.replace(/^Bearer\s+/i, ''));
  // A wrong password spends from the narrow login bucket, so it cannot be
  // guessed at speed; the right one from the ordinary one, so that deciding
  // a dozen suggestions in a row is not refused as an attack.
  return open(request, allowed, allowed ? 'suggest' : 'login');
}

export const storeDown = () => json({ error: 'The suggestion store did not answer. Try again in a moment.' }, 503);

/**
 * A friend with the cookie **or** Julian's tool with the admin password —
 * the online curation tool (ROADMAP 5.10b) is used by both. A request with
 * neither spends from the narrow login bucket, like a wrong password.
 */
export function memberGate(request: NextRequest): { admin: boolean } | { response: NextResponse } {
  if (!suggestEnabled()) return { response: json({ error: 'Not found' }, 404) };
  const friend = sessionValid(request.cookies.get(SESSION_COOKIE)?.value);
  // Julian: the admin password as a bearer token (his local tool), or the
  // admin cookie from signing in on /curate (5.10g) — both, not only the first.
  const admin =
    adminMatches((request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')) ||
    adminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value);
  const limited = rateLimited(request, friend || admin ? 'suggest' : 'login');
  if (limited) return { response: limited };
  if (!friend && !admin) return { response: json({ error: 'Sign in first.' }, 401) };
  return { admin };
}
