/**
 * The poster as a PNG (lab/inspiration). The geometry is `layout.ts`, which is pure
 * and tested; this file only paints it.
 *
 * Painted with sharp (a devDependency already) and an SVG for the text, so
 * the faces are whatever fontconfig finds — DejaVu Serif in the sandbox. The
 * site's own version would be `next/og` with Xanh and Jost, as the link cards
 * are (`app/og.tsx`); that is the promotion step, not this experiment.
 */
import sharp from 'sharp';
import type { Board } from '../../lib/inspiration/board';
import { posterLayout, type PosterFormat, type Rect } from '../../lib/inspiration/layout';

/** The link cards' dark ground and paper ink (`OG` in app/og.tsx), copied: lab never imports app/. */
const BG = '#131110';
const INK = '#f4f0e8';
const INK2 = '#a8a09a';
const EMPTY = '#2a2522';

export interface PosterText {
  /** Top line, e.g. "The books that inspired me". */
  title: string;
  /** Bottom line: the site's name. */
  site: string;
  /** Bottom line: the address a reader types, without https://. */
  address: string;
}

/** Loads the image of a cover, or null when the source does not answer. */
export type CoverLoader = (coverId: string) => Promise<Uint8Array | null>;

const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function textSvg(width: number, height: number, parts: string[]): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join('')}</svg>`);
}

function line(text: string, rect: Rect, y: number, size: number, fill: string, italic = false): string {
  return `<text x="${rect.x + rect.width / 2}" y="${y}" font-family="DejaVu Serif, Georgia, serif" font-size="${size}"` +
    ` fill="${fill}" text-anchor="middle"${italic ? ' font-style="italic"' : ''}>${esc(text)}</text>`;
}

export async function renderPoster(
  board: Board,
  format: PosterFormat,
  text: PosterText,
  load: CoverLoader,
): Promise<Buffer> {
  const L = posterLayout(format);
  const images = await Promise.all(board.slots.map(s => (s ? load(s.coverId).catch(() => null) : null)));

  // A hairline ground under every tile, so a black cover does not dissolve into the black poster.
  const frames = L.tiles.map(rect => ({
    input: { create: { width: rect.width + 4, height: rect.height + 4, channels: 3 as const, background: EMPTY } },
    left: rect.x - 2,
    top: rect.y - 2,
  }));

  const tiles = await Promise.all(L.tiles.map(async (rect, i) => {
    const bytes = images[i];
    const input = bytes
      // `cover`: a scan is rarely exactly 2:3; trimming a sliver beats a letterbox.
      ? await sharp(bytes).resize(rect.width, rect.height, { fit: 'cover', position: 'centre' }).png().toBuffer().catch(() => null)
      : null;
    return {
      input: input ?? { create: { width: rect.width, height: rect.height, channels: 3 as const, background: EMPTY } },
      left: rect.x,
      top: rect.y,
    };
  }));

  const { head, foot, type } = L;
  // One line at the top: the title already carries the name ("… inspired Julian"), and a
  // byline under it printed the name twice on the first poster made from a real board.
  const siteY = foot.y + (foot.height - type.site - type.address) / 2 + type.site * 0.85;
  const svg = textSvg(L.width, L.height, [
    line(text.title, head, head.height - type.title * 0.75, type.title, INK),
    line(text.site, foot, siteY, type.site, INK, true),
    line(text.address, foot, siteY + type.address * 1.3, type.address, INK2),
  ]);

  return sharp({ create: { width: L.width, height: L.height, channels: 3, background: BG } })
    .composite([...frames, ...tiles, { input: svg, left: 0, top: 0 }])
    .png()
    .toBuffer();
}
