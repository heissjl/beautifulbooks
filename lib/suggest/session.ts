/**
 * Whether this request comes from a friend signed in on /suggest or /curate
 * (ROADMAP 5.10a, 5.10b). Server only; reads the request's cookie.
 *
 * Kept apart from `auth.ts` because it imports `next/headers`, which only a
 * request can answer, while `auth.ts` stays pure and testable.
 */
import { cookies } from 'next/headers';
import { SESSION_COOKIE, sessionValid } from './auth';

export async function friendSignedIn(): Promise<boolean> {
  return sessionValid((await cookies()).get(SESSION_COOKIE)?.value);
}
