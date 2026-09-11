/**
 * How many pills fit in a given number of wrapped rows (ROADMAP 6.8).
 *
 * Julian, 2026-09-11: „lass es am Handy nur 2 Zeilen bei den Sprachpillen
 * sein und klappe die zusätzlichen mit weg … am Desktop maximal 3 Zeilen."
 * A fixed count cannot promise a number of rows — it depends on the width of
 * the screen and on the names — so the widths are measured and packed here,
 * the same way the browser wraps a flex row: left to right, a new row when
 * the next item does not fit. Pure; the measuring lives in `useRowFit`.
 */

/** Rows a flex-wrap line of these widths takes, with `gap` between items and `start` already used in the first row. */
export function rowsNeeded(widths: readonly number[], rowWidth: number, gap: number, start = 0): number {
  if (widths.length === 0) return start > 0 ? 1 : 0;
  let rows = 1;
  let x = start;
  for (const w of widths) {
    const next = x === 0 ? w : x + gap + w;
    // Half a pixel of slack: widths are fractional, the row width is not.
    if (next > rowWidth + 0.5 && x > 0) {
      rows++;
      x = w;
    } else {
      x = next;
    }
  }
  return rows;
}

export interface FitInput {
  /** Widths of the items that may be tucked away, in order. */
  lead: readonly number[];
  /** What must follow when something is tucked away: the "+n more" pill and the pills that never go. */
  tail: readonly number[];
  /** What must follow when nothing is tucked away (the same, without "+n more"). */
  tailIfAll: readonly number[];
  rowWidth: number;
  gap: number;
  maxRows: number;
  /** Width already taken at the start of the first row (a heading set inline). */
  start?: number;
}

/** How many of `lead` can stay visible so that everything shown fits in `maxRows`. */
export function fitCount({ lead, tail, tailIfAll, rowWidth, gap, maxRows, start = 0 }: FitInput): number {
  if (rowsNeeded([...lead, ...tailIfAll], rowWidth, gap, start) <= maxRows) return lead.length;
  for (let k = lead.length - 1; k > 0; k--) {
    if (rowsNeeded([...lead.slice(0, k), ...tail], rowWidth, gap, start) <= maxRows) return k;
  }
  return 0;
}
