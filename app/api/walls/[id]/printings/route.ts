import { NextRequest } from 'next/server';
import { isWallId, toPublic, type Tile } from '@/lib/walls/model';
import { isOwner } from '@/lib/walls/owner';
import { lookUpBook } from '@/lib/walls/printings';
import { json, openWalls, storeDown, visitorOf } from '../../guard';

/** At most this many tiles per request, two Open Library requests each. */
const PER_REQUEST = 12;

/**
 * POST /api/walls/<id>/printings — look up the printing for tiles that came
 * without one (ROADMAP 5.13f: six random covers, a photo) and the size of
 * every book that has none yet (5.13i). Owner only.
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

    const needsPrinting = (t: Tile) => t.printings.length === 0 && !t.looked;
    const due = wall.tiles.filter((t) => needsPrinting(t) || !t.size).slice(0, PER_REQUEST);
    const found = new Map<string, Partial<Pick<Tile, 'printings' | 'looked' | 'size'>>>();
    let failed = 0;
    await Promise.all(
      due.map(async (t) => {
        try {
          const isbn13 = t.printings.find((p) => p.isbn13)?.isbn13;
          const r = await lookUpBook(t.coverId, { isbn13, needPrinting: needsPrinting(t) });
          found.set(t.coverId, {
            ...(r.printing ? { printings: 'found' in r.printing ? [r.printing.found] : [], looked: true } : {}),
            size: r.size,
          });
        } catch {
          failed++;
        }
      }),
    );
    if (found.size === 0) return json({ wall: toPublic(wall), failed });

    // Read again before writing: the owner may have changed the collection meanwhile.
    const fresh = (await open.store.get(id)) ?? wall;
    const next = {
      ...fresh,
      tiles: fresh.tiles.map((t) => {
        const f = found.get(t.coverId);
        if (!f) return t;
        // A printing the owner's tile got meanwhile is kept; the size is added either way.
        return { ...t, ...(t.printings.length === 0 && f.printings ? { printings: f.printings, looked: f.looked } : {}), ...(f.size ? { size: f.size } : {}) };
      }),
    };
    await open.store.put(next);
    return json({ wall: toPublic(next), failed });
  } catch {
    return storeDown();
  }
}
