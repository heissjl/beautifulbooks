import { NextRequest, NextResponse } from 'next/server';
import { measure } from '@/app/api/measure';
import { rateLimited } from '@/app/api/rate';
import { comparePicture } from '@/app/comparepin';
import { parseCoverIds, pickCompareCovers } from '@/lib/comparepin';
import { indexSignatures } from '@/lib/coverindex';
import { authorLine } from '@/lib/seo';
import { getWorkDetail, isWorkId, MAX_EDITIONS_SCANNED } from '@/lib/work';
import { foldDuplicateCovers } from '@/lib/works';

/**
 * GET /book/<id>/compare.jpg?covers=<id1>,<id2>,<id3> — the comparison pin
 * of a work (ROADMAP 5.5a, second format): three of its editions side by
 * side with year and publisher, 1000 × 1500.
 *
 * The whole work, the way the decade page reads it (`getWorkDetail`, the
 * same cap, folded from the built index): the default pick — the oldest
 * cover of three decades — needs every dated edition, and a cover id named
 * by the pin list may lie on any page. **Never Google Books**
 * (`googleBooks: false`). Rate bucket `pin`, open in robots.txt
 * (`PIN_IMAGES`), held a day at the edge when whole.
 */
export const maxDuration = 30;

const NOT_FOUND = { status: 404, headers: { 'Cache-Control': 'no-store' } };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimited(request, 'pin');
  if (limited) return limited;
  measure('og', request);
  const { id } = await params;
  if (!isWorkId(id)) return NextResponse.json({ error: 'No such book' }, NOT_FOUND);
  const requested = parseCoverIds(request.nextUrl.searchParams.get('covers'));

  let detail;
  try {
    detail = await getWorkDetail(id, { maxEntries: MAX_EDITIONS_SCANNED, dedupeCovers: false, googleBooks: false });
  } catch {
    // A failure is never a finding (N12): the catalogue did not answer, so there is no picture now — and nothing to cache.
    return NextResponse.json({ error: 'The catalogue did not answer' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  }
  if (!detail) return NextResponse.json({ error: 'No such book' }, NOT_FOUND);

  const folded = foldDuplicateCovers(detail.covers, indexSignatures(detail.covers.map(c => c.id)), detail.editions);
  const candidates = pickCompareCovers(folded, detail.editions, requested);
  if (candidates.length === 0) return NextResponse.json({ error: 'No covers on record for this book' }, NOT_FOUND);
  return comparePicture({
    title: detail.work.title,
    line: authorLine(detail.work.authors),
    candidates: candidates.map(c => ({ url: c.cover.url, year: c.year, publisher: c.publisher })),
    explicit: requested.length > 0,
    complete: detail.complete,
  });
}
