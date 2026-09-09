/**
 * Which shops get a chance at this printing, and in which order (ROADMAP
 * 1.11, plan `docs/plans/PLAN-1.11-kauflinks-ux.md` §2).
 *
 * The problem this solves, measured on 2026-09-08 over 567 editions of the
 * five fixture works: of the 243 editions that carry a cover, **44 % have an
 * ISBN from neither the English- nor the German-language area** — Turkey 47,
 * Spain 18, Italy 14, India 9, and a long tail. The default market is US, so
 * for three quarters of the covers the sidebar offered five buttons built
 * from a number that was issued in Istanbul. Those are not the covers to
 * hide; they are the reason the wall is worth looking at. So nothing is
 * hidden — the links are led differently.
 *
 * Three rules hold the wording together:
 *
 * 1. **Never a claim about a shop.** The registration group is a fact about
 *    the number, and it can justify an order. It cannot say a shop does not
 *    have the book — no shop is ever asked (SPEC §9.2, `lib/verdicts.ts`).
 * 2. **A label appears once.** "AbeBooks" used to stand twice in one column,
 *    a few lines apart, once as an ISBN link and once as a title search, with
 *    nothing to tell them apart.
 * 3. **A link to *this* printing wins.** Julian, 2026-09-09: where a shop that
 *    could pay commission has a link to exactly this edition, that link leads
 *    and the "another edition" row is not offered at all. It appears only when
 *    no such link is possible — a foreign ISBN, or none.
 */
import type { BuyLink, Edition } from './model';
import { DEFAULT_MARKET, type Market } from './market';
import { isbn13to10, registrationArea } from './normalize';
import type { VerdictStatus } from './verdicts';

export type LinkCase = 'home' | 'foreign' | 'kdp' | 'no-isbn';

export interface LinkPlan {
  case: LinkCase;
  /** The place the ISBN's registration group stands for, when it is known. */
  place?: string;
  /** Two or three shops that have a chance at this printing. Shown open. */
  lead: BuyLink[];
  /** Everything else, behind a fold. Never repeats a label from `lead`. */
  rest: BuyLink[];
  /** "Or read it in another edition": empty whenever a link to *this* printing could earn. */
  anyEdition: BuyLink[];
  /** One sentence that justifies the order. Empty in the `home` case, where there is nothing to explain. */
  note: string;
}

/** Which registration area a market's own shops are built around. */
const MARKET_AREA: Record<Market, 'en' | 'de'> = { us: 'en', uk: 'en', de: 'de' };

const AREA_NAME: Record<'en' | 'de', string> = {
  en: 'the English-language area',
  de: 'the German-language area',
};

/**
 * The shops that lead in each case, by provider id.
 *
 * `home` and `kdp` lead with shops that can pay commission and have a link to
 * this exact number. `foreign` leads with the two marketplaces — AbeBooks and
 * eBay list copies from anywhere, and Booklooker does the same in German —
 * and they lead as *title* searches, because second-hand listings often carry
 * no ISBN at all, which makes title + publisher + year the better question.
 */
const LEAD: Record<Market, Record<LinkCase, readonly string[]>> = {
  us: {
    home: ['bookshop', 'amazon'],
    kdp: ['amazon'],
    foreign: ['abebooks-search', 'ebay-search'],
    'no-isbn': ['abebooks-search', 'ebay-search'],
  },
  uk: {
    home: ['bookshop', 'amazon'],
    kdp: ['amazon'],
    foreign: ['abebooks-search', 'ebay-search'],
    'no-isbn': ['abebooks-search', 'ebay-search'],
  },
  de: {
    home: ['thalia', 'amazon'],
    kdp: ['amazon'],
    foreign: ['abebooks-search', 'booklooker'],
    'no-isbn': ['abebooks-search', 'ebay-search'],
  },
};

/**
 * Shops whose *ISBN* link is withdrawn in the `foreign` and `no-isbn` cases,
 * because it would be built from a number their catalogue was never given.
 * They are not dropped: they reappear once, under "read it in another
 * edition", searching by the work's title, where they can actually answer.
 *
 * Which shops these are is the one assumption in this file that rests on
 * reasoning rather than measurement (plan §7): Julian's ten-minute sample —
 * does Bookshop.org list a Turkish ISBN, what does Amazon's `/dp/` do with an
 * ISBN it never carried — settles it. If it comes out otherwise, this list
 * changes and nothing else does.
 */
const CATALOGUE_SHOPS: Record<Market, readonly string[]> = {
  us: ['bookshop', 'amazon'],
  uk: ['bookshop', 'amazon'],
  de: ['thalia', 'amazon'],
};

export interface LinkPlanInput {
  edition: Pick<Edition, 'isbn13'>;
  /** ISBN links for this market, as built by the server (`EditionView.buyLinks`). */
  buyLinks: readonly BuyLink[];
  /** Title/publisher/year searches for this printing (`searchLinksFor`). */
  searchLinks: readonly BuyLink[];
  /**
   * The market's own shops searched by the *work* title (`titleSearchLinksFor`),
   * built on the server so that an affiliate tag is set when there is one.
   */
  anyEditionLinks?: readonly BuyLink[];
  market?: Market;
  /** What the publisher's registered image showed, when it has been asked. */
  verdict?: VerdictStatus;
}

/**
 * Sorts an edition's shops into the three zones the sidebar renders.
 * Pure, offline, no request — the registration group is read from the number.
 */
