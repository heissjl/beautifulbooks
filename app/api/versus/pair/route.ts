import { NextRequest } from 'next/server';
import { nextPairFor, secretForEnv } from '@/lib/hotornot/game';
import { StoreUnavailableError } from '@/lib/hotornot/store';
import { json, openGame, storeDown } from '../guard';

export const dynamic = 'force-dynamic';

/** More than the game ever sends; a longer list is cut, not refused. */
const MAX_SEEN = 120;
const COVER_ID = /^(ol|gb):[\w.-]{1,64}$/;

/**
 * GET /api/versus/pair?last=<a>,<b>&seen=<id>,<id>,… — the next two covers
 * and the token a vote on them needs (ROADMAP 5.8a). `last` is the pair just
 * shown, `seen` the covers this player saw lately, newest last; both are kept
 * out of the next pair while enough others are left. The list lives in the
 * browser and is not stored here (N11). Never cached: every answer is for one click.
 */
export async function GET(request: NextRequest) {
  const game = openGame(request, 'versus');
  if ('response' in game) return game.response;
  const params = request.nextUrl.searchParams;
  const last = params.get('last')?.split(',');
  const seen = (params.get('seen')?.split(',') ?? []).filter(id => COVER_ID.test(id)).slice(-MAX_SEEN);
  try {
    const pair = await nextPairFor(game.store, secretForEnv(), {
      last: last && last.length === 2 ? [last[0], last[1]] : undefined,
      recent: seen,
    });
    return json(pair ?? { done: true });
  } catch (err) {
    if (err instanceof StoreUnavailableError) return storeDown();
    throw err;
  }
}
