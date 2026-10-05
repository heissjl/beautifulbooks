import { NextRequest } from 'next/server';
import { parseSeed } from '@/lib/walls/order';
import { readersPage } from '@/lib/walls/store';
import { json, openWalls, storeDown } from '../guard';
import { measure } from '@/app/api/measure';

/**
 * GET /api/walls/readers?seed=&offset= — one page of Walls by readers in the
 * visit's order (ROADMAP 5.13d): 26 first, then the next page each time the
 * reader scrolls to the end. The seed keeps one order across the pages.
 */
export async function GET(request: NextRequest) {
  measure('walls', request);
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const seed = parseSeed(request.nextUrl.searchParams.get('seed')) ?? 0;
  const offset = Math.max(0, Math.floor(Number(request.nextUrl.searchParams.get('offset')) || 0));
  try {
    return json(await readersPage(open.store, seed, offset));
  } catch {
    return storeDown();
  }
}
