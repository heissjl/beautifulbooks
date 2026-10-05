import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { closed, json } from '@/app/api/inspiration/guard';
import { asJpeg, DISPLAY, OG, ogFonts, TEXT, Wordmark } from '@/app/og';
import { coverUrlFor } from '@/lib/coverurl';
import { filledCount, parseBoard, SIZE_WORD, sizeOf } from '@/lib/inspiration/board';
import { posterLayout, type PosterFormat, type Rect } from '@/lib/inspiration/layout';
import { SITE_URL } from '@/lib/seo';

/**
 * GET /api/inspiration/poster?b=…&by=…&format=story|feed|card[&look=…] — the
 * picture of a board (ROADMAP 5.18b).
 *
 * `story` (1080 × 1920) and `feed` (1080 × 1350) are what a reader saves and
 * posts; `card` (1200 × 630) is what a messenger shows for the link. Painted
 * with `next/og` in the site's own faces, as the link cards are — the lab's
 * sharp-and-SVG poster drew whatever serif the machine had. JPEG, like every
 * card with covers: nine photographed covers were 3 MB as PNG.
 *
 * **The ground** (Julian, 2026-10-05: „der hintergrund der sharepics muss noch
 * besser sein"). A flat near-black made every board look the same and gave
 * the covers nothing to stand on. `ambient`, the default, is the board's own
 * covers blurred until only their colours are left, darkened, with the edges
 * drawn in — each picture gets the colour world of its books, and the covers
 * cast a shadow on it. `paper` is the site's warm ground with dark type, the
 * way the website itself looks; `plain` is the old flat one, kept to compare.
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
/** The address a reader types from a picture that carries no link. Never localhost or a preview's host: the picture travels. */
const ADDRESS = `${/^https?:\/\/(localhost|127\.|\[::1\])/.test(SITE_URL) || SITE_URL.includes('vercel.app') ? 'buyitscovers.com' : new URL(SITE_URL).host}/inspiration`;

type Format = PosterFormat | 'card';
type Look = 'ambient' | 'paper' | 'plain';

const LOOKS: Record<Look, { bg: string; ink: string; ink2: string; mark: string; empty: string; shadow: string }> = {
  ambient: { bg: OG.bg, ink: OG.ink, ink2: '#d2cbc2', mark: OG.ink, empty: 'rgba(255,255,255,0.08)', shadow: '0 22px 48px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.5)' },
  paper: { bg: OG.paper, ink: OG.paperInk, ink2: OG.paperInk2, mark: OG.accent, empty: '#e6dfd3', shadow: '0 20px 40px -14px rgba(20,16,12,0.5), 0 2px 5px rgba(20,16,12,0.25)' },
  plain: { bg: OG.bg, ink: OG.ink, ink2: OG.ink2, mark: OG.ink, empty: '#2a2522', shadow: '0 0 0 2px #2a2522' },
};

async function tile(coverId: string, width: number, height: number): Promise<Buffer | null> {
  const url = coverUrlFor(coverId, 'L');
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(COVER_TIMEOUT_MS), redirect: 'follow' });
    if (!res.ok || !(res.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    // Open Library answers a missing scan with a 1 × 1 image.
    if (bytes.length < 1024) return null;
    // `cover`: a scan is rarely exactly 2:3; trimming a sliver beats a letterbox.
    return await sharp(bytes).resize(width, height, { fit: 'cover', position: 'centre' }).jpeg({ quality: 88 }).toBuffer();
  } catch {
    return null;
  }
}

const dataUrl = (jpeg: Buffer) => `data:image/jpeg;base64,${jpeg.toString('base64')}`;

/**
 * The covers themselves as a ground: each one shrunk to a few pixels and set
 * side by side as they stand on the board, that small mosaic stretched over
 * the whole picture and blurred until no cover can be told — only where the
 * reds and the blues are. Then darkened, with the edges drawn in, so the type
 * at the top and bottom stays readable on any board. Stretched rather than
 * painted in place: the first try left the bands above and below the covers
 * black, with an edge where the colour began.
 * Null when it cannot be made — the flat colour stands in.
 */
async function ambient(width: number, height: number, rects: Rect[], tiles: (Buffer | null)[]): Promise<string | null> {
  const cols = new Set(rects.map((r) => r.x)).size;
  const rows = rects.length / cols;
  const cell = { w: 12, h: 18 };
  try {
    const cells = await Promise.all(tiles.map(async (t, i) => (t
      ? { input: await sharp(t).resize(cell.w, cell.h, { fit: 'fill' }).toBuffer(), left: (i % cols) * cell.w, top: Math.floor(i / cols) * cell.h }
      : null)));
    const mosaic = await sharp({ create: { width: cols * cell.w, height: rows * cell.h, channels: 3, background: '#3a342f' } })
      .composite(cells.flatMap((c) => (c ? [c] : [])))
      .png()
      .toBuffer();
    // Blurred at an eighth of the size and enlarged: the same softness as a 130 px blur at full size, for a fraction of the work.
    const small = await sharp(mosaic).resize(Math.round(width / 8), Math.round(height / 8), { fit: 'fill', kernel: 'cubic' }).blur(16).png().toBuffer();
    const soft = await sharp(small).resize(width, height, { fit: 'fill', kernel: 'cubic' }).modulate({ saturation: 1.3 }).png().toBuffer();
    const shade = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
        `<defs><radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="30%" stop-color="#0c0a09" stop-opacity="0.45"/><stop offset="100%" stop-color="#0c0a09" stop-opacity="0.8"/></radialGradient></defs>` +
        `<rect width="100%" height="100%" fill="url(#v)"/></svg>`,
    );
    return dataUrl(await sharp(soft).composite([{ input: shade }]).jpeg({ quality: 80 }).toBuffer());
  } catch {
    return null;
  }
}

