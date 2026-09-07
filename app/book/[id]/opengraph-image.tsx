import { ImageResponse } from 'next/og';
import { authorLine, coverImages } from '@/lib/seo';
import { getWorkPage, isWorkId } from '@/lib/work';

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
export const contentType = 'image/png';

const BG = '#131110';
const INK = '#f4f0e8';
const INK_2 = '#a8a09a';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let title = 'Beautiful Books';
  let author = '';
  let urls: string[] = [];

  if (isWorkId(id)) {
    try {
      const page = await getWorkPage(id, { offset: 0, googleBooks: false });
      if (page) {
        title = page.work.title;
        author = authorLine(page.work.authors);
        urls = coverImages(page.covers, 4);
      }
    } catch {
      // No covers: the card falls back to the wordmark, which is still a card.
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: BG, padding: 56, justifyContent: 'space-between',
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
          <div style={{ fontSize: 54, color: INK, lineHeight: 1.1 }}>{title}</div>
          <div style={{ fontSize: 30, color: INK_2, marginTop: 10, display: 'flex' }}>
            {author ? `${author} · ` : ''}Beautiful Books
          </div>
        </div>
      </div>
    ),
    size,
  );
}
