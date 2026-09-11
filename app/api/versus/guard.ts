import { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import type { RateBucketName } from '@/lib/ratelimit';
import { versusEnabled } from '@/lib/hotornot/switch';
import { missingStoreMessage, storeFromEnv, type VoteStore } from '@/lib/hotornot/store';

/**
 * The three reasons the cover game may not run, each said as itself
 * (ROADMAP 5.8a): switched off (404, as if it did not exist), too many
 * requests (429), or no store on this deployment (503, naming the variables
 * it looked for and never their values). A game without a store must not
 * pretend to take votes.
 */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function openGame(request: NextRequest, bucket: RateBucketName): { store: VoteStore } | { response: NextResponse } {
  if (!versusEnabled()) return { response: json({ error: 'Not found' }, 404) };
  const limited = rateLimited(request, bucket);
  if (limited) return { response: limited };
  const store = storeFromEnv();
  if (!store) return { response: json({ error: missingStoreMessage() }, 503) };
  return { store };
}

export const storeDown = () => json({ error: 'The vote store did not answer. Try again in a moment.' }, 503);

/** A JSON body, or an empty object for anything that is not one. */
export async function readBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
