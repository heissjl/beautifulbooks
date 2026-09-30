import { ImageResponse } from 'next/og';
import { Display, OG, Wordmark, ogFonts } from '@/app/og';

/**
 * The card for every page that has none of its own: the home page, About,
 * the game, collections (ROADMAP 6.61).
 *
 * A wall of book-shaped tiles with one picked out — direction A of the mark
 * in docs/identitaet.md. No real cover: a card that stands for the whole
 * site is not about any one book, so the argument that lets the wall show
 * covers does not reach it (docs/identitaet.md §2). It asks no source and
 * can be static.
 */
export const alt = 'Beautiful Books: judge a book by its covers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TONES = ['#2a2622', '#3a342f', '#4a433c', '#6b635a', '#8a8178', '#b8ab9c', '#d9cfc1'];
const COLS = 9;
const ROWS = 7;
const TILE_W = 52;
const TILE_H = 78;
const GAP = 10;
const PICKED = { col: 4, row: 3 };

/** A fixed shuffle, so the card is the same on every build. */
function tone(col: number, row: number): string {
  const n = (col * 7 + row * 13 + col * row * 3) % TONES.length;
  return TONES[n];
}

export default async function Image() {
  const rows = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => ({ col, row })),
  );

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: OG.paper }}>
        <div
          style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            width: 600, padding: '64px 0 64px 72px',
          }}
        >
          <Wordmark size={40} color={OG.paperInk} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Display size={76} color={OG.paperInk} lineHeight={1.05}>Judge a book</Display>
            <Display size={76} color={OG.accent} lineHeight={1.05} italic>by its covers.</Display>
          </div>
        </div>
        <div
          style={{
            display: 'flex', flexDirection: 'column', gap: GAP,
            justifyContent: 'center', paddingLeft: 24,
          }}
        >
          {rows.map((cells, row) => (
            <div key={row} style={{ display: 'flex', gap: GAP }}>
              {cells.map(({ col }) => {
                const picked = col === PICKED.col && row === PICKED.row;
                return (
                  <div
                    key={col}
                    style={{
                      width: TILE_W, height: TILE_H, borderRadius: 3,
                      background: picked ? OG.accent : tone(col, row),
                      // Fade into the paper towards the text, so the wall
                      // reads as extending past the card.
                      opacity: picked ? 1 : 0.35 + 0.65 * (col / (COLS - 1)),
                      ...(picked ? { transform: 'scale(1.28)', boxShadow: '0 10px 24px rgba(31, 27, 24, 0.35)' } : {}),
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
