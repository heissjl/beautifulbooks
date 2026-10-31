/**
 * The hub `/collections` (ROADMAP 6.107 Teil A, PLAN-6.107 § 5 A 3): a
 * heading and three sentences of the site's own text per group, in the
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

/** Three sentences each; `t` is called on each so the catalogue test sees them as a table (see i18n.test.ts). */
export const GROUP_TEXT: Record<CollectionGroup, readonly [string, string, string]> = {
  series: [
    'A publisher’s series gives its books one face: a format, a typeface, a colour scheme, kept for years or decades.',
    'These walls put the printings of one series side by side, one cover per book, in the order of the list or of the numbers.',
    'Behind a cover is the wall of the other covers the book has been printed with.',
  ],
  designers: [
    'Some covers are known by the hand that drew them: Heinz Edelmann’s for Hanser, Celestino Piatti’s for dtv.',
    'These walls gather the covers one designer made for one publisher, one series or one author.',
    'A name under a tile comes from a record of that printing; where none names the artist, the tile stays quiet.',
  ],
  lists: [
    'A prize or a reading list names books across publishers and decades, and their covers were never meant to match.',
    'These walls put them in the order of the list, one cover per book, as the catalogue holds it.',
    'Read down a wall and the years change the type, the pictures and the formats.',
  ],
  publishers: [
    'A few houses are a collection in themselves: a programme, and a look that carries it.',
    'These walls gather books from one such list, one cover per book.',
    'The cover shown is not always that house’s printing; where the catalogue has none, another publisher’s stands in.',
  ],
};

export function groupHeading(group: CollectionGroup, t: Translate = english): string {
  return t(GROUP_HEADING[group]);
}

export function groupText(group: CollectionGroup, t: Translate = english): string[] {
  return GROUP_TEXT[group].map(s => t(s));
}
