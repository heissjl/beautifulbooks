import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { closed, json } from '@/app/api/inspiration/guard';
import { asJpeg, DISPLAY, OG, ogFonts, TEXT, Wordmark } from '@/app/og';
import { isHiddenCover } from '@/lib/hiddencovers';
import { coverUrlFor } from '@/lib/coverurl';
import { type BoardSize, filledCount, parseBoard, sizeOf } from '@/lib/inspiration/board';
import { describeBoard } from '@/lib/inspiration/describe';
import { posterLayout, type PosterFormat, type Rect } from '@/lib/inspiration/layout';
import { subtitleOf, titleOf } from '@/lib/inspiration/share';
import { SITE_URL } from '@/lib/seo';

/**
 * GET /api/inspiration/poster?b=…&by=…&format=story|feed|card[&look=…][&titles=1]
 * — the picture of a board (ROADMAP 5.18b).
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
 * cast a shadow on it (painted into the ground, see `shadows`). `paper` is the site's warm ground with dark type, the
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
const ADDRESS = `${/^https?:\/\/(localhost|127\.|\[::1\])/.test(SITE_URL) || SITE_URL.includes('vercel.app') ? 'buyitscovers.com' : new URL(SITE_URL).host}/shelfportrait`;

type Format = PosterFormat | 'card';
type Look = 'ambient' | 'paper' | 'plain';

/** `shadow` is how dark the covers' shadow falls on the ground, 0 for none. */
const LOOKS: Record<Look, { bg: string; ink: string; ink2: string; mark: string; empty: string; shadow: number }> = {
  ambient: { bg: OG.bg, ink: OG.ink, ink2: '#d2cbc2', mark: OG.ink, empty: 'rgba(255,255,255,0.08)', shadow: 0.62 },
  paper: { bg: OG.paper, ink: OG.paperInk, ink2: OG.paperInk2, mark: OG.accent, empty: '#e6dfd3', shadow: 0.3 },
  plain: { bg: OG.bg, ink: OG.ink, ink2: OG.ink2, mark: OG.ink, empty: '#2a2522', shadow: 0 },
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
 * The covers themselves as a wash of colour: each one shrunk to a few pixels
 * and set side by side as they stand on the board, that small mosaic
 * stretched over the whole picture and blurred until no cover can be told —
 * only where the reds and the blues are. Then darkened, with the edges drawn
 * in, so the type at the top and bottom stays readable on any board.
 * Stretched rather than painted in place: the first try left the bands above
 * and below the covers black, with an edge where the colour began.
 */
async function wash(width: number, height: number, rects: Rect[], tiles: (Buffer | null)[]): Promise<Buffer> {
  // Three across, whatever the picture's own arrangement: only the colours and roughly where they are matter here.
  const cols = 3;
  const rows = Math.ceil(rects.length / cols);
  const cell = { w: 12, h: 18 };
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
  return sharp(soft).composite([{ input: shade }]).png().toBuffer();
}

/**
 * The shadow the covers cast, as one soft layer: a dark rectangle under every
 * cover that came, a little lower than the cover, blurred at a quarter of the
 * size. **Painted here and not as `boxShadow` in the generator**, for two
 * reasons found on the first preview: nine blurred shadows of that size took
 * the story from 5 s to 29 s on Vercel, a second short of the function's
 * limit; and a tile with `boxShadow: 'none'` — every empty place — made the
 * generator paint a black rectangle the size of a tile over the top left
 * corner of the picture.
 */
async function shadows(width: number, height: number, rects: Rect[], tiles: (Buffer | null)[], strength: number): Promise<Buffer | null> {
  const k = 4;
  const w = Math.round(width / k);
  const h = Math.round(height / k);
  const drop = 20;
  const spots = rects.flatMap((r, i) => {
    if (!tiles[i]) return [];
    const left = Math.round(r.x / k);
    const top = Math.round((r.y + drop) / k);
    const sw = Math.min(Math.round(r.width / k), w - left);
    const sh = Math.min(Math.round(r.height / k), h - top);
    return sw > 0 && sh > 0 ? [{ input: { create: { width: sw, height: sh, channels: 4 as const, background: { r: 8, g: 6, b: 5, alpha: strength } } }, left, top }] : [];
  });
  if (spots.length === 0) return null;
  const layer = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 8, g: 6, b: 5, alpha: 0 } } }).composite(spots).png().toBuffer();
  const soft = await sharp(layer).blur(7).png().toBuffer();
  return sharp(soft).resize(width, height, { fit: 'fill', kernel: 'cubic' }).png().toBuffer();
}

