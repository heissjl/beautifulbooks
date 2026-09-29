import { ImageResponse } from 'next/og';
import { coverIdFromSegment, coverUrlFor } from '@/lib/coverurl';
import { authorLine } from '@/lib/seo';
import { Display, OG, TEXT, Wordmark, ogFonts } from '@/app/og';
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
          background: OG.bg, padding: 56, gap: 48,
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
          <div style={{ ...TEXT, fontSize: 30, color: OG.ink2, display: 'flex' }}>One cover of</div>
          <div style={{ display: 'flex', marginTop: 8 }}><Display size={64} color={OG.ink}>{title}</Display></div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 16 }}>
            {author && <div style={{ ...TEXT, fontSize: 32, color: OG.ink2 }}>{`${author} ·`}</div>}
            <Wordmark size={32} color={OG.ink2} />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
