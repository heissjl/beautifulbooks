import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { closed, json } from '@/app/api/inspiration/guard';
import { asJpeg, DISPLAY, OG, ogFonts, TEXT, Wordmark } from '@/app/og';
import { coverUrlFor } from '@/lib/coverurl';
import { filledCount, parseBoard } from '@/lib/inspiration/board';
import { posterLayout, type PosterFormat, type Rect } from '@/lib/inspiration/layout';
import { SITE_URL } from '@/lib/seo';

/**
 * GET /api/inspiration/poster?b=…&by=…&format=story|feed|card — the picture
 * of a board (ROADMAP 5.18b).
 *
 * `story` (1080 × 1920) and `feed` (1080 × 1350) are what a reader saves and
 * posts; `card` (1200 × 630) is what a messenger shows for the link. Painted
 * with `next/og` in the site's own faces, as the link cards are — the lab's
 * sharp-and-SVG poster drew whatever serif the machine had. JPEG, like every
 * card with covers: nine photographed covers were 3 MB as PNG.
 *
 * The covers are fetched here, each with its own budget, and cut to their
 * tile before the generator sees them. One that does not come leaves an empty
 * tile rather than failing the picture — and then the answer is **not
 * cached**: a silent archive.org is an episode, not a fact about the cover.
 * A picture with every cover depends only on its address and is kept a month.
 *
 * Under `/api/` so that the language proxy leaves it alone; it carries no
 * words that differ by language except the title, which is the reader's.
 */
export const maxDuration = 30;

const COVER_TIMEOUT_MS = 8000;
const EMPTY = '#2a2522';
/** The address a reader types from a picture that carries no link. Never localhost: the picture travels. */
const ADDRESS = `${/^https?:\/\/(localhost|127\.|\[::1\])/.test(SITE_URL) || SITE_URL.includes('vercel.app') ? 'buyitscovers.com' : new URL(SITE_URL).host}/inspiration`;

type Format = PosterFormat | 'card';

async function tile(coverId: string, width: number, height: number): Promise<string | null> {
  const url = coverUrlFor(coverId, 'L');
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(COVER_TIMEOUT_MS), redirect: 'follow' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    // Open Library answers a missing scan with a 1 × 1 image.
    if (bytes.length < 1024) return null;
    // `cover`: a scan is rarely exactly 2:3; trimming a sliver beats a letterbox.
    const cut = await sharp(bytes).resize(width, height, { fit: 'cover', position: 'centre' }).jpeg({ quality: 88 }).toBuffer();
    return `data:image/jpeg;base64,${cut.toString('base64')}`;
  } catch {
    return null;
  }
}

function Tiles({ rects, images }: { rects: Rect[]; images: (string | null)[] }) {
  return (
    <>
      {rects.map((r, i) => (
        // A hairline ground under every tile, so a black cover does not dissolve into the black poster.
        <div key={i} style={{ position: 'absolute', left: r.x - 2, top: r.y - 2, width: r.width + 4, height: r.height + 4, display: 'flex', background: EMPTY, padding: 2 }}>
          {images[i] && (
            // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img>
            <img src={images[i] ?? ''} alt="" width={r.width} height={r.height} />
          )}
        </div>
      ))}
    </>
  );
}

/** One or two centred lines; a long name makes the type smaller instead of running off the picture. */
function titleSize(title: string, size: number): number {
  return title.length <= 30 ? size : Math.max(Math.round(size * 0.62), Math.round((size * 30) / title.length));
}

function poster(format: PosterFormat, title: string, images: (string | null)[]) {
  const L = posterLayout(format);
  const { head, foot, type } = L;
  return (
    <div style={{ position: 'relative', width: L.width, height: L.height, display: 'flex', background: OG.bg }}>
      <div style={{ position: 'absolute', left: head.x, top: 0, width: head.width, height: head.height - type.title * 0.45, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{ ...DISPLAY, display: 'flex', textAlign: 'center', fontSize: titleSize(title, type.title), lineHeight: 1.12, color: OG.ink }}>{title}</div>
      </div>
      <Tiles rects={L.tiles} images={images} />
      <div style={{ position: 'absolute', left: foot.x, top: foot.y, width: foot.width, height: foot.height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Wordmark size={type.site} color={OG.ink} />
        <div style={{ ...TEXT, display: 'flex', fontSize: type.address, color: OG.ink2, marginTop: type.address * 0.15 }}>{ADDRESS}</div>
      </div>
    </div>
  );
}

const CARD = { width: 1200, height: 630, tileW: 120, tileH: 180, gap: 12, pad: 33 };

function cardRects(): Rect[] {
  const x0 = CARD.width - CARD.pad - (3 * CARD.tileW + 2 * CARD.gap);
  return Array.from({ length: 9 }, (_, i) => ({
    x: x0 + (i % 3) * (CARD.tileW + CARD.gap),
    y: CARD.pad + Math.floor(i / 3) * (CARD.tileH + CARD.gap),
    width: CARD.tileW,
    height: CARD.tileH,
  }));
}

function card(title: string, images: (string | null)[]) {
  const rects = cardRects();
  return (
    <div style={{ position: 'relative', width: CARD.width, height: CARD.height, display: 'flex', background: OG.bg }}>
      <div style={{ position: 'absolute', left: 64, top: 0, width: rects[0].x - 64 - 48, height: CARD.height, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ ...DISPLAY, display: 'flex', fontSize: titleSize(title, 68), lineHeight: 1.1, color: OG.ink }}>{title}</div>
        <div style={{ ...TEXT, display: 'flex', fontSize: 28, color: OG.ink2, marginTop: 20 }}>Nine books, in the editions they were read in.</div>
        <div style={{ display: 'flex', marginTop: 44 }}>
          <Wordmark size={36} color={OG.accentDark} />
        </div>
      </div>
      <Tiles rects={rects} images={images} />
    </div>
  );
}

export async function GET(request: NextRequest) {
  const refused = closed(request, 'inspirationPoster');
  if (refused) return refused;
  const params = request.nextUrl.searchParams;
  const raw = params.get('format');
  const format: Format = raw === 'feed' || raw === 'card' ? raw : 'story';
  const board = parseBoard(params);
  if (filledCount(board) === 0) return json({ error: 'An empty board has no picture.' }, 400);

  const title = board.by ? `The books that inspired ${board.by}` : 'The books that inspired me';
  const rects = format === 'card' ? cardRects() : posterLayout(format).tiles;
  const images = await Promise.all(board.slots.map((s, i) => (s ? tile(s.coverId, rects[i].width, rects[i].height) : null)));
  const whole = board.slots.every((s, i) => !s || images[i]);

  const size = format === 'card' ? { width: CARD.width, height: CARD.height } : { width: posterLayout(format).width, height: posterLayout(format).height };
  const picture = await asJpeg(new ImageResponse(format === 'card' ? card(title, images) : poster(format, title, images), { ...size, fonts: await ogFonts() }));
  const headers = new Headers(picture.headers);
  headers.set('Cache-Control', whole ? 'public, max-age=3600, s-maxage=2592000' : 'no-store');
  return new Response(picture.body, { status: 200, headers });
}
