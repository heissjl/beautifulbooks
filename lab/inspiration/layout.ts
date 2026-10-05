/**
 * Where things go on the poster (lab/inspiration, pure).
 *
 * Book covers are 2:3, album covers 1:1, so a 3 × 3 of covers is itself 2:3
 * (1080 × 1620 at full width) and fits neither a story nor a feed post
 * without a frame. The grid is therefore sized from the height that is left
 * after the title and the address, and centred; its width follows from the
 * 2:3 tiles. In a story (9:16) that leaves wide tiles and room for the text;
 * in a feed post (4:5) the tiles shrink and side margins appear.
 */

export type PosterFormat = 'story' | 'feed';

export interface Rect { x: number; y: number; width: number; height: number }

export interface PosterLayout {
  width: number;
  height: number;
  /** Nine rectangles, row by row. */
  tiles: Rect[];
  /** Top band: one line, "The books that inspired me" or "… inspired <name>". */
  head: Rect;
  /** Bottom band: the site's name and address. */
  foot: Rect;
  /**
   * Font sizes in px for the title, the site's name and the address. The
   * address is the only way back from a picture that carries no link, so it is
   * sized for a phone: a 1080 px canvas shown 390 CSS px wide makes 40 px read
   * as 14 (it was 27, which read as under 10).
   */
  type: { title: number; site: number; address: number };
}

interface Spec {
  width: number;
  height: number;
  head: number;
  foot: number;
  margin: number;
  gap: number;
  type: PosterLayout['type'];
}

const SPECS: Record<PosterFormat, Spec> = {
  // 9:16, Instagram/WhatsApp story and TikTok photo.
  story: { width: 1080, height: 1920, head: 300, foot: 200, margin: 60, gap: 24, type: { title: 64, site: 44, address: 40 } },
  // 4:5, the tallest a feed post may be.
  feed: { width: 1080, height: 1350, head: 140, foot: 130, margin: 60, gap: 18, type: { title: 52, site: 34, address: 32 } },
};

export const POSTER_SIZES: Record<PosterFormat, { width: number; height: number }> = {
  story: { width: SPECS.story.width, height: SPECS.story.height },
  feed: { width: SPECS.feed.width, height: SPECS.feed.height },
};

export function posterLayout(format: PosterFormat): PosterLayout {
  const s = SPECS[format];
  const byHeight = Math.floor((s.height - s.head - s.foot - 2 * s.gap) / 3);
  const byWidth = Math.floor(((s.width - 2 * s.margin - 2 * s.gap) / 3) * 1.5);
  // A multiple of three, so that width = height * 2/3 is a whole number exactly.
  const tileH = Math.min(byHeight, byWidth) - (Math.min(byHeight, byWidth) % 3);
  const tileW = (tileH / 3) * 2;
  const gridW = 3 * tileW + 2 * s.gap;
  const gridH = 3 * tileH + 2 * s.gap;
  const x0 = Math.round((s.width - gridW) / 2);
  // The grid sits in the middle of what head and foot leave.
  const y0 = s.head + Math.round((s.height - s.head - s.foot - gridH) / 2);
  const tiles: Rect[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      tiles.push({ x: x0 + col * (tileW + s.gap), y: y0 + row * (tileH + s.gap), width: tileW, height: tileH });
    }
  }
  return {
    width: s.width,
    height: s.height,
    tiles,
    head: { x: s.margin, y: 0, width: s.width - 2 * s.margin, height: y0 },
    foot: { x: s.margin, y: y0 + gridH, width: s.width - 2 * s.margin, height: s.height - y0 - gridH },
    type: s.type,
  };
}
