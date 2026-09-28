import { NextRequest, NextResponse } from 'next/server';
import { rateLimited } from '@/app/api/rate';
import type { RateBucketName } from '@/lib/ratelimit';
import { missingStoreMessage } from '@/lib/hotornot/store';
import { isVisitorId } from '@/lib/walls/model';
import { VISITOR_COOKIE, VISITOR_MAX_AGE } from '@/lib/walls/owner';
import { wallStoreFromEnv, type WallStore } from '@/lib/walls/store';
import { wallsEnabled } from '@/lib/walls/switch';

/**
 * The reasons a wall route may not run, each said as itself (as the cover
 * game's guard does): switched off (404), too many requests (429), no store
 * on this deployment (503).
 */
export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function openWalls(request: NextRequest, bucket: RateBucketName = 'walls'): { store: WallStore } | { response: NextResponse } {
  if (!wallsEnabled()) return { response: json({ error: 'Not found' }, 404) };
  const limited = rateLimited(request, bucket);
  if (limited) return { response: limited };
  const store = wallStoreFromEnv();
  if (!store) return { response: json({ error: missingStoreMessage() }, 503) };
  return { store };
}

export const storeDown = () => json({ error: 'The store did not answer. Try again in a moment.' }, 503);

export function visitorOf(request: NextRequest): string | null {
  const value = request.cookies.get(VISITOR_COOKIE)?.value;
  return isVisitorId(value) ? value : null;
}

/** Readable by the page on purpose: the footer shows the id (E22). */
export function setVisitor(response: NextResponse, visitor: string): NextResponse {
  response.cookies.set(VISITOR_COOKIE, visitor, { path: '/', maxAge: VISITOR_MAX_AGE, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
  return response;
}

/**
 * A write must arrive as JSON. A cross-site form cannot send that without a
 * preflight, and `SameSite=Lax` keeps the cookie off a cross-site POST anyway.
 */
export async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return null;
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}
