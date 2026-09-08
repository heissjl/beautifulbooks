/**
 * The year a work was first published, as far as one catalogue can say
 * (ROADMAP 6.16). Pure; no I/O.
 *
 * Open Library's `first_publish_year` is the minimum over its edition
 * records, so a single bad record decides it. Measured on the twelve
 * curated works, whose true years are known, it is **wrong for four**:
 *
 *   Lolita        1955, reported 1777 — one record, publisher "Generic",
 *                 dated 1777-01-01; the next-oldest edition is 1954
 *   Ulysses       1922, reported 1914
 *   Vom Kriege    1832, reported 1835
 *   Great Gatsby  1925, reported 1920
 *
 * Only the first of those is *absurd*, and only absurdity can be recognised
 * without a second source: a year that sits an era before everything else.
 * The rest are ordinary wrong data, indistinguishable from the truth here —
 * they need a checked value (ROADMAP 6.16 step 2) and are not this
 * function's business.
 *
 * So the rule is narrow on purpose: drop a leading year only when the gap to
 * the next one is longer than a human lifetime. **The threshold was
 * measured, not chosen.** At 30 years the rule eats real first editions —
 * *Moby Dick* would move from 1851 to 1892 and *Vom Kriege* from 1835 to
 * 1873, because a genuinely old book stands just as alone as an error. At
 * 50 it fixes Lolita and touches nothing else in the set.
 *
 * What comes out is therefore "not absurd", not "correct", and the caller
 * still quotes rather than asserts it (SPEC N12).
 */

/** A leading year is discarded when this many years separate it from the next. */
export const OUTLIER_GAP_YEARS = 50;

/** Nothing before this is a plausible printed edition in these catalogues. */
const EARLIEST_PLAUSIBLE = 1400;

export function robustFirstPublishYear(
  reported: number | undefined,
  publishYears: readonly number[] | undefined,
): number | undefined {
  const years = Array.from(new Set((publishYears ?? []).filter(y => Number.isFinite(y) && y >= EARLIEST_PLAUSIBLE)))
    .sort((a, b) => a - b);
  if (years.length === 0) return reported;

  // Only leading outliers are dropped, and only while a gap remains: a run of
  // early years (1851, 1892, 1900) is a publishing history, not an error.
  let i = 0;
  while (i + 1 < years.length && years[i + 1] - years[i] > OUTLIER_GAP_YEARS) i++;
  const earliest = years[i];

  // The reported year usually equals the smallest year; when it is smaller
  // still (a record the year list does not carry), it gets the same test.
  if (reported === undefined) return earliest;
  if (reported < earliest - OUTLIER_GAP_YEARS) return earliest;
  return Math.min(reported, earliest) === reported ? reported : earliest;
}
