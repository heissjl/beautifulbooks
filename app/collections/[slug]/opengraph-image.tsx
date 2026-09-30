import { ImageResponse } from 'next/og';
import SiteCard from '@/app/opengraph-image';
import { Display, OG, TEXT, Wordmark, loadCovers, ogFonts } from '@/app/og';
import { allCollections, authorsShown } from '@/lib/collections';
import { liveCollectionBySlug } from '@/lib/collections-live';
import { wallCover } from '@/lib/curated';
import { SITE_URL } from '@/lib/seo';

/**
 * The card of a shared collection (ROADMAP 6.61, Julian 2026-09-29: „wir
 * brauchen noch eine Vorschaukarte für Collections").
 *
 * A wall of the collection's own covers, in its order — the first fourteen
 * that load, two rows of seven, or one row when fewer than fourteen load —
 * with the title under it. Like a work's card and unlike
 * the site card, it may show real covers: it shows the very covers the page
 * it points to shows.
 *
 * Only a published collection gets one. A draft is visible to signed-in
 * friends only, and a crawler has no cookie, so a draft's link shows the
 * site card rather than covers nobody else can open.
 *
 * **Built ahead** for every collection the file publishes (Julian,
 * 2026-09-29: „für die von uns erstellten Sammlungen kannst du die Karten ja
 * vorberechnen"): a shared link then gets a finished image and never waits
 * on Open Library, whose covers take 0.5–1.7 s each. A collection published
 * later by its switch, or whose content changes online, is built on its
 * first request and renewed once a day like the others.
 */
export const revalidate = 86400;

export function generateStaticParams() {
  return allCollections({ includeDrafts: false }).map(c => ({ slug: c.slug }));
}

export const alt = 'Covers of this collection';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const COLS = 7;
const ROWS = 2;
const TILE_W = 140;
const TILE_H = 210;
const GAP = 12;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await liveCollectionBySlug(slug).catch(() => null);
  if (!c) return SiteCard();

  const candidates = c.works
    .filter(w => w.image || w.coverId > 0)
    .slice(0, COLS * ROWS * 2)
    .map(w => {
      const src = wallCover(w, 'M');
      // A collection's own image is a path on this site; a fetch needs the whole address.
      return src.startsWith('/') ? `${SITE_URL}${src}` : src;
    });
  const covers = await loadCovers(candidates, COLS * ROWS);
  // Two full rows or one: a half-filled second row reads as covers missing.
  const rows = covers.length >= COLS * ROWS ? ROWS : 1;
  const names = c.kind === 'authors' ? authorsShown(c) : [];
  const byline = names.length === 0 ? '' : names.length <= 2 ? names.join(' and ') : `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  const count = `${c.works.length} ${c.works.length === 1 ? 'book' : 'books'}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: OG.bg, padding: '40px 56px', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: GAP, width: COLS * TILE_W + (COLS - 1) * GAP, height: rows * TILE_H + (rows - 1) * GAP, overflow: 'hidden' }}>
          {covers.slice(0, rows * COLS).map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              width={TILE_W}
              height={TILE_H}
              style={{ objectFit: 'cover', borderRadius: 5, background: '#26221f' }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Display size={48} color={OG.ink}>{c.title}</Display>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
            <div style={{ ...TEXT, fontSize: 26, color: OG.ink2 }}>{`${count}${byline ? ` by ${byline}` : ''} ·`}</div>
            <Wordmark size={26} color={OG.ink2} />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
