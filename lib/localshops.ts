/**
 * "Buy from a local bookshop" (ROADMAP 5.12, plan docs/plans/PLAN-5.12-buy-local.md).
 *
 * Per country, links into the national service of *independent* bookshops,
 * researched in lab/buy-local/README.md. Same principle as `lib/buylinks.ts`:
 * the links are URL templates built at display time, nothing is fetched, no
 * shop or service is ever contacted by the site, and nothing here knows
 * whether any shop has the book. The reader picks a shop on the service's
 * own page.
 *
 * Two kinds of link:
 * - `book`: lands on this book (by ISBN, or by title and author where there
 *   is no ISBN) at a service that lists independent shops only. Only URL
 *   shapes confirmed by hand are in the table (lab/buy-local, 6.41, 1.8).
 * - `finder`: the service's home page, shop finder or directory, without the
 *   book. Used where a book URL has not been confirmed yet; labelled so.
 *
 * The countries here are local to this section and do not touch the markets
 * of decision E9: a reader in the German market may still look in France.
 *
 * No postcode: none of the services has a confirmed postcode parameter in its
 * address, so the site asks for none. The reader types it on the service's
 * page, where it never passes through this site (N11).
 *
 * All wording for the section lives here, so the plan's rule — never say a
 * shop has the book — is checked in one place (lib/__tests__/localshops.test.ts).
 */
import type { Market } from './market';

export type LocalCountry = 'de' | 'at' | 'ch' | 'fr' | 'it' | 'es' | 'nl' | 'uk' | 'us';

export interface LocalShopLink {
  /** Stable id, `<service>` or `<service>-finder`. */
  id: string;
  label: string;
  url: string;
  kind: 'book' | 'finder';
  /** One short line under the link: what the service is, and what it is not. */
  note: string;
}

interface Service {
  id: string;
  label: string;
  note: string;
  /** Book page or search by ISBN-13. Absent where no shape is confirmed. */
  byIsbn?: (isbn13: string) => string;
  /** Search by free text (title and author). Absent where no shape is confirmed. */
  byTerms?: (terms: string) => string;
  /** Home page, shop finder or directory: always there. */
  finder: string;
}

interface Country {
  id: LocalCountry;
  label: string;
  services: Service[];
}

const enc = encodeURIComponent;

/*
  Confirmed shapes only (lab/buy-local/README.md, "Ergebnis je Land"):
  - genialokal `/Suche/?q=<isbn>`: confirmed in Chrome 2026-09-26 (6.41); the
    same endpoint takes free text, as in `lib/buylinks.ts` (checked in 1.8).
  - librairiesindependantes.com `/product/search/?query=<isbn>`: fetched
    2026-09-26 with 9782070360024, shows the book and a location picker.
    Free text in the same parameter is not confirmed, so no `byTerms`.
  - Bookshop.org `/search?keywords=`: the live buy link since 2026-09-07,
    ISBN and text both (1.8). Ships from a wholesaler, no pickup.
  Everything else is a finder link until its book URL is checked by hand
  (plan §4): Hive, Libris, todostuslibros, Bookdealer, LivreSuisse.
*/
const COUNTRIES: Country[] = [
  {
    id: 'de',
    label: 'Germany',
    services: [
      {
        id: 'genialokal',
        label: 'genialokal',
        note: 'Owner-run bookshops of the eBuch cooperative; choose a shop there to reserve or order for pickup.',
        byIsbn: isbn => `https://www.genialokal.de/Suche/?q=${isbn}`,
        byTerms: terms => `https://www.genialokal.de/Suche/?q=${enc(terms)}`,
        finder: 'https://www.genialokal.de/',
      },
    ],
  },
  {
    id: 'at',
    label: 'Austria',
    services: [
      {
        id: 'buchhandel-at',
        label: 'buchhandel.at',
        note: 'Directory of the Austrian book trade association. It includes chains and does not search for the book.',
        finder: 'https://buchhandel.at/buchhandlungen/',
      },
    ],
  },
  {
    id: 'ch',
    label: 'Switzerland',
    services: [
      {
        id: 'buchzentrum',
        label: 'Buchzentrum',
        note: 'List of bookshops in the Buchzentrum cooperative, by town. Not limited to independents; it does not search for the book.',
        finder: 'https://www.buchzentrum.ch/de/buchwelt-schweiz/buchhandlungen/partner',
      },
    ],
  },
  {
    id: 'fr',
    label: 'France',
    services: [
      {
        id: 'librairiesindependantes',
        label: 'Librairies indépendantes',
        note: 'Search across more than 1,200 independent bookshops; choose one by location for pickup or delivery.',
        byIsbn: isbn => `https://www.librairiesindependantes.com/product/search/?query=${isbn}`,
        finder: 'https://www.librairiesindependantes.com/',
      },
    ],
  },
  {
    id: 'it',
    label: 'Italy',
    services: [
      {
        id: 'bookdealer',
        label: 'Bookdealer',
        note: 'Independent bookshops only; shops near your address are shown first.',
        finder: 'https://www.bookdealer.it/',
      },
    ],
  },
  {
    id: 'es',
    label: 'Spain',
    services: [
      {
        id: 'todostuslibros',
        label: 'Todos tus libros',
        note: 'Platform of the Spanish booksellers’ association CEGAL; not limited to independents.',
        finder: 'https://www.todostuslibros.com/',
      },
    ],
  },
  {
    id: 'nl',
    label: 'Netherlands',
    services: [
      {
        id: 'libris',
        label: 'Libris',
        note: 'Independently owned Libris and Blz. bookshops under one shared name.',
        finder: 'https://libris.nl/winkels',
      },
    ],
  },
  {
    id: 'uk',
    label: 'United Kingdom',
    services: [
      {
        id: 'hive',
        label: 'Hive',
        note: 'Independent bookshops that take Hive orders for collection; find one by postcode there.',
        finder: 'https://www.hive.co.uk/storelocator',
      },
      {
        id: 'bookshop-uk',
        label: 'Bookshop.org',
        note: 'Ships from a wholesaler, no pickup; the independent shop you choose there gets the margin.',
        byIsbn: isbn => `https://uk.bookshop.org/search?keywords=${isbn}`,
        byTerms: terms => `https://uk.bookshop.org/search?keywords=${enc(terms)}`,
        finder: 'https://uk.bookshop.org/',
      },
    ],
  },
  {
    id: 'us',
    label: 'United States',
    services: [
      {
        id: 'indiebound',
        label: 'IndieBound',
        note: 'Map of independent bookstores in the American Booksellers Association; order through the store’s own site.',
        finder: 'https://www.indiebound.org/indie-store-finder',
      },
      {
        id: 'bookshop',
        label: 'Bookshop.org',
        note: 'Ships from a wholesaler, no pickup; the independent store you choose there gets the margin.',
        byIsbn: isbn => `https://bookshop.org/search?keywords=${isbn}`,
        byTerms: terms => `https://bookshop.org/search?keywords=${enc(terms)}`,
        finder: 'https://bookshop.org/',
      },
    ],
  },
];

