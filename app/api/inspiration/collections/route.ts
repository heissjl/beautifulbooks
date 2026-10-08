import { NextRequest } from 'next/server';
import { measure } from '@/app/api/measure';
import { closed, json } from '@/app/api/inspiration/guard';
import { isCollectionSlug } from '@/lib/collections';
import { liveCollections } from '@/lib/collections-live';
import { collectionEntries, pickerWorks } from '@/lib/inspiration/collectionbrowse';

/**
 * GET /api/inspiration/collections — the published collections the book
 * picker offers as a third list (ROADMAP 5.18b); `?c=<slug>` — one of them,
 * its books with the covers it chose.
 *
 * Asks no catalogue: the file and the store's publish switches only. Julian
 * publishes and edits collections online without a deploy, so the edge keeps
 * this an hour, not the week the other lists get.
 */
const HOUR = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

export async function GET(request: NextRequest) {
  measure('portrait', request);
  const refused = closed(request, 'inspiration');
  if (refused) return refused;
  const slug = request.nextUrl.searchParams.get('c');
  const collections = await liveCollections({ includeDrafts: false });
  if (slug === null) return json({ collections: collectionEntries(collections) }, 200, HOUR);
  if (!isCollectionSlug(slug)) return json({ error: 'Not a collection.' }, 400);
  const found = collections.find(c => c.slug === slug && c.published);
  if (!found) return json({ error: 'No such collection.' }, 404);
  return json({ slug: found.slug, title: found.title, works: pickerWorks(found) }, 200, HOUR);
}
