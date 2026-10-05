import { NextRequest } from 'next/server';
import { closed, json } from '@/app/api/inspiration/guard';
import { BROWSE_LISTS } from '@/lib/inspiration/browse';

/**
 * GET /api/inspiration/browse — the lists a reader scrolls instead of
 * searching (ROADMAP 5.18a): the curated works and the most read on Open
 * Library. Files in the repository, so the answer asks no catalogue and only
 * changes with a deploy; the edge keeps it a week.
 */
export async function GET(request: NextRequest) {
  const refused = closed(request, 'inspiration');
  if (refused) return refused;
  return json({ lists: BROWSE_LISTS }, 200, 'public, max-age=0, s-maxage=604800, stale-while-revalidate=604800');
}