export function linkPlan(input: LinkPlanInput): LinkPlan {
  const market = input.market ?? DEFAULT_MARKET;
  const isbn13 = input.edition.isbn13;
  const registration = isbn13 ? registrationArea(isbn13) : undefined;
  const area = MARKET_AREA[market];

  /*
    An ISBN we cannot read at all (none in 526 measured) is treated as `home`:
    without evidence, the order stays what it was rather than demoting shops
    on a hunch.
  */
  const linkCase: LinkCase = !isbn13
    ? 'no-isbn'
    : registration?.area === 'kdp'
      ? 'kdp'
      : !registration || registration.area === area
        ? 'home'
        : 'foreign';

  const withdrawn = linkCase === 'foreign' || linkCase === 'no-isbn' ? new Set(CATALOGUE_SHOPS[market]) : new Set<string>();
  const anyEdition = withdrawn.size > 0 ? [...(input.anyEditionLinks ?? [])].filter(l => withdrawn.has(l.provider.replace(/-title$/, ''))) : [];

  /*
    Lever 3 of ROADMAP 1.11. `kind: 'product'` says only "this URL has the
    shape of a product page" — Blackwell's `/bookshop/product/<isbn>` and
    Amazon's `/dp/` get it for any number, including one the shop was never
    given. In the sidebar that shape is rendered as a promise ("this book's
    page"), which for a foreign ISBN is the same sort of claim §9.2 forbids
    one level up. So outside the home case the claim is withdrawn, and the
    button says nothing about what it opens.
  */
  const fromIsbn = new Set(input.buyLinks.map(l => l.provider));
  const unclaimed = linkCase === 'foreign' || linkCase === 'no-isbn';
  const honest = (l: BuyLink): BuyLink =>
    unclaimed && fromIsbn.has(l.provider) && l.kind === 'product' ? { ...l, kind: undefined } : l;

  const pool = [...input.buyLinks.filter(l => !withdrawn.has(l.provider)).map(honest), ...input.searchLinks];
  const wanted = LEAD[market][linkCase];
  const lead: BuyLink[] = [];
  for (const id of wanted) {
    const hit = pool.find(l => l.provider === id);
    if (hit) lead.push(hit);
  }
  /*
    When the publisher's registered image is a different jacket, the reader is
    hunting *this* picture, so the search that works from the picture belongs
    in the first row rather than behind the fold (SPEC §9.3 step 13).
  */
  if (input.verdict === 'differs') {
    const lens = pool.find(l => l.provider === 'google-lens');
    if (lens) lead.push(lens);
  }

  // Rule 2: one label, one place. Labels spoken for by `lead` or by the
  // "another edition" row never appear a second time behind the fold.
  const spoken = new Set([...lead, ...anyEdition].map(l => l.label));
  const rest: BuyLink[] = [];
  for (const link of pool) {
    if (lead.includes(link) || spoken.has(link.label)) continue;
    spoken.add(link.label);
    rest.push(link);
  }

  return { case: linkCase, place: registration?.place, lead, rest, anyEdition, note: noteFor(linkCase, market, registration?.place, isbn13) };
}

function noteFor(linkCase: LinkCase, market: Market, place: string | undefined, isbn13: string | undefined): string {
  if (linkCase === 'home') return '';
  if (linkCase === 'kdp') {
    const searchOnly = isbn13 && !isbn13to10(isbn13);
    return `This number is from the 979-8 range, which Amazon issues for its own print-on-demand titles.${
      searchOnly ? ' It has no ISBN-10, so the link opens a search rather than one book’s page.' : ''
    }`;
  }
  if (linkCase === 'no-isbn') {
    return 'This edition has no ISBN on record, so no shop can look it up by number. These search by title, publisher and year instead.';
  }
  /*
    The one sentence in the sidebar that justifies an order. It states a fact
    about the number and nothing about any shop: "registered in Turkey" is
    read off the registration group, while "Bookshop does not have it" would
    be a claim nobody checked.
  */
  const where = place ? `was registered in ${place}` : `was not registered in ${AREA_NAME[MARKET_AREA[market]]}`;
  return `This printing’s ISBN ${where}. Marketplaces that list copies from anywhere come first; no shop was asked.`;
}

/**
 * The order of the editions a folded cover carries (ROADMAP 1.11, lever 2).
 *
 * After folding, `Cover.editionIds` is the order Open Library handed the
 * records over in — that is, by age of the *record*, which is close to
 * arbitrary. The first one supplies the links a reader sees first, so with
 * 44 % of cover-bearing editions carrying a foreign ISBN, the first was often
 * the least useful. Sorted here by what a reader in this market can act on:
 * an ISBN from their own area first, then any ISBN at all, then the newest
 * printing. Stable, so equal ranks keep the catalogue's own order.
 *
 * This is not a claim that the first edition is the best one — it is the one
 * whose links have somewhere to go.
 */
export function orderEditionsForMarket<E extends Pick<Edition, 'isbn13' | 'year'>>(
  editions: readonly E[],
  market: Market = DEFAULT_MARKET,
): E[] {
  const area = MARKET_AREA[market];
  const rank = (e: E): number => {
    if (!e.isbn13) return 2;
    const registration = registrationArea(e.isbn13);
    return registration && registration.area === area ? 0 : 1;
  };
  return [...editions]
    .map((edition, index) => ({ edition, index, rank: rank(edition) }))
    .sort((a, b) => a.rank - b.rank || (b.edition.year ?? 0) - (a.edition.year ?? 0) || a.index - b.index)
    .map(e => e.edition);
}
