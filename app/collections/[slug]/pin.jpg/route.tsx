import { NextRequest, NextResponse } from 'next/server';
import { measure } from '@/app/api/measure';
import { rateLimited } from '@/app/api/rate';
import { absoluteCover, pinPicture } from '@/app/pin';
import { authorsShown } from '@/lib/collections';
import { liveCollectionBySlug } from '@/lib/collections-live';
import { wallCover } from '@/lib/curated';

/**
 * GET /collections/<slug>/pin.jpg — the Pinterest pin of a published
 * collection (ROADMAP 5.5a): its name, the line its link card carries, and
 * nine of its covers in its order, 1000 × 1500.
 *
 * Like the card, only a published collection gets one: a draft is visible to
 * signed-in friends, and Pinterest has no cookie. Credits where the
 * collection file has them (ISFDB's artists, or the credited artwork): the
 * rights decision of 2026-10-17 was (a), covers on other platforms with
 * attribution (PLAN-5.6c §9), and the line under the covers is that
 * attribution for the printings the file knows the artist of.
 */
export const maxDuration = 30;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const limited = rateLimited(request, 'pin');
  if (limited) return limited;
  measure('og', request);
  const { slug } = await params;
  const c = await liveCollectionBySlug(slug).catch(() => null);
  if (!c) return NextResponse.json({ error: 'No such collection' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });

  const covers = c.works
    .filter(w => w.image || w.coverId > 0)
    .map(w => ({
      url: absoluteCover(wallCover(w, 'L')),
      credit: w.coverArtists && w.coverArtists.length > 0 ? w.coverArtists.join(' and ') : w.coverArt,
    }));
  const names = c.kind === 'authors' ? authorsShown(c) : [];
  const byline = names.length === 0 ? '' : names.length <= 2 ? names.join(' and ') : `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  const count = `${c.works.length} ${c.works.length === 1 ? 'book' : 'books'}`;
  return pinPicture({
    title: c.title,
    line: `${count}${byline ? ` by ${byline}` : ''}`,
    covers,
    creditSource: c.coverCredits === 'isfdb' ? 'ISFDB' : undefined,
    seed: slug,
  });
}
