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
import { coverPathSegment } from './coverurl';
import { languageName } from './normalize';
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

/** What a pin shows; the test line of 2026-11-04 compares these in Pinterest's statistics (docs/pinterest-formate-recherche-2026-11-03.md §5.2). */
export type PinKind = 'wall' | 'decades' | 'compare' | 'cover';

/** Pinterest's alt text field, under „More options" in its form (2026-11): 500 characters. */
export const PIN_ALT_MAX = 500;

export interface CoverPinFacts {
  workId: string;
  /** `ol:15230634` — the picture is this cover, Open Library's original scan of it (`originalCoverUrl`). */
  coverId: string;
  /** The work's title as the catalogue has it, and the edition's where it differs (a translation). */
  title: string;
  editionTitle?: string;
  author: string;
  /** One of Julian's boards with a search name, and that name's phrase in the singular after the facts: "science fiction book cover". */
  board: string;
  what: string;
  /** The earliest dated printing that carries the cover (`lib/coverpins.ts`). */
  year?: number;
  publisher?: string;
  /** ISO 639-1; a language other than English is named. */
  language?: string;
  /** The cover artist where a record names one, and who says so. */
  artist?: string;
  artistSource?: string;
  /** How many covers the site showed for the book that day. */
  covers: number;
}

export interface CoverPin extends Pin {
  kind: 'cover';
  /** Pinterest's alt text: what the picture is, in facts the record holds. */
  alt: string;
}

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** An edition title that is the work's own, with or without a subtitle, is not named again. */
export function sameTitle(a: string, b: string): boolean {
  const x = squash(a);
  const y = squash(b);
  return x === y || x.startsWith(y) || y.startsWith(x);
}

/**
 * The scan as Open Library holds it, without a size suffix: its L is capped
 * at 500 px on the long side (measured 2026-11-04 on *Dune*: 258 × 400 to
 * 372 × 500), while the original behind it can be a 2634 × 4313 scan. A
 * cover pin is uploaded from this file; a Google cover has no such original.
 */
export function originalCoverUrl(coverId: string): string | null {
  const m = /^ol:(\d+)$/.exec(coverId);
  return m ? `https://covers.openlibrary.org/b/id/${m[1]}.jpg` : null;
}

/**
 * A pin that is one cover alone (the test line, 2026-11-04): no wordmark in
 * the picture, the search phrase in the title, the facts and their source
 * in the description, and a link to exactly this cover on the book page
 * (`?cover=`, the address being the source of truth for the chosen cover).
 * Publisher and year are the record's, said so — a record with the first
 * edition's year can hold a later reprint's photo, which is why every
 * picture is looked at before the pin is said yes to.
 */
export function coverPin(f: CoverPinFacts, origin: string = SITE_URL): CoverPin {
  const base = origin.replace(/\/$/, '');
  const by = f.author ? ` by ${f.author}` : '';
  const foreign = f.language && f.language !== 'en' ? languageName(f.language) : undefined;
  const translated = f.editionTitle && !sameTitle(f.editionTitle, f.title) ? f.editionTitle.trim() : undefined;
  const facts = [f.publisher, f.year ? String(f.year) : undefined].filter((x): x is string => !!x).join(' ');
  const dash = facts ? ` – ${facts}` : '';
  const shown = translated ? `${f.title} (${translated})` : f.title;
  const titles = [
    `${shown}${by}${dash} · ${f.what}`,
    `${f.title}${by}${dash} · ${f.what}`,
    `${f.title}${by}${dash}`,
    `${f.title}${dash}`,
    f.title,
  ];
  const title = titles.find(t => t.length <= PIN_TITLE_MAX) ?? f.title.slice(0, PIN_TITLE_MAX);

  // "The New Classics (New Directions)" is not "The The New Classics".
  const edition = f.publisher ? (/^the\s/i.test(f.publisher) ? `${f.publisher} edition` : `The ${f.publisher} edition`) : 'An edition';
  const year = f.year ? `, ${f.year}` : '';
  const lang = foreign ? `, in ${foreign}${translated ? ` as ${translated}` : ''}` : '';
  const art = f.artist ? `, cover art by ${f.artist}` : '';
  const recorded = [f.publisher ? 'publisher' : undefined, f.year ? 'year' : undefined, 'scan'].filter((x): x is string => !!x);
  const source = `; ${listOf(recorded)} ${recorded.length > 1 ? 'are' : 'is'} Open Library's record of this printing`;
  const credit = f.artist ? `, the artist is ${f.artistSource ?? 'the record'}'s credit` : '';
  const first = `${edition} of ${f.title}${by}${year}${lang}${art}${source}${credit}.`;
  const second = f.covers > 1
    ? `The link opens this cover on the book's page, among the ${f.covers} covers on record for this book, each with publisher, year and ISBN.`
    : "The link opens this cover on the book's page, with publisher, year and ISBN.";
  const alt = `Book cover: ${f.title}${by}${f.publisher ? `, ${f.publisher} edition` : ''}${f.year ? `, ${f.year}` : ''}${foreign ? `, ${foreign} edition${translated ? ` titled ${translated}` : ''}` : ''}${f.artist ? `, cover art by ${f.artist}` : ''}.`;
  return {
    kind: 'cover',
    picture: originalCoverUrl(f.coverId) ?? `${base}/img/L/${coverPathSegment(f.coverId)}`,
    board: f.board,
    title,
    description: `${first} ${second}`,
    alt,
    link: `${pinLink(`/book/${f.workId}`, origin)}&cover=${f.coverId}`,
  };
}