/** What the covers stand on, as one picture: the wash or the flat colour, and the shadows. Null when it cannot be made — the flat colour stands in. */
async function ground(look: Look, width: number, height: number, rects: Rect[], tiles: (Buffer | null)[]): Promise<string | null> {
  const L = LOOKS[look];
  if (L.shadow === 0) return null;
  try {
    const base = look === 'ambient'
      ? await wash(width, height, rects, tiles)
      : await sharp({ create: { width, height, channels: 3, background: L.bg } }).png().toBuffer();
    const cast = await shadows(width, height, rects, tiles, L.shadow);
    return dataUrl(await sharp(base).composite(cast ? [{ input: cast }] : []).jpeg({ quality: 90 }).toBuffer());
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
        <div key={i} style={{ position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height, display: 'flex', background: L.empty }}>
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

/** The largest size at which the longest word of `text` still fits `width` — a narrow column breaks between words, never inside one. */
function wordFit(text: string, width: number, max: number): number {
  // A hyphen is a place to break too: "Shelf-Portrait" may stand on two lines.
  const longest = Math.max(...text.split(/[\s-]+/).map((w) => w.length), 1);
  return Math.min(max, Math.floor(width / (longest * 0.5)));
}

/**
 * A line cut to what `width` holds at `size`; the generator's own ellipsis is
 * not relied on. Half an em a letter: at 0.47 "A Confederacy of D…" was let
 * through as fitting, ran over and broke into two lines on the preview —
 * which is why a caption is also `ONE_LINE`.
 */
function clip(text: string, width: number, size: number): string {
  const max = Math.max(4, Math.floor(width / (size * 0.5)));
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** A caption never takes a second line: the next row of covers begins where it would stand. */
const ONE_LINE = { whiteSpace: 'nowrap', overflow: 'hidden' } as const;

type Caption = { title: string; author: string } | null;

function poster(format: PosterFormat, count: BoardSize, by: string, images: (string | null)[], look: Look, under: string | null, captions: Caption[] | null) {
  const P = posterLayout(format, count, !!captions);
  const L = LOOKS[look];
  const { head, foot, type } = P;
  const title = titleOf(by);
  return (
    <div style={{ position: 'relative', width: P.width, height: P.height, display: 'flex', background: L.bg }}>
      <Ground src={under} width={P.width} height={P.height} />
      {/* Two lines (Julian, 2026-10-05): the name of the thing, and under it what it is. */}
      <div style={{ position: 'absolute', left: head.x, top: head.y, width: head.width, height: head.height - type.title * 0.3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{ ...DISPLAY, display: 'flex', textAlign: 'center', fontSize: titleSize(title, type.title), lineHeight: 1.12, color: L.ink }}>{title}</div>
        <div style={{ ...TEXT, display: 'flex', textAlign: 'center', fontSize: Math.round(type.title * 0.5), color: L.ink2, marginTop: type.title * 0.12 }}>{clip(subtitleOf(by, count), head.width, type.title * 0.5)}</div>
      </div>
      <Tiles rects={P.tiles} images={images} look={look} />
      {captions && P.caption && P.tiles.map((r, i) => captions[i] && (
        <div key={i} style={{ position: 'absolute', left: r.x, top: r.y + r.height + 10, width: r.width, display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...TEXT, ...ONE_LINE, display: 'flex', fontSize: P.caption?.title, lineHeight: 1.2, color: L.ink }}>{clip(captions[i]?.title ?? '', r.width, P.caption?.title ?? 24)}</div>
          <div style={{ ...TEXT, ...ONE_LINE, display: 'flex', fontSize: P.caption?.author, lineHeight: 1.25, color: L.ink2 }}>{clip(captions[i]?.author ?? '', r.width, P.caption?.author ?? 20)}</div>
        </div>
      ))}
      <div style={{ position: 'absolute', left: foot.x, top: foot.y, width: foot.width, height: foot.height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Wordmark size={type.site} color={L.mark} />
        <div style={{ ...TEXT, display: 'flex', fontSize: type.address, color: L.ink2, marginTop: type.address * 0.15 }}>{ADDRESS}</div>
      </div>
    </div>
  );
}

/**
 * The link card, 1200 × 630 (Julian, 2026-10-05: „the space usage in der
 * vorschaukachel muss noch besser sein … es sollte BuyItsCovers.com heißen").
 * The first card set nine covers at 120 × 180 into the right third and left
 * the rest to a title. Now the covers take the height they can get:
 * - nine: two rows of five places, the words in the first place and a cover in
 *   each of the other nine — 186 × 279, two and a half times the area;
 * - six: three by two at the same size on the right, the words beside them;
 * - three: side by side at 264 × 396, the words beside them.
 */
const CARD = { width: 1200, height: 630, gap: 12 };

function cardPlan(count: BoardSize): { covers: Rect[]; words: Rect; title: number } {
  const place = (x0: number, y0: number, w: number, h: number, cols: number, n: number, skip = 0): Rect[] =>
    Array.from({ length: n }, (_, k) => {
      const i = k + skip;
      return { x: x0 + (i % cols) * (w + CARD.gap), y: y0 + Math.floor(i / cols) * (h + CARD.gap), width: w, height: h };
    });
  if (count === 9) {
    const w = 186, h = 279;
    const x0 = Math.round((CARD.width - (5 * w + 4 * CARD.gap)) / 2);
    const y0 = Math.round((CARD.height - (2 * h + CARD.gap)) / 2);
    return { covers: place(x0, y0, w, h, 5, 9, 1), words: { x: x0, y: y0, width: w - 14, height: h }, title: 38 };
  }
  if (count === 6) {
    const w = 186, h = 279;
    const x0 = CARD.width - 40 - (3 * w + 2 * CARD.gap);
    const y0 = Math.round((CARD.height - (2 * h + CARD.gap)) / 2);
    return { covers: place(x0, y0, w, h, 3, 6), words: { x: 56, y: y0, width: x0 - 56 - 44, height: 2 * h + CARD.gap }, title: 72 };
  }
  const w = 264, h = 396;
  const x0 = CARD.width - 40 - (3 * w + 2 * CARD.gap);
  const y0 = Math.round((CARD.height - h) / 2);
  return { covers: place(x0, y0, w, h, 3, 3), words: { x: 48, y: y0, width: x0 - 48 - 36, height: h }, title: 50 };
}

function card(count: BoardSize, by: string, images: (string | null)[], look: Look, under: string | null) {
  const plan = cardPlan(count);
  const L = LOOKS[look];
  const title = titleOf(by);
  const { words } = plan;
  const size = wordFit(title, words.width, plan.title);
  // The address must fit its column with the spacing: sixteen letters, measured at 0.41 em each in Xanh italic.
  // "A little larger" (Julian, 2026-10-05): it was half the title's size and capped at 21 px on the card of nine.
  const sign = Math.min(Math.max(22, Math.round(size * 0.6)), Math.floor(words.width / (16 * 0.44)));
  return (
    <div style={{ position: 'relative', width: CARD.width, height: CARD.height, display: 'flex', background: L.bg }}>
      <Ground src={under} width={CARD.width} height={CARD.height} />
      <div style={{ position: 'absolute', left: words.x, top: words.y, width: words.width, height: words.height, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...DISPLAY, display: 'flex', fontSize: size, lineHeight: 1.06, color: L.ink }}>{title}</div>
          <div style={{ ...TEXT, display: 'flex', fontSize: Math.max(17, Math.round(size * 0.46)), lineHeight: 1.25, color: L.ink2, marginTop: Math.round(size * 0.3) }}>{subtitleOf(by, count)}</div>
        </div>
        {/*
          The site's line, "Judge a book, buy its covers", with its second half as the address — one
          word, the way it is typed. Two faces and two colours, so that nobody takes the whole
          phrase for the link (Julian, 2026-10-05); the address a little spaced out, as he asked.
        */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...TEXT, display: 'flex', fontSize: Math.max(17, Math.round(sign * 0.7)), color: L.ink2, marginBottom: Math.round(sign * 0.12) }}>Judge a book,</div>
          <div style={{ ...DISPLAY, display: 'flex', fontStyle: 'italic', fontSize: sign, letterSpacing: sign * 0.045, color: look === 'paper' ? OG.accent : OG.accentDark }}>BuyItsCovers.com</div>
        </div>
      </div>
      <Tiles rects={plan.covers} images={images} look={look} />
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
  // Titles and authors under the covers, when the reader asks for them; a link card has no room for them.
  const withTitles = params.get('titles') === '1' && format !== 'card';
  const asked = parseBoard(params);
  if (filledCount(asked) === 0) return json({ error: 'An empty board has no picture.' }, 400);
  // A cover taken off the site on request (2.18k) is not drawn: its place stays empty, as on the page.
  const board = { ...asked, slots: asked.slots.map((s) => (s && isHiddenCover(s.coverId) ? null : s)) };

  const count = sizeOf(board);
  const layout = format === 'card' ? null : posterLayout(format, count, withTitles);
  const rects = layout ? layout.tiles : cardPlan(count).covers;
  const size = layout ? { width: layout.width, height: layout.height } : { width: CARD.width, height: CARD.height };
  const [tiles, described] = await Promise.all([
    Promise.all(board.slots.map((s, i) => (s ? tile(s.coverId, rects[i].width, rects[i].height) : null))),
    withTitles ? describeBoard(board) : null,
  ]);
  const captions = described ? described.books.map((b) => (b?.title ? { title: b.title, author: b.author ?? '' } : null)) : null;
  // Kept only when it is whole: every cover came, and every title that was asked for.
  const whole = board.slots.every((s, i) => !s || tiles[i]) && (!captions || board.slots.every((s, i) => !s || captions[i]));
  const under = await ground(look, size.width, size.height, rects, tiles);
  const images = tiles.map((t) => (t ? dataUrl(t) : null));

  const picture = await asJpeg(new ImageResponse(
    format === 'card' ? card(count, board.by, images, look, under) : poster(format, count, board.by, images, look, under, captions),
    { ...size, fonts: await ogFonts() },
  // A story or a post is compressed again by Instagram; the card stays small for the messengers.
  ), format !== 'card');
  const headers = new Headers(picture.headers);
  headers.set('Cache-Control', whole ? 'public, max-age=3600, s-maxage=2592000' : 'no-store');
  return new Response(picture.body, { status: 200, headers });
}
