/**
 * Pure rules for picking a foreign-language edition cover of a work
 * (Julian, 2026-09-26: the SF Masterworks relaunch „with international
 * covers. try all russian covers first", then all languages). No network here; `russian.ts`
 * fetches and calls these.
 */

import { normalizeTitle } from '../../lib/normalize';
import { isbnIsEnglish, isbnLanguage, publisherLanguage } from './evidence';

export interface OlEdition {
  key: string;
  languages?: Array<{ key: string }>;
  covers?: number[];
  publish_date?: string;
}

/** One row of the output list, in series order. */
export interface LanguageCoverRow {
  order: number;
  id: string;
  title: string;
  author: string;
  coverId: string | null;
  /** Every positive cover id seen on an edition in the language, the chosen one first. */
  candidates: number[];
  edition: string | null;
  publishDate: string | null;
  /** `failed` means Open Library did not answer — never read it as "no cover in that language". */
  status: 'found' | 'none' | 'failed';
  /** Where the cover was found: the work's editions, or a search that resolved to the same work. */
  via?: 'editions' | 'search';
}

/** The latest four-digit year in a free-form publish date ("1967", "May 12, 2003", "2003 [i.e. 2004]"). */
export function yearOf(date: string | undefined): number | null {
  const years = (date ?? '').match(/\b(1[5-9]\d\d|20\d\d)\b/g);
  return years ? Math.max(...years.map(Number)) : null;
}

export function inLanguage(edition: OlEdition, language: string): boolean {
  return (edition.languages ?? []).some(l => l.key === `/languages/${language}`);
}

export interface LanguagePick {
  edition: OlEdition;
  cover: number;
  candidates: number[];
}

/**
 * The edition to take: in the language, with a positive cover id, the most
 * recent publish year first (editions without a year last), then the larger
 * cover id (the more recent upload). All cover ids of all such editions are
 * kept as candidates, chosen one first, without duplicates.
 */
export function pickLanguageEdition(editions: OlEdition[], language: string): LanguagePick | null {
  const withCover = editions
    .filter(e => inLanguage(e, language))
    .map(e => ({ edition: e, covers: (e.covers ?? []).filter(c => c > 0) }))
    .filter(e => e.covers.length > 0);
  if (withCover.length === 0) return null;
  withCover.sort((a, b) => {
    const ya = yearOf(a.edition.publish_date) ?? -1;
    const yb = yearOf(b.edition.publish_date) ?? -1;
    if (ya !== yb) return yb - ya;
    return Math.max(...b.covers) - Math.max(...a.covers);
  });
  const candidates: number[] = [];
  for (const e of withCover) for (const c of e.covers) if (!candidates.includes(c)) candidates.push(c);
  return { edition: withCover[0].edition, cover: withCover[0].covers[0], candidates };
}

export type TranslationMatch = 'by-hand' | 'wikipedia-langlink' | 'wikidata';

/** How a candidate's language is known. */
export type Evidence = 'tag' | 'isbn-group' | 'publisher' | 'separate-work';

/** An edition cover in a language other than English, as the international wall's candidate. */
export interface ForeignCandidate {
  cover: number;
  language: string;
  edition: string | null;
  publishDate: string | null;
  isbn: string | null;
  via: Evidence;
  /** For `separate-work`: the unmerged translation's own work record. */
  work?: string;
  /**
   * For `separate-work`, how the translation was tied to the book when not
   * by the data itself (title or `translation_of`): an entry in
   * `translations.json`, set by hand or from a Wikipedia interlanguage link
   * or a Wikidata label.
   */
  match?: TranslationMatch;
  /** Set where the match to the book is not certain; such a candidate is never chosen. */
  needsCheck?: boolean;
  /** Why a person looking at the image ruled it out (`rejected.json`); never chosen. */
  rejected?: string;
}

export interface ForeignEdition extends OlEdition {
  isbn_13?: string[];
  isbn_10?: string[];
  publishers?: string[];
}

/** `und` (undetermined), `mul` (several) and `zxx` (no language) name no language to show. */
const NAMED_LANGUAGE = (code: string) => !['und', 'mul', 'zxx'].includes(code);

/**
 * Every cover of an edition in a language other than English, with the
 * evidence for the language:
 * - `tag`: the edition's first language tag. One tagged English as well is
 *   left out (a bilingual printing usually has an English cover), and so is
 *   `und`/`mul`/`zxx`.
 * - `isbn-group`, then `publisher`: only for an edition with **no** language
 *   field (`evidence.ts`). A tagged edition is never re-read by its ISBN.
 */
export function foreignCandidates(editions: ForeignEdition[]): ForeignCandidate[] {
  const out: ForeignCandidate[] = [];
  for (const e of editions) {
    const langs = (e.languages ?? []).map(l => l.key.replace('/languages/', ''));
    const isbn = e.isbn_13?.[0] ?? e.isbn_10?.[0] ?? null;
    let language: string | null = null;
    let via: Evidence = 'tag';
    if (langs.length > 0) {
      if (langs.includes('eng') || !NAMED_LANGUAGE(langs[0])) continue;
      language = langs[0];
    } else {
      const byIsbn = [...(e.isbn_13 ?? []), ...(e.isbn_10 ?? [])].map(isbnLanguage).find(Boolean) ?? null;
      const byPublisher = publisherLanguage(e.publishers);
      if (byIsbn) { language = byIsbn; via = 'isbn-group'; }
      else if (byPublisher) { language = byPublisher; via = 'publisher'; }
    }
    if (!language) continue;
    for (const cover of (e.covers ?? []).filter(c => c > 0)) {
      if (out.some(c => c.cover === cover)) continue;
      out.push({ cover, language, edition: e.key, publishDate: e.publish_date ?? null, isbn, via });
    }
  }
  return out;
}

