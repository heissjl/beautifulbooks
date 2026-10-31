import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { asJpeg, DISPLAY, loadCovers, OG, ogFonts, TEXT, Wordmark } from '@/app/og';
import { PIN_ADDRESS } from '@/app/pin';
import { COMPARE_COUNT, compareLayout, fitLabel } from '@/lib/comparelayout';
import { compareOrder } from '@/lib/comparepin';
import { PIN_SIZE, type Rect } from '@/lib/pinlayout';

/**
 * The comparison pin (ROADMAP 5.5a, second format): one book in three
 * editions side by side, 1000 × 1500, the year and the publisher under each
 * cover. Same machinery as the grid pin (`app/pin.tsx`): every candidate is
 * asked at once with the whole budget (a cover kept in one of archive.org's
 * zip files takes 15 s with Node's fetch), the first three that come are
 * drawn; a spare that stands in for a chosen cover makes the picture a
 * short-held one, as a hole does on the grid pin.
 */
const BUDGET_MS = 16000;
const HELD = 'public, max-age=3600, s-maxage=86400';
const HOLE = 'public, max-age=0, s-maxage=300';

export interface CompareInput {
  title: string;
  line: string;
  /** The chosen covers first, then spares, in the order `pickCompareCovers` gives. */
  candidates: ReadonlyArray<{ url: string; year?: number; publisher?: string }>;
  /** The covers were asked for by id: keep their order. */
  explicit: boolean;
  /** The catalogue answered whole; a part-way answer is drawn but held briefly. */
  complete: boolean;
}

interface Shown { src: string; year?: number; publisher?: string }

async function cut(dataUrl: string, tile: Rect): Promise<string> {
  try {
    const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    const jpeg = await sharp(bytes).resize(tile.width, tile.height, { fit: 'cover', position: 'centre' }).jpeg({ quality: 88 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
  } catch {
    return dataUrl;
  }
}

export async function comparePicture(input: CompareInput): Promise<Response> {
  const L = compareLayout(input.title);
  // Every candidate is asked at once; the chosen three are awaited, a spare only when one of them did not come.
  const asked = input.candidates.map(async (c): Promise<Shown | null> => {
    const [src] = await loadCovers([c.url], 1, BUDGET_MS);
    return src ? { src: await cut(src, L.tiles[0]), year: c.year, publisher: c.publisher } : null;
  });
  const chosen = (await Promise.all(asked.slice(0, COMPARE_COUNT))).filter((g): g is Shown => g !== null);
  const substituted = chosen.length < COMPARE_COUNT;
  const spares = substituted ? (await Promise.all(asked.slice(COMPARE_COUNT))).filter((g): g is Shown => g !== null) : [];
  const shown = compareOrder([...chosen, ...spares].slice(0, COMPARE_COUNT), input.explicit);
  const whole = shown.length === COMPARE_COUNT && !substituted && input.complete;

  const picture = await asJpeg(new ImageResponse(
    (
      <div style={{ position: 'relative', width: L.width, height: L.height, display: 'flex', background: OG.bg }}>
        <div style={{ position: 'absolute', left: L.head.x, top: L.head.y, width: L.head.width, display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...DISPLAY, display: 'flex', fontSize: L.titleSize, lineHeight: 1.1, color: OG.ink }}>{input.title}</div>
          {input.line && <div style={{ ...TEXT, display: 'flex', fontSize: L.type.line, lineHeight: 1.3, marginTop: 12, color: OG.ink2 }}>{input.line}</div>}
        </div>
        {L.tiles.map((r, i) => (
          <div key={i} style={{ position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height, display: 'flex', background: '#26221f', borderRadius: 6, overflow: 'hidden' }}>
            {shown[i] && (
              // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain <img>
              <img src={shown[i].src} alt="" width={r.width} height={r.height} />
            )}
          </div>
        ))}
        {L.labels.map((r, i) => {
          const s = shown[i];
          if (!s) return null;
          const publisher = s.publisher ? fitLabel(s.publisher, r.width, L.type.publisher) : null;
          return (
            <div key={i} style={{ position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
              {s.year && <div style={{ ...DISPLAY, display: 'flex', fontSize: L.type.year, lineHeight: 1.1, color: OG.ink }}>{String(s.year)}</div>}
              {publisher && <div style={{ ...TEXT, display: 'flex', fontSize: publisher.size, lineHeight: 1.3, marginTop: 6, color: OG.ink2, whiteSpace: 'nowrap' }}>{publisher.text}</div>}
            </div>
          );
        })}
        <div style={{ position: 'absolute', left: L.foot.x, top: L.foot.y, width: L.foot.width, height: L.foot.height, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Wordmark size={L.type.site} color={OG.ink} />
          <div style={{ ...TEXT, display: 'flex', fontSize: L.type.address, color: OG.ink2 }}>{PIN_ADDRESS}</div>
        </div>
      </div>
    ),
    { ...PIN_SIZE, fonts: await ogFonts() },
  ), true);
  picture.headers.set('Cache-Control', whole ? HELD : HOLE);
  picture.headers.set('X-Pin-Format', 'compare');
  picture.headers.set('X-Pin-Covers', String(shown.length));
  picture.headers.set('X-Pin-Title-Lines', String(L.titleLines));
  picture.headers.set('X-Pin-Title-Size', String(L.titleSize));
  return picture;
}
