/**
 * Where things go on a Pinterest pin (ROADMAP 5.5a, pure; `app/pin.tsx`
 * paints from it, `scripts/measure-pins.ts` probes against it).
 *
 * Pinterest shows a pin 2:3 at full width of its column and cuts anything
 * taller (PLAN-5.5-5.6 §7), so the picture is 1000 × 1500. It carries the
 * title and author (or a collection's name and one line under it) at the
 * top, a grid of covers in the middle and the site's name and address at the
 * bottom — the only way back from a picture that is saved without its link.
 *
 * Nine covers stand three by three, sized from the height left between head
 * and foot (the width would allow larger tiles, the height does not); six
 * stand three by two and are sized from the width, so a pin with fewer
 * covers shows them larger rather than leaving a row empty. A row that is
 * not full is never drawn: a half row reads as covers missing.
 */

export interface Rect { x: number; y: number; width: number; height: number }

export const PIN_SIZE = { width: 1000, height: 1500 } as const;

export type PinCount = 6 | 9;

export interface PinLayout {
  width: number;
  height: number;
  /** How many lines the head reserves for the title, one or two. */
  titleLines: 1 | 2;
  /** The covers, row by row. */
  tiles: Rect[];
  /** The block for the title and the line under it: from the top margin down to the covers. */
  head: Rect;
  /** The block for a credits line, the site's name and the address: from the covers down to the bottom margin. */
  foot: Rect;
  /** Font sizes in px. `title` is the largest the title may be; `pinTitleSize` makes a long one smaller. */
  type: { title: number; line: number; credits: number; site: number; address: number };
}

/** The side margin of the type. */
export const PIN_MARGIN = 60;
/** The covers may stand a little wider than the type: six tiles are sized from the width, and the air is better spent on them. */
const GRID_MARGIN = 48;
const TOP = 64;
const GAP = 20;
const TITLE_LEADING = 1.1;
/** Under the title: 12 px, the line (30 px at 1.3) and air before the covers. */
const UNDER_TITLE = 12 + 39 + 25;
/** The site's line (34 px italic) and the bottom margin — and a credits line (22 px) above it when there is one. */
const FOOT = 128;
const CREDITS_ROOM = 40;

const TYPE: PinLayout['type'] = { title: 60, line: 30, credits: 22, site: 34, address: 28 };

/**
 * Room for the title: one line or two, at the size `pinTitleSize` gives it.
 * A one-line title hands its second line to the covers — on *Dune* the two
 * reserved lines left a band of nothing between the author and the grid
 * (first pins, 2026-10-31). The estimate is conservative (0.52 em a letter,
 * Xanh runs nearer 0.45), and `scripts/measure-pins.ts` checks the picture:
 * a title that wraps where one line was reserved runs into the covers, which
 * the probe reports.
 */
export function pinTitleLines(title: string, size: number = pinTitleSize(title), width: number = PIN_SIZE.width - 2 * PIN_MARGIN): 1 | 2 {
  const perLine = Math.floor(width / (size * 0.52));
  return title.length > perLine ? 2 : 1;
}

export function pinLayout(count: PinCount = 9, { credits = false, titleLines = 2 }: { credits?: boolean; titleLines?: 1 | 2 } = {}): PinLayout {
  const { width, height } = PIN_SIZE;
  const head = TOP + Math.round(titleLines * TYPE.title * TITLE_LEADING) + UNDER_TITLE;
  const foot = FOOT + (credits ? CREDITS_ROOM : 0);
  const cols = 3;
  const rows = count / cols;
  const band = height - head - foot;
  const byHeight = Math.floor((band - (rows - 1) * GAP) / rows);
  const byWidth = Math.floor(((width - 2 * GRID_MARGIN - (cols - 1) * GAP) / cols) * 1.5);
  // A multiple of three, so that width = height × 2/3 is a whole number.
  const tileH = Math.min(byHeight, byWidth) - (Math.min(byHeight, byWidth) % 3);
  const tileW = (tileH / 3) * 2;
  const gridW = cols * tileW + (cols - 1) * GAP;
  const gridH = rows * tileH + (rows - 1) * GAP;
  const x0 = Math.round((width - gridW) / 2);
  // The grid sits in the middle of what head and foot leave.
  const y0 = head + Math.round((band - gridH) / 2);
  const tiles: Rect[] = [];
  for (let i = 0; i < count; i++) {
    tiles.push({ x: x0 + (i % cols) * (tileW + GAP), y: y0 + Math.floor(i / cols) * (tileH + GAP), width: tileW, height: tileH });
  }
  return {
    width,
    height,
    titleLines,
    tiles,
    head: { x: PIN_MARGIN, y: TOP, width: width - 2 * PIN_MARGIN, height: y0 - TOP },
    foot: { x: PIN_MARGIN, y: y0 + gridH, width: width - 2 * PIN_MARGIN, height: height - TOP - y0 - gridH },
    type: TYPE,
  };
}

/**
 * The size the title is set at, so that it holds in two lines of the head:
 * about 0.48 em a letter in Xanh, and a line breaks between words, so two
 * lines hold a little less than twice one. Measured on the first pins
 * (2026-10-31): "Harry Potter and the Philosopher's Stone" (40 letters) takes
 * two lines at 60; the sizes below keep every title of the first list on two.
 */
export function pinTitleSize(title: string, max: number = TYPE.title): number {
  const n = title.length;
  if (n <= 24) return Math.round(max * 1.2);
  if (n <= 48) return max;
  if (n <= 64) return Math.round(max * 0.8);
  return Math.round(max * 0.66);
}

/** How many covers a pin draws from what loaded: nine, six, or none worth a pin. */
export function pinCount(loaded: number): PinCount | 0 {
  return loaded >= 9 ? 9 : loaded >= 6 ? 6 : 0;
}