/** Most recent first (no year last), then the larger cover id. */
function byRecency(a: ForeignCandidate, b: ForeignCandidate): number {
  const ya = yearOf(a.publishDate ?? undefined) ?? -1;
  const yb = yearOf(b.publishDate ?? undefined) ?? -1;
  return ya !== yb ? yb - ya : b.cover - a.cover;
}

/**
 * One cover per work, walking the wall in order so it stays varied.
 * A tagged edition is taken whenever the work has one — the wider evidence
 * only fills gaps, so the covers already looked at stay put. Among the
 * eligible ones, the language used least so far wins (a language not yet on
 * the wall first), then the most recent. `needsCheck` candidates are never
 * chosen; null where nothing is eligible.
 */
export function chooseVaried(perWork: ForeignCandidate[][]): Array<ForeignCandidate | null> {
  const used = new Map<string, number>();
  return perWork.map(all => {
    const sure = all.filter(c => !c.needsCheck && !c.rejected);
    const tagged = sure.filter(c => c.via === 'tag');
    const candidates = tagged.length ? tagged : sure;
    if (candidates.length === 0) return null;
    const best = [...candidates].sort((a, b) => (used.get(a.language) ?? 0) - (used.get(b.language) ?? 0) || byRecency(a, b))[0];
    used.set(best.language, (used.get(best.language) ?? 0) + 1);
    return best;
  });
}

/** Candidates in the order a person should look at them: most recent first. */
export function sortCandidates(candidates: ForeignCandidate[]): ForeignCandidate[] {
  return [...candidates].sort(byRecency);
}

/** A work of the same author, as `search.json?q=author_key:…` returns it. */
export interface AuthorWorkDoc {
  key: string;
  title: string;
  language?: string[];
  cover_i?: number;
  cover_edition_key?: string;
}

/** The language of a work record that is a translation only: tagged, never English. */
export function foreignWorkLanguage(doc: AuthorWorkDoc): string | null {
  const langs = doc.language ?? [];
  if (langs.length === 0 || langs.includes('eng') || !NAMED_LANGUAGE(langs[0])) return null;
  return langs[0];
}

export interface EditionWithOriginal extends ForeignEdition {
  translation_of?: string;
}

/**
 * Which book a separate translation work is, if that can be said without
 * guessing: its own title equals the book's (an untranslated title), or one
 * of its editions says `translation_of` the book's title. Titles compare
 * through `normalizeTitle`. Returns the matching target id, or null.
 */
export function matchSeparateWork(
  doc: AuthorWorkDoc,
  editions: EditionWithOriginal[],
  targets: Array<{ id: string; title: string }>,
): string | null {
  const names = [doc.title, ...editions.map(e => e.translation_of ?? '')].filter(Boolean).map(normalizeTitle);
  return targets.find(t => names.includes(normalizeTitle(t.title)))?.id ?? null;
}

/**
 * The covers of a translation work's editions. English-tagged editions are
 * left out (a stray audiobook or reprint of the original), and so is an
 * untagged one whose ISBN is in an English group. The language is the
 * edition's own tag, else the work's.
 */
export function translationCandidates(
  editions: EditionWithOriginal[],
  workLanguage: string,
  workKey: string,
  match?: TranslationMatch,
): ForeignCandidate[] {
  const out: ForeignCandidate[] = [];
  for (const e of editions) {
    const langs = (e.languages ?? []).map(l => l.key.replace('/languages/', ''));
    if (langs.includes('eng')) continue;
    const isbns = [...(e.isbn_13 ?? []), ...(e.isbn_10 ?? [])];
    if (langs.length === 0 && isbns.some(isbnIsEnglish)) continue;
    const language = langs.find(NAMED_LANGUAGE) ?? workLanguage;
    for (const cover of (e.covers ?? []).filter(c => c > 0)) {
      if (out.some(c => c.cover === cover)) continue;
      out.push({ cover, language, edition: e.key, publishDate: e.publish_date ?? null, isbn: isbns[0] ?? null, via: 'separate-work', work: workKey, ...(match ? { match } : {}) });
    }
  }
  return out;
}

/** A title without trailing bracketed notes: "Blood Music (novel)", "Pavane (S.F. Masterworks)". */
export function stripNote(title: string): string {
  let t = title.trim();
  for (let prev = ''; prev !== t; ) { prev = t; t = t.replace(/\s*[([][^()[\]]*[)\]]\s*$/, '').trim(); }
  return t || title.trim();
}

/** The surname to search by: the last name word, without "Jr." and the like. */
export function surnameOf(author: string): string {
  const words = author.replace(/,?\s+(jr|sr|ii|iii)\.?$/i, '').trim().split(/\s+/);
  return words[words.length - 1] ?? author;
}

/**
 * Whether a catalogue title is the translated title: equal after
 * `normalizeTitle`, or — for a translated title long enough not to be a
 * common word — the catalogue title starts with it (a subtitle added).
 */
export function sameTitle(catalogue: string, translated: string): boolean {
  const a = normalizeTitle(catalogue);
  const b = normalizeTitle(translated);
  if (!a || !b) return false;
  return a === b || (b.length >= 12 && a.startsWith(`${b} `));
}
