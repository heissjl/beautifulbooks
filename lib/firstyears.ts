/**
 * A first-publication year checked against a second source (ROADMAP 6.16
 * Schritt 2). Open Library's `first_publish_year` is wrong for a third of the
 * curated books (Lolita 1777, Gatsby 1920, measured 2026-09-08);
 * `lib/firstyear.ts` only drops the absurd outlier. This file holds what two
 * sources agree on, or what Julian confirmed, keyed by work id — proposed
 * once by `lab/first-years/propose.ts` from Wikidata, never asked at run time
 * (E10). Server only: the data file travels with the server bundle, the
 * client gets the year on the `Work` it already receives.
 *
 * Applied last — after `mergeWorks`, which takes the smaller of two years and
 * would otherwise keep a wrong earlier one — and only where the file has a
 * row; everything else stays Open Library's year, marked as such, so the
 * sentence on the page can say which it is (N12: a quoted year is not a
 * checked one).
 */
import firstYears from '@/data/first-years.json';
import type { Work } from './model';

interface CheckedYear {
  year: number;
  /** Where the year was checked: both sources agreeing, or Julian's reading of a difference. */
  source: string;
}

const CHECKED: Readonly<Record<string, CheckedYear>> = firstYears as Record<string, CheckedYear>;

export function checkedFirstYear(workId: string): CheckedYear | undefined {
  return CHECKED[workId];
}

/** The work with its checked year where there is one, else as it came, marked `openlibrary` when it has a year. */
export function withCheckedYear<T extends Work>(work: T): T {
  const checked = checkedFirstYear(work.id);
  if (checked) return { ...work, firstPublishYear: checked.year, firstPublishYearSource: 'checked' };
  if (work.firstPublishYear !== undefined && !work.firstPublishYearSource) return { ...work, firstPublishYearSource: 'openlibrary' };
  return work;
}
