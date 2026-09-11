import { NextRequest } from 'next/server';
import { castVote, secretForEnv } from '@/lib/hotornot/game';
import { StoreUnavailableError } from '@/lib/hotornot/store';
import { json, openGame, readBody, storeDown } from '../guard';

/**
 * POST /api/versus/vote {a, b, winner, token} — one vote on a pair this
 * server handed out (ROADMAP 5.8a). 400 for a pair it did not hand out or a
 * winner that was not on screen, 409 for a pair already used. Nothing about
 * the voter is kept (N11).
 */
export async function POST(request: NextRequest) {
  const game = openGame(request, 'vote');
  if ('response' in game) return game.response;
  const { a, b, winner, token } = await readBody(request);
  try {
    const outcome = await castVote(game.store, secretForEnv(), { a, b, winner, token });
    return outcome.ok ? json({ ok: true }) : json({ error: outcome.error }, outcome.status);
  } catch (err) {
    if (err instanceof StoreUnavailableError) return storeDown();
    throw err;
  }
}