/** Countries with a service, in the order the select shows them (by name). */
export const LOCAL_COUNTRIES: ReadonlyArray<{ id: LocalCountry; label: string }> = COUNTRIES
  .map(c => ({ id: c.id, label: c.label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));

export function isLocalCountry(value: unknown): value is LocalCountry {
  return typeof value === 'string' && COUNTRIES.some(c => c.id === value);
}

/** The country the section opens with when the reader has not chosen one. */
export function defaultLocalCountry(market: Market): LocalCountry {
  return market;
}

/** localStorage key for the reader's choice (per-viewer convenience only). */
export const LOCAL_COUNTRY_KEY = 'localShopCountry';

export interface LocalShopInput {
  isbn13?: string;
  title?: string;
  author?: string;
}

/**
 * The links for one printing in one country. A service gives a book link
 * where its confirmed shape can take what the edition has (ISBN first, then
 * title and author); otherwise its finder link. Pure; safe on the client.
 */
export function localShopLinks(country: LocalCountry, edition: LocalShopInput): LocalShopLink[] {
  const entry = COUNTRIES.find(c => c.id === country);
  if (!entry) return [];
  const terms = [edition.title, edition.author].filter(Boolean).join(' ').trim();
  return entry.services.map(s => {
    if (edition.isbn13 && s.byIsbn) return { id: s.id, label: s.label, url: s.byIsbn(edition.isbn13), kind: 'book', note: s.note };
    if (terms && s.byTerms) return { id: s.id, label: s.label, url: s.byTerms(terms), kind: 'book', note: s.note };
    return { id: `${s.id}-finder`, label: s.label, url: s.finder, kind: 'finder', note: s.note };
  });
}

/** Wording of the section, in one place. */
/** Every sentence the fold can show, for the catalogue test (ROADMAP 6.85). */
export function localShopCopy(): string[] {
  return [
    ...Object.values(LOCAL_SHOPS_COPY),
    ...COUNTRIES.flatMap(c => [c.label, ...c.services.map(s => s.note)]),
  ];
}

export const LOCAL_SHOPS_COPY = {
  summary: 'Buy from a local bookshop',
  lead: 'Find it at an independent bookshop near you.',
  countryLabel: 'Country',
  /** Always shown: the site does not know stock. */
  noStock: 'You choose the shop on the service’s own page. This site does not know which shop has this book.',
  /** Shown when at least one link does not carry the book. */
  finderHint: 'Links marked “finder” open the service without this book; search there by title or ISBN.',
} as const;

/**
 * The counted form of a local-shop link (ROADMAP 3.1): `/go/local/<isbn13 or
 * title>?c=<country>&id=<link id>&t=&a=&market=`. Like the shop searches in
 * `lib/buylinks.ts`, only the edition's facts travel; the redirect rebuilds
 * the link with `localShopLinks` from the same table, so it can only ever
 * send a reader to a service listed here.
 */
export function trackedLocalHref(country: LocalCountry, link: Pick<LocalShopLink, 'id'>, edition: LocalShopInput, market: Market): string {
  const params = new URLSearchParams({ c: country, id: link.id });
  if (edition.title) params.set('t', edition.title);
  if (edition.author) params.set('a', edition.author);
  params.set('market', market);
  return `/go/local/${edition.isbn13 ? encodeURIComponent(edition.isbn13) : 'title'}?${params}`;
}

/** The link a counted local-shop href stands for, or undefined when the table has none like it. */
export function localLinkFor(target: string, params: URLSearchParams): LocalShopLink | undefined {
  const country = params.get('c');
  const id = params.get('id');
  if (!isLocalCountry(country) || !id) return undefined;
  const clip = (v: string | null) => v?.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) || undefined;
  const isbn13 = /^97[89]\d{10}$/.test(target) ? target : undefined;
  if (!isbn13 && target !== 'title') return undefined;
  return localShopLinks(country, { isbn13, title: clip(params.get('t')), author: clip(params.get('a')) }).find(l => l.id === id);
}
