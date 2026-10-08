import { NextRequest } from 'next/server';
import { measure } from '@/app/api/measure';
import { closed, json } from '@/app/api/inspiration/guard';
import { browseLists } from '@/lib/inspiration/browse';

/**
 * GET /api/inspiration/browse — the lists a reader scrolls instead of
 * searching (ROADMAP 5.18a): the curated works and the most read on Open
 * Library. Files in the repository, so the answer asks no catalogue and only
 * changes with a deploy; the edge keeps it a week.
 */
export async function GET(request: NextRequest) {
  measure('portrait', request);
  const refused = closed(request, 'inspiration');
  if (refused) return refused;
  return json({ lists: browseLists() }, 200, 'public, max-age=0, s-maxage=604800, stale-while-revalidate=604800');
}
