import { NextRequest, NextResponse } from 'next/server';
import { measure } from '@/app/api/measure';
import { rateLimited } from '@/app/api/rate';
import { pinPicture } from '@/app/pin';
import { indexSignatures } from '@/lib/coverindex';
import { authorLine, coverImages } from '@/lib/seo';
import { getWorkPage, isWorkId } from '@/lib/work';
import { foldDuplicateCovers } from '@/lib/works';

/**
 * GET /book/<id>/pin.jpg — the Pinterest pin of a work (ROADMAP 5.5a): title,
 * author and nine of its covers, 1000 × 1500.
 *
 * Page 0 of the work, the way the link card takes it: **never Google Books**
 * (`googleBooks: false`; CLAUDE.md names the two places Google is called,
 * and a picture is not one), no sibling search, no description. The covers
 * are folded from the built index (free, on disk, as the decade page does)
 * so that nine tiles show nine jackets, and `coverImages` keeps one per
 * printing. Up to eighteen candidates for nine tiles.
 *
 * A static segment, so it wins over `cover/` and `decades/`; the extension
 * keeps the language proxy away. Open to crawlers in robots.txt (`PIN_IMAGES`).
 */
export const maxDuration = 30;

const NOT_FOUND = { status: 404, headers: { 'Cache-Control': 'no-store' } };

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimited(request, 'pin');
  if (limited) return limited;
  measure('og', request);
  const { id } = await params;
  if (!isWorkId(id)) return NextResponse.json({ error: 'No such book' }, NOT_FOUND);

  let page;
  try {
    page = await getWorkPage(id, { offset: 0, googleBooks: false, siblings: false, workDescription: 'never' });
  } catch {
    // A failure is never a finding (N12): the catalogue did not answer, so there is no picture now — and nothing to cache.
    return NextResponse.json({ error: 'The catalogue did not answer' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
  }
  if (!page) return NextResponse.json({ error: 'No such book' }, NOT_FOUND);

  const folded = foldDuplicateCovers(page.covers, indexSignatures(page.covers.map(c => c.id)), page.editions);
  const urls = coverImages(folded, 18, page.editions);
  return pinPicture({ title: page.work.title, line: authorLine(page.work.authors), covers: urls.map(url => ({ url })), seed: page.work.id, distinctArtwork: true });
}
