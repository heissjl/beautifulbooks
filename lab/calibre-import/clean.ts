/**
 * A Calibre book as a question for the catalogue (lab/calibre-import, ROADMAP 5.17).
 *
 * Pure. Calibre titles carry what the file was called: a series in front
 * ("[Philip K. Dick 04] • Flow My Tears…", "Foundation 1 - Foundation",
 * "1974-Rendezvous With Rama"), the author in front or behind ("Crichton,
 * Michael - Sphere"), the tag of the place it came from, a subtitle. All of
 * these stand in Julian's library (read 2026-10-03). The catalogue's search
 * matches words, so each of them empties an answer that the bare title gets.
 *
 * Nothing here guesses a book: a title that cleans to nothing, or a book
 * without an author, is skipped and reported, not searched by half a name.
 */
import { sameAuthor } from '../../lib/bookmatch';
import { displayTitle, normalizeTitle } from '../../lib/normalize';
import type { CalibreBook } from '../calibre/library';

export interface BookQuery {
  title: string;
  author: string;
  /** ISBN-13, the book's own first, then one found in its title. */
  isbns: string[];
}

const SOURCE_TAG = /\s*\((?:z-lib\.org|b-ok\.\w+|book(?:zz|see|fi|sc)\.\w+)\)\s*/i;
const FILE_TAIL = /\.(?:epub|pdf|mobi|azw3?|djvu|indd)\b.*$/i;
const LEADING_YEAR = /^(?:1[5-9]\d\d|20[0-2]\d)/;
/** "Packer, George": a name as a catalogue files it. */
const INVERTED_NAME = /^\p{Lu}[\p{L}'-]+,\s+\p{Lu}[\p{L}. ]*$/u;
const NOBODY = /^(?:unknown|unbekannt|anonymous|n\/a|\(\))$/i;

/**
 * One author as a name to search with: "Dick, Philip K." → "Philip K. Dick".
 * Calibre keeps whatever the file said, so the same field also holds two
 * people ("Thomas C. Reed, Danny B. Stillman" — the first is taken), a
 * brother ("Strugatzki, Arkadij u. Boris"), credentials ("Preston, Psy.D.,
 * ABPP, John D."), life dates and once a file name.
 */
export function cleanAuthor(raw: string): string {
  const s = raw
    .normalize('NFC')
    .replace(FILE_TAIL, '')
    .replace(/,?\s*\d{4}\s*-\s*(?:\d{4})?\s*$/, '')
    .replace(/[;,\s]+$/, '')
    .trim();
  if (!s || NOBODY.test(s)) return '';
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return s;
  // Two whole names with a comma between them: two people.
  if (/\s/.test(parts[0]) && /\s/.test(parts[1])) return parts[0];
  const isGiven = (p: string): boolean => /^\p{Lu}\p{Ll}+/u.test(p) && !/^\p{L}+\.\p{L}/u.test(p);
  const given = (parts.slice(1).find(isGiven) ?? parts[1]).split(/\s+(?:u\.|und|and|&)\s+/)[0];
  return `${given} ${parts[0]}`;
}

/** The first author that is a name at all. */
export function primaryAuthor(authors: readonly string[]): string {
  for (const a of authors) {
    const name = cleanAuthor(a);
    if (name) return name;
  }
  return '';
}

const sameText = (a: string, b: string): boolean => !!normalizeTitle(a) && normalizeTitle(a) === normalizeTitle(b);

/** "Unwinding, The" → "The Unwinding". */
const articleFirst = (t: string): string => t.replace(/^(.*?),\s*(The|A|An|Der|Die|Das|El|La|Le)(?=$|:)/i, '$2 $1');

/**
 * What to ask the catalogue for this book, or null when there is nothing to
 * ask with: no title left, or no author (the library also holds READMEs,
 * licence texts and papers named after their file).
 */
export function cleanBook(book: Pick<CalibreBook, 'title' | 'authors' | 'isbns'>): BookQuery | null {
  let title = book.title.normalize('NFC').trim();
  let author = primaryAuthor(book.authors);
  const isbns = [...book.isbns];

  // "Title -- Authors -- edition -- publisher -- isbn13 … -- hash -- Anna’s Archive"
  if (/ -- /.test(title) && /Anna[’']s Archive\s*$/i.test(title)) {
    const parts = title.split(' -- ');
    const isbn = /isbn13 (97[89]\d{10})\b/.exec(title);
    if (isbn && !isbns.includes(isbn[1])) isbns.push(isbn[1]);
    if (!author && parts[1]) author = cleanAuthor(parts[1].split(';')[0]);
    title = parts[0].replace(/\s+(?:Revised|Second|Third|\d+(?:st|nd|rd|th)) Edition$/i, '');
  }

  // "Title by Author (z-lib.org)": the author field of such a file is often the uploader's tool.
  if (SOURCE_TAG.test(title)) {
    title = title.replace(SOURCE_TAG, ' ').trim();
    const by = /^(.+?) by (\p{Lu}[^()]+)$/u.exec(title);
    if (by) {
      title = by[1];
      author = cleanAuthor(by[2]);
    }
  }

  title = title.replace(FILE_TAIL, '').replace(/_ /g, ': ').trim();

  // "[Philip K. Dick 04] • Flow My Tears…", "[Sean Carroll] Spacetime and geometry…"
  const lead = /^\[([^\]]+)\]\s*[•·]?\s*(.+)$/.exec(title);
  if (lead) {
    title = lead[2];
    if (!author && !/\d/.test(lead[1])) author = cleanAuthor(lead[1]);
  }

  // Notes in brackets at the end go first: "Wool Omnibus Edition (Wool 1 - 5)" has its dash inside one.
  title = displayTitle(title);

  // "Author - Title", "Title - Author", "Series 2 - Title", "Series - 02 Title"
  const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(title);
  if (dash) {
    const left = dash[1].replace(new RegExp(`${LEADING_YEAR.source}\\s+`), '');
    const right = dash[2];
    const leftAuthor = book.authors.map(cleanAuthor).find((a) => a && sameAuthor(cleanAuthor(left), a));
    const numbered = /^\d{1,3}\s+(\S.*)$/.exec(right);
    if (leftAuthor) {
      author = leftAuthor;
      title = right;
    } else if (book.authors.some((a) => sameText(a, right)) && !INVERTED_NAME.test(right)) {
      // "1954 Ray Bradbury - Fahrenheit 451" filed under the author "Fahrenheit 451"
      author = cleanAuthor(left);
      title = right;
    } else if (author && sameAuthor(cleanAuthor(right), author)) {
      title = articleFirst(left);
    } else if (/\s\d{1,4}$/.test(left)) {
      title = right;
    } else if (numbered) {
      title = numbered[1];
    }
  }

  // "1974-Rendezvous With Rama"
  title = title.replace(new RegExp(`${LEADING_YEAR.source}\\s*[-–—]\\s*(?=\\p{L})`, 'u'), '');
  // A bundle's contents, the subtitle, quotation marks.
  title = displayTitle(title).split(' · ')[0].split(/:\s/)[0];
  if (/^["“„]/.test(title)) title = title.replace(/^["“„]+|["”“]+$/g, '');
  title = title.replace(/\s+/g, ' ').trim();

  if (!author || !/[\p{L}\p{N}]/u.test(title)) return null;
  return { title, author, isbns };
}
