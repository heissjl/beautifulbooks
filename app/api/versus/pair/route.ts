import { NextRequest } from 'next/server';
import { nextPairFor, secretForEnv } from '@/lib/hotornot/game';
import { StoreUnavailableError } from '@/lib/hotornot/store';
import { json, openGame, storeDown } from '../guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/versus/pair?last=<a>,<b> — the next two covers and the token a
 * vote on them needs (ROADMAP 5.8a). `last` is the pair just shown, so it is
 * not shown again at once. Never cached: every answer is for one click.
 */
export async function GET(request: NextRequest) {
  const game = openGame(request, 'versus');
  if ('response' in game) return game.response;
  const last = request.nextUrl.searchParams.get('last')?.split(',');
  try {
    const pair = await nextPairFor(game.store, secretForEnv(), {
      last: last && last.length === 2 ? [last[0], last[1]] : undefined,
    });
    return json(pair ?? { done: true });
  } catch (err) {
    if (err instanceof StoreUnavailableError) return storeDown();
    throw err;
  }
}
