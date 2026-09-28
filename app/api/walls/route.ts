import { NextRequest } from 'next/server';
import { MAX_TILES, toPublic, validTile, WallError, type Tile } from '@/lib/walls/model';
import { newVisitorId, newWall, newWallId } from '@/lib/walls/owner';
import { json, openWalls, readJson, setVisitor, storeDown, visitorOf } from './guard';

/**
 * POST /api/walls {title?, tiles?} — a new wall owned by this browser
 * (ROADMAP 5.13a). The first wall sets the visitor cookie (E22); a reader
 * who never makes one never gets it. `tiles` lets the photo import create a
 * filled wall in one step.
 */
export async function POST(request: NextRequest) {
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const body = await readJson(request);
  if (!body) return json({ error: 'Send JSON.' }, 415);

  let tiles: Tile[] = [];
  try {
    const raw = Array.isArray(body.tiles) ? body.tiles.slice(0, MAX_TILES) : [];
    const seen = new Set<string>();
    tiles = raw.map(validTile).filter((t) => !seen.has(t.coverId) && !!seen.add(t.coverId));
  } catch (err) {
    return json({ error: err instanceof WallError ? err.message : 'Bad tiles.' }, 400);
  }

  const existing = visitorOf(request);
  const visitor = existing ?? newVisitorId();
  const wall = newWall(newWallId(), visitor, typeof body.title === 'string' ? body.title : '', new Date().toISOString(), tiles);
  try {
    await open.store.put(wall);
    await open.store.register(wall);
  } catch {
    return storeDown();
  }
  const response = json({ wall: toPublic(wall) }, 201);
  return existing ? response : setVisitor(response, visitor);
}
