import { ImageResponse } from 'next/og';
import { SITE_NAME, authorLine, coverImages } from '@/lib/seo';
import { asJpeg, Display, OG, TEXT, Wordmark, ogFonts } from '@/app/og';
import { getWorkPage, isWorkId } from '@/lib/work';
import { measure } from '@/app/api/measure';

/**
 * The picture a shared link shows (SPEC §10 D10).
 *
 * A row of covers is the whole argument for this site, so the card is the
 * covers themselves rather than a logo: what makes someone open the link is
 * seeing that one book has looked like four different things.
 *
 * Draws page 0's covers and never asks Google Books, so a crawler walking
 * the sitemap cannot spend the quota (§8.7).
 */
export const runtime = 'nodejs';
export const revalidate = 86400;
export const alt = 'Covers of this book, side by side';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  measure('og');
  const { id } = await params;
  let title: string = SITE_NAME;
  let author = '';
  let urls: string[] = [];

  if (isWorkId(id)) {
    try {
      const page = await getWorkPage(id, { offset: 0, googleBooks: false });
      if (page) {
        title = page.work.title;
        author = authorLine(page.work.authors);
        urls = coverImages(page.covers, 4, page.editions);
      }
    } catch {
      // No covers: the card falls back to the wordmark, which is still a card.
    }
  }

  return asJpeg(new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: OG.bg, padding: 56, justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 24, height: 372 }}>
          {urls.map(url => (
            <img
              key={url}
              src={url}
              alt=""
              width={248}
              height={372}
              style={{ objectFit: 'cover', borderRadius: 8, background: '#26221f' }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Display size={56} color={OG.ink}>{title}</Display>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 10 }}>
            {author && <div style={{ ...TEXT, fontSize: 30, color: OG.ink2 }}>{`${author} ·`}</div>}
            <Wordmark size={30} color={OG.ink2} />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  ));
}
