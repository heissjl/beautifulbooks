import { ImageResponse } from 'next/og';
import { coverIdFromSegment, coverUrlFor } from '@/lib/coverurl';
import { authorLine } from '@/lib/seo';
import { getWorkPage, isWorkId } from '@/lib/work';

/**
 * The picture beside a shared cover (ROADMAP 6.20).
 *
 * The work page's card shows four covers because the point there is that one
 * book has many faces. Here someone picked *one*, and the card shows that
 * one, large — otherwise the link says something other than what was shared.
 *
 * Page 0 only and never Google Books, like the other card, so a crawler
 * walking shared links cannot spend the quota (§8.7). If the chosen cover is
 * not on page 0 — it may sit on page 7 of a long work — the image is still
 * built from its id alone; the lookup here is only for the title beside it.
 */
export const runtime = 'nodejs';
export const revalidate = 86400;
export const alt = 'A cover of this book';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BG = '#131110';
const INK = '#f4f0e8';
const INK_2 = '#a8a09a';

export default async function Image({ params }: { params: Promise<{ id: string; coverId: string }> }) {
  const { id, coverId } = await params;
  const cover = coverIdFromSegment(coverId);
  const url = cover ? coverUrlFor(cover, 'L') : null;

  let title = 'Beautiful Books';
  let author = '';
  if (isWorkId(id)) {
    try {
      const page = await getWorkPage(id, { offset: 0, googleBooks: false });
      if (page) {
        title = page.work.title;
        author = authorLine(page.work.authors);
      }
    } catch {
      // The catalogue is allowed to be silent; the cover still carries the card.
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center',
          background: BG, padding: 56, gap: 48,
        }}
      >
        {url && (
          <img
            src={url}
            alt=""
            width={345}
            height={518}
            style={{ objectFit: 'contain', borderRadius: 10, background: '#26221f' }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 660 }}>
          <div style={{ fontSize: 30, color: INK_2, display: 'flex' }}>One cover of</div>
          <div style={{ fontSize: 62, color: INK, lineHeight: 1.1, marginTop: 8 }}>{title}</div>
          <div style={{ fontSize: 32, color: INK_2, marginTop: 16, display: 'flex' }}>
            {author ? `${author} · ` : ''}Beautiful Books
          </div>
        </div>
      </div>
    ),
    size,
  );
}
