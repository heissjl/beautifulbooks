/**
 * The hub `/collections` (ROADMAP 6.107 Teil A, PLAN-6.107 § 5 A 3): a
 * heading and a sentence of the site's own text per group, in the
 * site's voice — facts only, no word that claims completeness (CLAUDE.md;
 * the i18n test rejects them in German, `lib/__tests__/hubcopy.test.ts` in
 * English). Here and nowhere else, so the hub and the register say the same.
 *
 * The English sentence is the key (E23); the German lives in `lib/i18n/de.ts`.
 */
import type { CollectionGroup } from './collections';
import { english, type Translate } from './i18n/translate';

export const GROUP_HEADING: Record<CollectionGroup, string> = {
  series: 'Series',
  designers: 'Designers',
  lists: 'Prizes and lists',
  publishers: 'Publishers',
};

/**
 * One sentence each (Julian, 2026-11-01: „kürze die beschreibungstexte noch, die
 * klingen sehr nach KI" — the three-sentence version explained what a wall is,
 * which the intro already says). `t` is called on each so the catalogue test
 * sees them as a table (see i18n.test.ts).
 */
export const GROUP_TEXT: Record<CollectionGroup, readonly string[]> = {
  series: ['A publisher’s series, one cover per book, in the order of the list or the numbers.'],
  designers: ['The covers one designer made for a publisher, a series or an author: Edelmann for Hanser, Piatti for dtv.'],
  lists: ['Prizes and reading lists in the order of the list; the covers were never meant to match.'],
  publishers: ['Houses whose list is a collection in itself, one cover per book.'],
};

export function groupHeading(group: CollectionGroup, t: Translate = english): string {
  return t(GROUP_HEADING[group]);
}

export function groupText(group: CollectionGroup, t: Translate = english): string[] {
  return GROUP_TEXT[group].map(s => t(s));
}
