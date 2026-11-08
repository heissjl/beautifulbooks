/**
 * Where things go on a comparison pin (ROADMAP 5.5a, the second format;
 * pure — `app/comparepin.tsx` paints from it, `scripts/measure-pins.ts`
 * probes against it).
 *
 * One book in three editions side by side, 1000 × 1500 like the grid pin
 * (`lib/pinlayout.ts`): title and author at the top, three covers in a row
 * with the year and the publisher under each, the site's name and address
 * at the bottom. Three across is what the width allows — a cover is 2:3,
 * so the row is sized from the width and the rest of the height is air
 * above and below the row, split evenly. The years are set large in the
 * display face: on a pin that compares decades they carry the point. That air
 * shows the mosaic ground (`words` are the only boxes darkened for the type).
 */
import { PIN_MARGIN, PIN_SIZE, pinTitleLines, pinTitleSize, type Rect } from './pinlayout';

export const COMPARE_COUNT = 3;

export interface CompareLayout {
  width: number;
  height: number;
  titleLines: 1 | 2;
  /** The size the title is set at (`pinTitleSize`). */
  titleSize: number;
  /** The three covers, left to right. */
  tiles: Rect[];
  /** Under each cover: the year and the publisher. */
  labels: Rect[];
  /** Title and author: from the top margin down to the covers. */
  head: Rect;
  /** The site's name and address: from the labels down to the bottom margin. */
  foot: Rect;
  /**
   * The boxes the mosaic darkens for the type. Tight, unlike `head` and `foot`,
   * which run through the air up to the covers: darkened whole, they would
   * leave no mosaic to see above and below the row.
   */
  words: Rect[];
  type: { title: number; line: number; year: number; publisher: number; site: number; address: number };
}

/** The covers may stand wider than the type, as on the grid pin. */
const ROW_MARGIN = 28;
const GAP = 18;
const TOP = 64;
const TITLE_LEADING = 1.1;
/** Under the title: 12 px, the author line (30 px at 1.3) and air before the covers. */
const UNDER_TITLE = 12 + 39 + 25;
/** The site's line (34 px italic) and the bottom margin. */
const FOOT = 128;
/** Between a cover and its year, and between the year and the publisher. */
const LABEL_GAP = 16;
const LINE_GAP = 6;

const TYPE: CompareLayout['type'] = { title: 60, line: 30, year: 56, publisher: 24, site: 34, address: 28 };

export function compareLayout(title: string): CompareLayout {
  const titleSize = pinTitleSize(title, TYPE.title);
  return compareLayoutSized(titleSize, pinTitleLines(title, titleSize));
}

/** The layout from the title's size and lines, for the probe, which reads them from the route's headers. */
export function compareLayoutSized(titleSize: number, titleLines: 1 | 2): CompareLayout {
  const { width, height } = PIN_SIZE;
  const head = TOP + titleLines * Math.round(titleSize * TITLE_LEADING) + UNDER_TITLE;
  const band = height - head - FOOT;
  // A multiple of two, so that height = width × 3/2 is a whole number.
  const byWidth = Math.floor((width - 2 * ROW_MARGIN - (COMPARE_COUNT - 1) * GAP) / COMPARE_COUNT);
  const tileW = byWidth - (byWidth % 2);
  const tileH = (tileW / 2) * 3;
  const labelH = Math.round(TYPE.year * TITLE_LEADING) + LINE_GAP + Math.round(TYPE.publisher * 1.3);
  const blockH = tileH + LABEL_GAP + labelH;
  const rowW = COMPARE_COUNT * tileW + (COMPARE_COUNT - 1) * GAP;
  const x0 = Math.round((width - rowW) / 2);
  // The row and its labels sit in the middle of what head and foot leave.
  const y0 = head + Math.round((band - blockH) / 2);
  const tiles: Rect[] = [];
  const labels: Rect[] = [];
  for (let i = 0; i < COMPARE_COUNT; i++) {
    const x = x0 + i * (tileW + GAP);
    tiles.push({ x, y: y0, width: tileW, height: tileH });
    labels.push({ x, y: y0 + tileH + LABEL_GAP, width: tileW, height: labelH });
  }
  const blockEnd = y0 + blockH;
  const titleH = titleLines * Math.round(titleSize * TITLE_LEADING) + 12 + 39;
  const footWords = Math.round(TYPE.site * 1.4);
  return {
    width,
    height,
    titleLines,
    titleSize,
    tiles,
    labels,
    head: { x: PIN_MARGIN, y: TOP, width: width - 2 * PIN_MARGIN, height: y0 - TOP },
    foot: { x: PIN_MARGIN, y: blockEnd, width: width - 2 * PIN_MARGIN, height: height - TOP - blockEnd },
    words: [
      { x: PIN_MARGIN, y: TOP, width: width - 2 * PIN_MARGIN, height: titleH },
      { x: x0, y: y0 + tileH + LABEL_GAP, width: rowW, height: labelH },
      { x: PIN_MARGIN, y: height - TOP - footWords, width: width - 2 * PIN_MARGIN, height: footWords },
    ],
    type: TYPE,
  };
}

/**
 * A label that holds in its tile's width on one line: Jost runs about 0.52
 * em a letter, so a 290 px tile takes 23 letters at 24 px. A longer name is
 * set smaller, down to 18 px, and past what that holds it is cut at a word
 * and given an ellipsis — the picture may not run a publisher's name into
 * the next tile, and the measurement probe reports ink between the labels.
 */
export function fitLabel(text: string, width: number, max: number = TYPE.publisher, min = 18): { text: string; size: number } {
  const clean = text.trim().replace(/\s+/g, ' ');
  for (let size = max; size >= min; size -= 2) {
    if (clean.length <= Math.floor(width / (size * 0.52))) return { text: clean, size };
  }
  const room = Math.floor(width / (min * 0.52)) - 1;
  let cut = clean.slice(0, room);
  const space = cut.lastIndexOf(' ');
  if (space > room / 2) cut = cut.slice(0, space);
  return { text: `${cut.replace(/[\s,;:]+$/, '')}…`, size: min };
}
