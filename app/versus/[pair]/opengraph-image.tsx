import { ImageResponse } from 'next/og';
import { Display, OG, OG_SIZE, TEXT, Wordmark, asJpeg, loadCovers, ogFonts } from '@/app/og';
import { coverUrlFor } from '@/lib/coverurl';
import { POOL } from '@/lib/hotornot/game';
import { parseMatchup } from '@/lib/hotornot/matchup';
import { versusEnabled } from '@/lib/hotornot/switch';
import { measure } from '@/app/api/measure';

/**
 * The picture a link to one pairing shows (ROADMAP 6.97): the two covers side
 * by side, the question under them. The link is made to be posted, so the
 * card has to be the pairing itself — a reader decides from the two pictures
 * whether to click, and a generic card would throw that away.
 *
 * Open Library's images are slow (0.5–1.7 s each) and sometimes silent, so a
 * cover that does not arrive leaves its place empty rather than the card: a
 * posted link without a picture gets no second chance.
 */
export const runtime = 'nodejs';
export const revalidate = 86400;
export const alt = 'Two covers of the game, side by side';
export const size = OG_SIZE;
export const contentType = 'image/jpeg';

const TILE = { width: 320, height: 480 };

export default async function Image({ params }: { params: Promise<{ pair: string }> }) {
  measure('og');
  const { pair } = await params;
  const ids = parseMatchup(pair);
  const sides = !ids || !versusEnabled() ? [] : [ids.a, ids.b].map(id => POOL.covers.find(c => c.id === id) ?? null);
  const urls = sides.flatMap(c => (c ? [coverUrlFor(c.id, 'L') ?? ''] : [])).filter(Boolean);
  // Both, in the order of the address: `loadCovers` keeps the order and drops what does not answer.
  const covers = urls.length === 2 ? await loadCovers(urls, 2) : [];
  const titles = sides.flatMap(c => (c?.title ? [c.title] : []));

  return asJpeg(new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: OG.bg, padding: '40px 56px', justifyContent: 'space-between', alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: 40, height: TILE.height, alignItems: 'center' }}>
          {covers.map((url, i) => (
            <img key={i} src={url} alt="" width={TILE.width} height={TILE.height} style={{ objectFit: 'contain', borderRadius: 6 }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Display size={covers.length === 2 ? 40 : 52} color={OG.ink}>
            {titles.length === 2 ? `${titles[0]} or ${titles[1]}?` : 'Which cover would you rather look at?'}
          </Display>
          <div style={{ ...TEXT, fontSize: 26, color: OG.ink2 }}>·</div>
          <Wordmark size={26} color={OG.ink2} />
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  ));
}
