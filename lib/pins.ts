/**
 * The words of a Pinterest pin (ROADMAP 5.5a, PLAN-5.5-5.6 §7): a board, a
 * title with the words people search, a description of two sentences with
 * the numbers the page showed that day, and the link with its mark.
 * Pure; `scripts/pin-list.ts` writes the list from these, Julian uploads by
 * hand. Nothing here is shown on the site.
 *
 * A title is factual — never "the most beautiful", never a ranking (PLAN-5
 * §2) — and claims no completeness: the numbers say what was counted, the
 * words say "and more". Pinterest cuts a title past 100 characters and a
 * description past 500 (its own limits, 2026), so each builder stays inside.
 */
import { SITE_URL } from './seo';

export const PIN_TITLE_MAX = 100;
export const PIN_DESCRIPTION_MAX = 500;
/** The mark on the link: an entry class the analytics already count (`VIA` in lib/insights/signals.ts, K14). */
export const PIN_VIA = 'pinterest';

export const DECADES_BOARD = 'Covers through the decades';

export interface Pin {
  /** The pin picture's address. */
  picture: string;
  board: string;
  title: string;
  description: string;
  /** Where the pin leads, with `?via=pinterest`. */
  link: string;
}

/** A page of the site with the pin's mark; `origin` is the live site when the list is written, `SITE_URL` otherwise. */
export function pinLink(path: string, origin: string = SITE_URL): string {
  return `${origin.replace(/\/$/, '')}${path}${path.includes('?') ? '&' : '?'}via=${PIN_VIA}`;
}

const listOf = (names: readonly string[]): string =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

export interface DecadePinFacts {
  id: string;
  title: string;
  author: string;
  /** What the decade page counted that day. */
  covers: number;
  /** Printings with a known year, the page's own line. */
  records: number;
  from: number;
  to: number;
  /** The publishers most often on record, at most three, in that order. */
  publishers: readonly string[];
}

/** A pin for a decade page: the work's pin picture, the decades board, a link to `/book/<id>/decades`. */
export function decadePin(f: DecadePinFacts, origin: string = SITE_URL): Pin {
  const by = f.author ? ` by ${f.author}` : '';
  const span = f.from && f.to ? `, ${f.from}s to ${f.to}s` : '';
  let title = `${f.title}${by} – book covers by decade${span}`;
  if (title.length > PIN_TITLE_MAX) title = `${f.title}${by} – book covers by decade`;
  if (title.length > PIN_TITLE_MAX) title = `${f.title} – book covers by decade`;
  const decades = f.from && f.to ? ` from the ${f.from}s to the ${f.to}s` : '';
  const first = `${f.covers} book covers of ${f.title}${by}, one group per decade${decades}, counted from ${f.records} printings with a known year on Open Library.`;
  const second = f.publishers.length > 0
    ? `Publishers include ${listOf(f.publishers)}; each cover opens its edition with publisher, year and ISBN.`
    : 'Each cover opens its edition with publisher, year and ISBN.';
  return {
    picture: `${origin.replace(/\/$/, '')}/book/${f.id}/pin.jpg`,
    board: DECADES_BOARD,
    title,
    description: `${first} ${second}`,
    link: pinLink(`/book/${f.id}/decades`, origin),
  };
}

export interface CollectionPinFacts {
  slug: string;
  title: string;
  /** What the covers are, after the count: "science fiction book covers", "book covers from its list". */
  what: string;
  count: number;
  /** The first books on the wall, at most three. */
  firstTitles: readonly string[];
  /** Cover artists the collection file names, at most three, or none. */
  artists: readonly string[];
  /** Where the credits come from, named beside them. */
  creditSource?: string;
}

/** A pin for a published collection: its pin picture, a board of its own, a link to `/collections/<slug>`. */
export function collectionPin(f: CollectionPinFacts, origin: string = SITE_URL): Pin {
  let title = `${f.title} – ${f.count} ${f.what}`;
  if (title.length > PIN_TITLE_MAX) title = `${f.title} – ${f.count} book covers`;
  const books = f.firstTitles.length > 0 ? `: ${f.firstTitles.join(', ')} and more` : '';
  const art = f.artists.length > 0
    ? `, with cover art by ${listOf(f.artists)} and others where ${f.creditSource ?? 'the record'} names the artist`
    : '';
  const first = `${f.count} ${f.what} on one wall${books}${art}.`;
  const second = 'Each cover opens the other editions of that book, with publisher, year and ISBN.';
  return {
    picture: `${origin.replace(/\/$/, '')}/collections/${f.slug}/pin.jpg`,
    board: f.title,
    title,
    description: `${first} ${second}`,
    link: pinLink(`/collections/${f.slug}`, origin),
  };
}

/** The words a pin must not carry: completeness (CLAUDE.md) and ranking (PLAN-5 §2). */
export const FORBIDDEN_PIN_WORDS = /\b(all|every|complete|best|greatest|ugliest|most beautiful|top \d+)\b/i;

export interface ComparePinFacts {
  id: string;
  /** The board, named by the list (Julian's boards; the old name of the site may not stand in lib/, `sitename.test.ts`). */
  board: string;
  title: string;
  author: string;
  /** The three editions shown, left to right, with what the record knows of each. */
  editions: ReadonlyArray<{ coverId: string; year?: number; publisher?: string }>;
  /** How many covers the site showed for the book that day. */
  covers: number;
}

/** "Chilton (1965)", "1965", "Chilton", or the fact that the record has neither. */
function editionLabel(e: { year?: number; publisher?: string }): string {
  if (e.publisher && e.year) return `${e.publisher} (${e.year})`;
  if (e.year) return String(e.year);
  return e.publisher ?? 'an undated printing';
}

/**
 * A pin that compares three editions (ROADMAP 5.5a, second format): the
 * picture names its covers in its address, the link opens the first of them
 * on the book page with the pin's mark.
 */
export function comparePin(f: ComparePinFacts, origin: string = SITE_URL): Pin {
  const base = origin.replace(/\/$/, '');
  const by = f.author ? ` by ${f.author}` : '';
  const years = f.editions.map(e => e.year).filter((y): y is number => !!y);
  const span = years.length > 0 ? `, ${years.join(', ')}` : '';
  let title = `${f.title}${by} – three editions${span}`;
  if (title.length > PIN_TITLE_MAX) title = `${f.title}${by} – three editions`;
  if (title.length > PIN_TITLE_MAX) title = `${f.title} – three editions`;
  const first = `Three editions of ${f.title}${by} next to each other: ${listOf(f.editions.map(editionLabel))}, out of ${f.covers} covers on record for this book.`;
  const second = 'Each cover opens its edition with publisher, year and ISBN, beside the other editions on record.';
  const ids = f.editions.map(e => e.coverId);
  return {
    picture: `${base}/book/${f.id}/compare.jpg?covers=${ids.join(',')}`,
    board: f.board,
    title,
    description: `${first} ${second}`,
    link: `${pinLink(`/book/${f.id}`, origin)}${ids[0] ? `&cover=${ids[0]}` : ''}`,
  };
}