function Ground({ src, width, height }: { src: string | null; width: number; height: number }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img>
  return <img src={src} alt="" width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }} />;
}

function Tiles({ rects, images, look }: { rects: Rect[]; images: (string | null)[]; look: Look }) {
  const L = LOOKS[look];
  return (
    <>
      {rects.map((r, i) => (
        <div key={i} style={{ position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height, display: 'flex', background: L.empty, boxShadow: images[i] ? L.shadow : 'none' }}>
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

function poster(format: PosterFormat, count: 6 | 9, title: string, images: (string | null)[], look: Look, ground: string | null) {
  const P = posterLayout(format, count);
  const L = LOOKS[look];
  const { head, foot, type } = P;
  return (
    <div style={{ position: 'relative', width: P.width, height: P.height, display: 'flex', background: L.bg }}>
      <Ground src={ground} width={P.width} height={P.height} />
      <div style={{ position: 'absolute', left: head.x, top: 0, width: head.width, height: head.height - type.title * 0.45, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        <div style={{ ...DISPLAY, display: 'flex', textAlign: 'center', fontSize: titleSize(title, type.title), lineHeight: 1.12, color: L.ink }}>{title}</div>
      </div>
      <Tiles rects={P.tiles} images={images} look={look} />
      <div style={{ position: 'absolute', left: foot.x, top: foot.y, width: foot.width, height: foot.height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Wordmark size={type.site} color={L.mark} />
        <div style={{ ...TEXT, display: 'flex', fontSize: type.address, color: L.ink2, marginTop: type.address * 0.15 }}>{ADDRESS}</div>
      </div>
    </div>
  );
}

const CARD = { width: 1200, height: 630, gap: 12, right: 40 };

/** The covers of a link card, at its right: three by three, or three by two and larger for six. */
function cardRects(count: 6 | 9): Rect[] {
  const rows = count / 3;
  const tileH = rows === 3 ? 180 : 264;
  const tileW = (tileH / 3) * 2;
  const x0 = CARD.width - CARD.right - (3 * tileW + 2 * CARD.gap);
  const y0 = Math.round((CARD.height - (rows * tileH + (rows - 1) * CARD.gap)) / 2);
  return Array.from({ length: count }, (_, i) => ({
    x: x0 + (i % 3) * (tileW + CARD.gap),
    y: y0 + Math.floor(i / 3) * (tileH + CARD.gap),
    width: tileW,
    height: tileH,
  }));
}

function card(count: 6 | 9, title: string, images: (string | null)[], look: Look, ground: string | null) {
  const rects = cardRects(count);
  const L = LOOKS[look];
  return (
    <div style={{ position: 'relative', width: CARD.width, height: CARD.height, display: 'flex', background: L.bg }}>
      <Ground src={ground} width={CARD.width} height={CARD.height} />
      <div style={{ position: 'absolute', left: 64, top: 0, width: rects[0].x - 64 - 48, height: CARD.height, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ ...DISPLAY, display: 'flex', fontSize: titleSize(title, count === 9 ? 68 : 60), lineHeight: 1.1, color: L.ink }}>{title}</div>
        <div style={{ ...TEXT, display: 'flex', fontSize: 28, color: L.ink2, marginTop: 20 }}>{`${SIZE_WORD[count]} books, each with a favourite cover.`}</div>
        <div style={{ display: 'flex', marginTop: 44 }}>
          <Wordmark size={36} color={look === 'paper' ? OG.accent : OG.accentDark} />
        </div>
      </div>
      <Tiles rects={rects} images={images} look={look} />
    </div>
  );
}

export async function GET(request: NextRequest) {
  const refused = closed(request, 'inspirationPoster');
  if (refused) return refused;
  const params = request.nextUrl.searchParams;
  const rawFormat = params.get('format');
  const format: Format = rawFormat === 'feed' || rawFormat === 'card' ? rawFormat : 'story';
  const rawLook = params.get('look');
  const look: Look = rawLook === 'paper' || rawLook === 'plain' ? rawLook : 'ambient';
  const board = parseBoard(params);
  if (filledCount(board) === 0) return json({ error: 'An empty board has no picture.' }, 400);

  const count = sizeOf(board);
  const title = board.by ? `The books that inspired ${board.by}` : 'The books that inspired me';
  const rects = format === 'card' ? cardRects(count) : posterLayout(format, count).tiles;
  const size = format === 'card' ? { width: CARD.width, height: CARD.height } : { width: posterLayout(format, count).width, height: posterLayout(format, count).height };
  const tiles = await Promise.all(board.slots.map((s, i) => (s ? tile(s.coverId, rects[i].width, rects[i].height) : null)));
  const whole = board.slots.every((s, i) => !s || tiles[i]);
  const ground = look === 'ambient' ? await ambient(size.width, size.height, rects, tiles) : null;
  const images = tiles.map((t) => (t ? dataUrl(t) : null));

  const picture = await asJpeg(new ImageResponse(format === 'card' ? card(count, title, images, look, ground) : poster(format, count, title, images, look, ground), { ...size, fonts: await ogFonts() }));
  const headers = new Headers(picture.headers);
  headers.set('Cache-Control', whole ? 'public, max-age=3600, s-maxage=2592000' : 'no-store');
  return new Response(picture.body, { status: 200, headers });
}
