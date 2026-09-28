import { NextRequest } from 'next/server';
import { CURATED_LIST } from '@/lib/curated';
import { cachedBoard, POOL } from '@/lib/hotornot/game';
import { storeFromEnv } from '@/lib/hotornot/store';
import { versusEnabled } from '@/lib/hotornot/switch';
import { drawSample, topShare, type SampleCandidate } from '@/lib/walls/sample';
import { json, openWalls } from '../guard';

/**
 * GET /api/walls/sample — six random covers to start a wall with (ROADMAP
 * 5.13c): Julian's curated picks and the top tenth of the cover game's table.
 * The table comes from the game's own board, counted once a minute; without a
 * store, or when it does not answer, the draw is from the curated list alone
 * and says so.
 */
export async function GET(request: NextRequest) {
  const open = openWalls(request);
  if ('response' in open) return open.response;

  const curated: SampleCandidate[] = CURATED_LIST.map((w) => ({ coverId: w.coverId, workId: w.id, title: w.title, author: w.author }));
  let versus: SampleCandidate[] = [];
  const store = versusEnabled() ? storeFromEnv() : null;
  if (store) {
    try {
      const table = (await cachedBoard(store, { top: POOL.covers.length, bottom: 1 })).top;
      versus = topShare(table).map((e) => ({ coverId: e.id, workId: e.workId, title: e.title, author: e.author, image: e.image }));
    } catch {
      versus = [];
    }
  }
  const tiles = drawSample(curated, versus);
  return json({ tiles, from: { curated: curated.length, versusTop: versus.length } });
}
