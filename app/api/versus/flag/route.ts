import { NextRequest } from 'next/server';
import { flagCover, secretForEnv } from '@/lib/hotornot/game';
import { StoreUnavailableError } from '@/lib/hotornot/store';
import { json, openGame, readBody, storeDown } from '../guard';

/**
 * POST /api/versus/flag {id, reason, a, b, token} — "not a cover", or an
 * image that would not load (ROADMAP 5.8a). Takes the cover out of the game
 * for everyone, so it needs the pair it was shown in, like a vote does.
 */
export async function POST(request: NextRequest) {
  const game = openGame(request, 'vote');
  if ('response' in game) return game.response;
  const { id, reason, a, b, token } = await readBody(request);
  try {
    const outcome = await flagCover(game.store, secretForEnv(), { id, reason, a, b, token });
    return outcome.ok ? json({ ok: true }) : json({ error: outcome.error }, outcome.status);
  } catch (err) {
    if (err instanceof StoreUnavailableError) return storeDown();
    throw err;
  }
}
