import { NextRequest } from 'next/server';
import { closed, DAY, json, SILENT } from '@/app/api/inspiration/guard';
import { isWorkId } from '@/lib/inspiration/board';
import { workCovers } from '@/lib/inspiration/covers';

/**
 * GET /api/inspiration/covers/<OL…W> — the covers of a work's editions, for
 * the window "The edition I read" (ROADMAP 5.18b).
 *
 * **Never Google**, and therefore not `/api/works/<id>`, whose first page
 * runs the Google title search: a page made to be passed around must not
 * spend the quota the verdicts live on (E10). One work and one to three
 * editions pages at Open Library, cached a day at the edge and in the data
 * cache, so a book many readers pick is asked once.
 */
export const maxDuration = 30;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const refused = closed(request, 'inspiration');
  if (refused) return refused;
  const { id } = await context.params;
  if (!isWorkId(id)) return json({ error: 'Not a work id.' }, 400);
  try {
    const found = await workCovers(id);
    if (!found) return json({ error: 'Open Library has no such book.' }, 404);
    return json(found, 200, DAY);
  } catch {
    return json({ error: SILENT }, 503);
  }
}
