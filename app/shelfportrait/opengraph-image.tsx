import { ImageResponse } from 'next/og';
import { asJpeg, DISPLAY, OG, ogFonts, TEXT } from '@/app/og';
import { measure } from '@/app/api/measure';
import { mosaicGround } from '@/lib/inspiration/mosaicground';
import type { Rect } from '@/lib/inspiration/layout';

/**
 * The card for a link to `/shelfportrait` itself, before anyone has made a
 * board (Julian, 2026-10-06: „baue noch ein schönere vorschaukarte für den
 * allgemeinen link zur shelfportrait-seite, ein sharepic in abstrakt zb,
 * aber mit dem schönen hintergrund"). Until now such a link showed the
 * site's general card.
 *
 * Abstract, as asked: an empty board of nine places on the mosaic ground of
 * the share pictures (`lib/inspiration/mosaicground.ts`). The field is dimmed
 * everywhere but inside the places, where the tiny covers come through
 * bright — the places a reader fills. One place is drawn in the accent, the
 * cover one loves. No cover is fetched, nothing about a reader is on it, and
 * the card is the same for everyone, so it is drawn once at build time.
 *
 * The words stand in the upper two thirds of their column: X lays the page's
 * title over the bottom left corner of a card (5.18b, 2026-10-05).
 */
export const alt = 'My Shelf-Portrait: an empty board of nine places on a mosaic of small book covers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

const PLACE = { w: 124, h: 186, gap: 14 };
const GRID = { cols: 3, rows: 3 };
const GRID_W = GRID.cols * PLACE.w + (GRID.cols - 1) * PLACE.gap;
const GRID_H = GRID.rows * PLACE.h + (GRID.rows - 1) * PLACE.gap;
const X0 = size.width - 72 - GRID_W;
const Y0 = Math.round((size.height - GRID_H) / 2);
/** The place drawn in the accent: the middle one. */
const PICKED = 4;

const places: Rect[] = Array.from({ length: GRID.cols * GRID.rows }, (_, i) => ({
  x: X0 + (i % GRID.cols) * (PLACE.w + PLACE.gap),
  y: Y0 + Math.floor(i / GRID.cols) * (PLACE.h + PLACE.gap),
  width: PLACE.w,
  height: PLACE.h,
}));
const words: Rect = { x: 72, y: 72, width: X0 - 72 - 64, height: 380 };

export default async function Image() {
  measure('og');
  const ground = await mosaicGround(size.width, size.height, 'shelfportrait', [words], places, 0.8);
  const card = new ImageResponse(
    (
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', background: OG.bg }}>
        <img src={`data:image/png;base64,${ground.toString('base64')}`} alt="" width={size.width} height={size.height} style={{ position: 'absolute', left: 0, top: 0 }} />
        {places.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: p.x, top: p.y, width: p.width, height: p.height, display: 'flex', borderRadius: 3,
              border: i === PICKED ? `6px solid ${OG.accentDark}` : '2px solid rgba(243, 237, 228, 0.45)',
              ...(i === PICKED ? { boxShadow: `0 0 28px ${OG.accentDark}` } : {}),
            }}
          />
        ))}
        <div style={{ position: 'absolute', left: words.x, top: words.y, width: words.width, height: words.height, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...DISPLAY, display: 'flex', fontSize: 88, lineHeight: 1.04, color: OG.ink }}>My Shelf-Portrait</div>
            <div style={{ ...TEXT, display: 'flex', marginTop: 22, fontSize: 30, lineHeight: 1.3, color: '#d2cbc2' }}>The books that inspire you, each with the cover you love.</div>
          </div>
          {/* The site's line, as on a board's card: the second half is the address. */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...TEXT, display: 'flex', fontSize: 24, color: '#d2cbc2', marginBottom: 4 }}>Judge a book,</div>
            <div style={{ ...DISPLAY, display: 'flex', fontStyle: 'italic', fontSize: 36, letterSpacing: 36 * 0.045, color: OG.accentDark }}>BuyItsCovers.com</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
  return asJpeg(card, true);
}
