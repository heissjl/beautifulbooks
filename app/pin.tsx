import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { asJpeg, DISPLAY, loadCovers, OG, ogFonts, TEXT, Wordmark } from '@/app/og';
import { ARTWORK_HEIGHT, ARTWORK_WIDTH, distinctArtwork } from '@/lib/artwork';
import { mosaicGround } from '@/lib/inspiration/mosaicground';
import { PIN_SIZE, pinCount, pinLayout, pinTitleLines, pinTitleSize, type PinCount, type Rect } from '@/lib/pinlayout';
import { SITE_URL } from '@/lib/seo';

/**
 * The Pinterest pin of a work or a collection, 1000 × 1500 (ROADMAP 5.5a):
 * the same machinery as the link cards (`app/og.tsx` — faces, colours,
 * `loadCovers`, `asJpeg`), in the one format Pinterest shows at full size
 * (PLAN-5.5-5.6 §7). Where things stand is `lib/pinlayout.ts`.
 *
 * Nine covers three by three, or six when fewer than nine load; a candidate
 * that does not come is replaced by the next, in order, so the picture has
 * no holes. A pin with every tile filled is held a day at the edge like the
 * cards; one with a hole is held five minutes, because a silent cover host
 * is an episode, not a fact about the cover (the poster's rule).
 *
 * The address at the bottom is the way back from a picture that is saved
 * without its link. Never localhost or a preview host: the picture travels.
 *
 * The ground is the share pictures' mosaic (Julian, 2026-10-31: „die
 * nächsten entwürfe sollten den mosaik hintergrund haben"): the field of tiny
 * covers cut from the loading pictures (`lib/inspiration/mosaicground.ts`),
 * no cover requested for it, seeded by the pin so one pin always gets the
 * same field, dimmed and darker still behind the title and the foot so the
 * type reads; the covers stand on it with a shadow, as on the poster.
 */

/** The address as the pin shows it (Julian's spelling for pictures). */
export const PIN_ADDRESS = 'BuyItsCovers.com';

/**
 * The covers' budget. Open Library answers an image through archive.org,
 * 0.5–1.7 s each on a good day (2026-09-29); a cover kept in one of the
 * archive's zip files takes 3–7 s with curl and **15 s with Node's fetch**
 * (nine of *Dune*'s in parallel, 2026-10-31, as umgang §10 found for the
 * poster), whatever the size — a medium fallback gains nothing. So every
 * candidate is asked at once, each with the whole budget, and the first
 * `want` that came are drawn in the wall's order; the picture is then drawn
 * at 16 s at the latest, inside the function's 30 s with the generator and
 * `sharp` after it. Twelve candidates for nine tiles: the wall card asks
 * fourteen at once, the poster nine.
 */
const BUDGET_MS = 16000;
const CANDIDATES = 12;
/** A work's pin drops repeated pictures, so it asks for more: the route hands eighteen. */
const DISTINCT_CANDIDATES = 18;

const HELD = 'public, max-age=3600, s-maxage=86400';
const HOLE = 'public, max-age=0, s-maxage=300';

export interface PinCover {
  url: string;
  /** What the collection file credits for this cover, when it does. */
  credit?: string;
}

export interface PinInput {
  title: string;
  /** The author, or a collection's one-line subtitle. */
  line: string;
  /** Candidates in the wall's order; the first nine that load are drawn. */
  covers: readonly PinCover[];
  /** Named beside the credits, e.g. "ISFDB"; absent when no cover carries one. */
  creditSource?: string;
  /** What seeds the mosaic ground: the work's id or the collection's slug. */
  seed: string;
  /**
   * No picture twice, across languages too (`lib/artwork.ts`): a work's pin,
   * never a collection's — a series' covers are meant to look alike.
   */
  distinctArtwork?: boolean;
}

/** How dark the mosaic is where no word stands (the poster's board picture uses half). */
const GROUND_BASE = 0.55;
/** How dark right behind the title and the foot. */
const GROUND_WORDS = 0.86;

/**
 * The mosaic ground as a JPEG data URL for the generator: smaller to draw than the PNG it comes as.
 * `words` are the boxes that get darker for the type; the comparison pin passes its own (`app/comparepin.tsx`).
 */
export async function pinGround(seed: string, width: number, height: number, words: readonly Rect[]): Promise<string | null> {
  try {
    const png = await mosaicGround(width, height, `pin:${seed}`, words.map(w => ({ ...w, dark: GROUND_WORDS })), [], GROUND_BASE);
    const jpeg = await sharp(png).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    // No loading pictures on this instance: the plain ground, as before.
    return null;
  }
}

/** The covers in the wall's order, each cut to its tile: every candidate asked at once (see `BUDGET_MS`), a credit staying with its cover. */
async function loadTiles(covers: readonly PinCover[], want: number, tile: Rect, distinct: boolean): Promise<{ tiles: Tile[]; failed: number }> {
  const asked = covers.slice(0, distinct ? DISTINCT_CANDIDATES : CANDIDATES);
  const got = await Promise.all(asked.map(async (c): Promise<Tile | null> => {
    const [src] = await loadCovers([c.url], 1, BUDGET_MS);
    if (!src) return null;
    return { src: await cut(src, tile), credit: c.credit, raster: distinct ? await artworkRaster(src) : undefined };
  }));
  const tiles = got.filter((g): g is Tile => g !== null);
  return { tiles: (distinct ? distinctArtwork(tiles, t => t.raster, 6) : tiles).slice(0, want), failed: asked.length - tiles.length };
}

interface Tile { src: string; credit?: string; raster?: Uint8Array }

