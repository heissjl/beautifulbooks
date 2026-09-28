import { NextRequest } from 'next/server';
import { isWallId, toPublic, type Tile } from '@/lib/walls/model';
import { isOwner } from '@/lib/walls/owner';
import { lookUpPrinting } from '@/lib/walls/printings';
import { json, openWalls, storeDown, visitorOf } from '../../guard';

/** At most this many tiles per request, two Open Library requests each. */
const PER_REQUEST = 12;

/**
 * POST /api/walls/<id>/printings — look up the printing for tiles that came
 * without one (ROADMAP 5.13f): from six random covers or a photo. Owner only.
 * A tile whose lookup failed stays unmarked, so it is tried again next time
 * and never shown as "no printing on record" (N12).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const { id } = await params;
  if (!isWallId(id)) return json({ error: 'No such collection.' }, 404);
  try {
    const wall = await open.store.get(id);
    if (!wall) return json({ error: 'No such collection.' }, 404);
    if (!isOwner(wall, visitorOf(request))) return json({ error: 'Only the browser that made this collection can change it.' }, 403);

    const due = wall.tiles.filter((t) => t.printings.length === 0 && !t.looked).slice(0, PER_REQUEST);
    const found = new Map<string, Pick<Tile, 'printings' | 'looked'>>();
    let failed = 0;
    await Promise.all(
      due.map(async (t) => {
        try {
          const r = await lookUpPrinting(t.coverId);
          found.set(t.coverId, { printings: 'found' in r ? [r.found] : [], looked: true });
        } catch {
          failed++;
        }
      }),
    );
    if (found.size === 0) return json({ wall: toPublic(wall), failed });

    // Read again before writing: the owner may have changed the collection meanwhile.
    const fresh = (await open.store.get(id)) ?? wall;
    const next = { ...fresh, tiles: fresh.tiles.map((t) => (found.has(t.coverId) && t.printings.length === 0 ? { ...t, ...found.get(t.coverId) } : t)) };
    await open.store.put(next);
    return json({ wall: toPublic(next), failed });
  } catch {
    return storeDown();
  }
}
