import { NextRequest } from 'next/server';
import { liveCollectionBySlug } from '@/lib/collections-live';
import { tilesFromCurated, tilesFromWall } from '@/lib/walls/jumpstart';
import { isWallId, toPublic } from '@/lib/walls/model';
import { newVisitorId, newWall, newWallId } from '@/lib/walls/owner';
import { json, openWalls, readJson, setVisitor, storeDown, visitorOf } from '../guard';
import { measure } from '@/app/api/measure';

/**
 * GET /api/walls/from?curated=<slug> | ?reader=<id> — the covers of a
 * published curated collection or a reader's collection as tiles, without
 * making anything (ROADMAP 5.13m): the editor offers them to pick into the
 * collection that is open.
 */
export async function GET(request: NextRequest) {
  measure('walls', request);
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const params = request.nextUrl.searchParams;
  const curated = params.get('curated');
  const reader = params.get('reader');
  try {
    if (curated) {
      const c = await liveCollectionBySlug(curated);
      if (!c) return json({ error: 'No such collection.' }, 404);
      return json({ title: c.title, ...tilesFromCurated(c.works) });
    }
    if (isWallId(reader)) {
      const source = await open.store.get(reader);
      if (!source) return json({ error: 'No such collection.' }, 404);
      return json({ title: source.title, ...tilesFromWall(toPublic(source)) });
    }
  } catch {
    return storeDown();
  }
  return json({ error: 'Name a collection.' }, 400);
}

/**
 * POST /api/walls/from {curated: slug} | {reader: id} — a new collection of
 * one's own, started from a published curated collection or from a reader's
 * collection (ROADMAP 5.13k). It starts unsaved, like every new collection
 * (5.13j), and takes only the covers, not the title's owner or their lines.
 */
export async function POST(request: NextRequest) {
  measure('walls', request);
  const open = openWalls(request);
  if ('response' in open) return open.response;
  const body = await readJson(request);
  if (!body) return json({ error: 'Send JSON.' }, 415);

  let title: string;
  let started;
  try {
    if (typeof body.curated === 'string') {
      const c = await liveCollectionBySlug(body.curated);
      if (!c) return json({ error: 'No such collection.' }, 404);
      title = c.title;
      started = tilesFromCurated(c.works);
    } else if (isWallId(body.reader)) {
      const source = await open.store.get(body.reader);
      if (!source) return json({ error: 'No such collection.' }, 404);
      title = source.title;
      started = tilesFromWall(toPublic(source));
    } else {
      return json({ error: 'Name a collection to start from.' }, 400);
    }
  } catch {
    return storeDown();
  }
  if (started.tiles.length === 0) return json({ error: 'None of these covers can go into a collection of your own.' }, 422);

  const existing = visitorOf(request);
  const visitor = existing ?? newVisitorId();
  const wall = newWall(newWallId(), visitor, title, new Date().toISOString(), started.tiles);
  try {
    await open.store.put(wall);
    await open.store.register(wall);
  } catch {
    return storeDown();
  }
  const response = json({ wall: toPublic(wall), skipped: started.skipped, capped: started.capped }, 201);
  return existing ? response : setVisitor(response, visitor);
}