/** The small raster `lib/artwork.ts` compares, a scan's plain margin trimmed first; none when the picture does not decode. */
async function artworkRaster(dataUrl: string): Promise<Uint8Array | undefined> {
  try {
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    let source: Buffer = bytes;
    try {
      const trimmed = await sharp(bytes).removeAlpha().trim({ threshold: 25 }).toBuffer();
      const { width = 0, height = 0 } = await sharp(trimmed).metadata();
      if (width > 60 && height > 90) source = trimmed;
    } catch { /* nothing to trim */ }
    return new Uint8Array(await sharp(source).removeAlpha().resize(ARTWORK_WIDTH, ARTWORK_HEIGHT, { fit: 'fill' }).raw().toBuffer());
  } catch {
    return undefined;
  }
}

/** A cover scaled to its tile before the generator sees it: a smaller picture to draw, and a scan that is not exactly 2:3 trimmed rather than letterboxed. */
async function cut(dataUrl: string, tile: Rect): Promise<string> {
  try {
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    const jpeg = await sharp(bytes).resize(tile.width, tile.height, { fit: 'cover', position: 'centre' }).jpeg({ quality: 88 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return dataUrl;
  }
}

/** The credits line: the artists of the covers shown, each once, cut to what the line holds, "and others" for the rest. */
export function creditsLine(credits: readonly (string | undefined)[], source?: string, maxChars = 72): string {
  const names: string[] = [];
  for (const c of credits) if (c && !names.includes(c)) names.push(c);
  if (names.length === 0) return '';
  const shown: string[] = [];
  for (const name of names) {
    const next = [...shown, name].join(', ');
    if (shown.length > 0 && next.length > maxChars) break;
    shown.push(name);
  }
  const rest = names.length - shown.length;
  const list = rest > 0 ? `${shown.join(', ')} and others` : shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0];
  return `Cover art: ${list}${source ? ` (${source})` : ''}`;
}

export async function pinPicture(input: PinInput): Promise<Response> {
  const wanted: PinCount = input.covers.length >= 9 ? 9 : 6;
  const titleSize = pinTitleSize(input.title);
  const titleLines = pinTitleLines(input.title, titleSize);
  const probe = pinLayout(wanted, { credits: input.covers.some(c => c.credit), titleLines });
  const { tiles: loaded, failed } = await loadTiles(input.covers, wanted, probe.tiles[0], input.distinctArtwork === true);
  const count = pinCount(loaded.length);
  const credits = creditsLine(loaded.map(t => t.credit), input.creditSource);
  // Fewer than six: the six-layout with what came, and a short hold.
  const L = pinLayout(count || 6, { credits: credits !== '', titleLines });
  // Every tile filled — or the wall itself has fewer than nine and six came.
  const whole = loaded.length >= 9 || (loaded.length >= 6 && (input.covers.length < 9 || (input.distinctArtwork === true && failed === 0)));
  const tiles = loaded.slice(0, count || 6);
  const field = await pinGround(input.seed, L.width, L.height, [L.head, L.foot]);

  const picture = await asJpeg(new ImageResponse(
    (
      <div style={{ position: 'relative', width: L.width, height: L.height, display: 'flex', background: OG.bg }}>
        {field && (
          // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img>
          <img src={field} alt="" width={L.width} height={L.height} style={{ position: 'absolute', left: 0, top: 0 }} />
        )}
        <div style={{ position: 'absolute', left: L.head.x, top: L.head.y, width: L.head.width, display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...DISPLAY, display: 'flex', fontSize: titleSize, lineHeight: 1.1, color: OG.ink }}>{input.title}</div>
          {input.line && <div style={{ ...TEXT, display: 'flex', fontSize: L.type.line, lineHeight: 1.3, marginTop: 12, color: OG.ink2 }}>{input.line}</div>}
        </div>
        {L.tiles.map((r, i) => (
          <div key={i} style={{ position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height, display: 'flex', background: '#26221f', borderRadius: 6, overflow: 'hidden', boxShadow: field ? '0 10px 28px rgba(0, 0, 0, 0.62)' : undefined }}>
            {tiles[i] && (
              // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img>
              <img src={tiles[i].src} alt="" width={r.width} height={r.height} />
            )}
          </div>
        ))}
        <div style={{ position: 'absolute', left: L.foot.x, top: L.foot.y, width: L.foot.width, height: L.foot.height, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          {credits && <div style={{ ...TEXT, display: 'flex', fontSize: L.type.credits, lineHeight: 1.3, fontStyle: 'italic', color: OG.ink2, marginBottom: 14, whiteSpace: 'nowrap', overflow: 'hidden' }}>{credits}</div>}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Wordmark size={L.type.site} color={OG.ink} />
            <div style={{ ...TEXT, display: 'flex', fontSize: L.type.address, color: OG.ink2 }}>{PIN_ADDRESS}</div>
          </div>
        </div>
      </div>
    ),
    { ...PIN_SIZE, fonts: await ogFonts() },
  ), true);
  picture.headers.set('Cache-Control', whole ? HELD : HOLE);
  // For the probe (`scripts/measure-pins.ts`): how many covers were drawn and whether a credits line stands.
  picture.headers.set('X-Pin-Covers', String(tiles.length));
  picture.headers.set('X-Pin-Credits', credits ? '1' : '0');
  picture.headers.set('X-Pin-Title-Lines', String(titleLines));
  return picture;
}

/** A collection's own image is a path on this site; a fetch needs the whole address. */
export function absoluteCover(src: string): string {
  return src.startsWith('/') ? `${SITE_URL}${src}` : src;
}
