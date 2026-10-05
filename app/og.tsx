import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { SITE_NAME } from '@/lib/seo';
import { isHiddenCoverUrl } from '@/lib/hiddencovers';

/**
 * What the shared-link cards have in common (ROADMAP 6.61): the site's two
 * faces and its colours. `next/og` reads neither WOFF2 nor variable fonts, so
 * it takes the WOFF twins of the page's Xanh from `assets/fonts/` and static
 * WOFF copies of Jost from `assets/og/` (OFL, licences beside them). Latin
 * and Latin Extended only: a title in another script falls back to the
 * generator's default face, as every title did before.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export const OG = {
  bg: '#131110',
  ink: '#f4f0e8',
  ink2: '#a8a09a',
  paper: '#f4f0e8',
  paperInk: '#1f1b18',
  paperInk2: '#746c62',
  accent: '#945138',
  accentDark: '#dbac94',
} as const;

type OgFont = { name: string; data: Buffer; weight: 400; style: 'normal' | 'italic' };

let fonts: Promise<OgFont[]> | null = null;

export function ogFonts(): Promise<OgFont[]> {
  fonts ??= Promise.all(
    ([
      ['Xanh', 'fonts/xanh-proportional-regular.woff', 'normal'],
      ['Xanh', 'fonts/xanh-proportional-italic.woff', 'italic'],
      ['Jost', 'og/jost-latin-400-normal.woff', 'normal'],
      ['Jost', 'og/jost-latin-ext-400-normal.woff', 'normal'],
    ] as const).map(async ([name, file, style]) => ({
      name,
      data: await readFile(join(process.cwd(), 'assets', file)),
      weight: 400 as const,
      style,
    })),
  );
  return fonts;
}

export const DISPLAY = { fontFamily: 'Xanh' } as const;
export const TEXT = { fontFamily: 'Jost' } as const;

/** Text in Xanh, as the page sets headings (SPEC §5). */
export function Display({ children, size, color, italic = false, lineHeight = 1.1 }: {
  children: string;
  size: number;
  color: string;
  italic?: boolean;
  lineHeight?: number;
}) {
  return (
    <div style={{ ...DISPLAY, display: 'flex', fontSize: size, color, lineHeight, fontStyle: italic ? 'italic' : 'normal' }}>
      {children}
    </div>
  );
}

/** The name as the header sets it: Xanh, italic, 0.01em of tracking (in px, which the generator is sure to read). */
export function Wordmark({ size, color }: { size: number; color: string }) {
  return (
    <div style={{ ...DISPLAY, display: 'flex', fontSize: size, color, lineHeight: 1.1, fontStyle: 'italic', letterSpacing: size * 0.01 }}>
      {SITE_NAME}
    </div>
  );
}

/**
 * Covers for a card, fetched here rather than by the generator: Open Library
 * answers an image through a redirect to archive.org, 0.5–1.7 s each
 * (measured 2026-09-29), and the generator left a tile empty when one was
 * slow — eleven of fourteen on the edition suhrkamp card. Each address gets
 * `timeoutMs`; a failure, a non-image or a placeholder under 1 KB is
 * skipped and the next candidate takes its place, so the card has no holes.
 * Returns data URLs, at most `want`, in the order of `urls`.
 */
export async function loadCovers(urls: string[], want: number, timeoutMs = 5000): Promise<string[]> {
  const one = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow' });
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !type.startsWith('image/')) return null;
      const bytes = Buffer.from(await res.arrayBuffer());
      return bytes.length < 1024 ? null : `data:${type};base64,${bytes.toString('base64')}`;
    } catch {
      return null;
    }
  };
  // A cover taken off the site (2.18k) is not drawn into a card either.
  urls = urls.filter(url => !isHiddenCoverUrl(url));
  const out: string[] = [];
  // In batches of `want`: the first batch is usually enough, and the next
  // only asks for as many as are still missing.
  for (let i = 0; i < urls.length && out.length < want; ) {
    const batch = urls.slice(i, i + (want - out.length));
    i += batch.length;
    for (const img of await Promise.all(batch.map(one))) if (img) out.push(img);
  }
  return out.slice(0, want);
}

/** Quality of a card with covers as JPEG (ROADMAP 6.61, Julian 2026-09-29: „ja, mach jpg"). */
export const CARD_JPEG_QUALITY = 82;

/**
 * A card with covers, as JPEG. `next/og` writes PNG only, and a wall of
 * fourteen photographed covers came to 927 KB as PNG (Feminist Press,
 * measured in production 2026-09-29); the same picture is 122 KB at quality
 * 82. The site card stays PNG: it is flat colour and type, which PNG keeps
 * small and JPEG would smear.
 */
export async function asJpeg(card: Response): Promise<Response> {
  const png = Buffer.from(await card.arrayBuffer());
  const jpeg = await sharp(png).jpeg({ quality: CARD_JPEG_QUALITY, mozjpeg: true }).toBuffer();
  const headers = new Headers(card.headers);
  headers.set('content-type', 'image/jpeg');
  headers.delete('content-length');
  return new Response(new Uint8Array(jpeg), { status: card.status, headers });
}

const WALL_COLS = 7;
const WALL_ROWS = 2;
const WALL_TILE_W = 140;
const WALL_TILE_H = 210;
const WALL_GAP = 12;

/**
 * The card of a wall of covers — a collection of ours (`/collections/<slug>`)
 * or a reader's (`/c/<id>`): the first fourteen covers that load, two rows of
 * seven, or one row when fewer than fourteen load (a half-filled second row
 * reads as covers missing), the title under them and one line of facts.
 * JPEG, like every card with covers. `coverUrls` are the candidates in the
 * wall's order; up to twice the wall is enough to fill the holes.
 */
export async function coverWallCard({ coverUrls, title, facts }: { coverUrls: string[]; title: string; facts: string }): Promise<Response> {
  const covers = await loadCovers(coverUrls.slice(0, WALL_COLS * WALL_ROWS * 2), WALL_COLS * WALL_ROWS);
  const rows = covers.length >= WALL_COLS * WALL_ROWS ? WALL_ROWS : 1;
  return asJpeg(new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: OG.bg, padding: '40px 56px', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: WALL_GAP, width: WALL_COLS * WALL_TILE_W + (WALL_COLS - 1) * WALL_GAP, height: rows * WALL_TILE_H + (rows - 1) * WALL_GAP, overflow: 'hidden' }}>
          {covers.slice(0, rows * WALL_COLS).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img>
            <img
              key={i}
              src={url}
              alt=""
              width={WALL_TILE_W}
              height={WALL_TILE_H}
              style={{ objectFit: 'cover', borderRadius: 5, background: '#26221f' }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Display size={48} color={OG.ink}>{title}</Display>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
            <div style={{ ...TEXT, fontSize: 26, color: OG.ink2 }}>{`${facts} ·`}</div>
            <Wordmark size={26} color={OG.ink2} />
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  ));
}

