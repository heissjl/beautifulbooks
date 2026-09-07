/**
 * Pure normalization helpers (SPEC.md §2.1). No I/O.
 */

const LEADING_ARTICLES = new Set(['the', 'a', 'an', 'der', 'die', 'das', 'le', 'la', 'les', 'el', 'los', 'las']);

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function basicNormalize(s: string): string {
  return stripDiacritics(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Title key for work identity: lowercase, no diacritics, subtitle after ":"
 * removed, punctuation removed, leading article removed.
 *
 *   "The Great Gatsby: A Novel" -> "great gatsby"
 *   "Gravity's Rainbow"          -> "gravitys rainbow"
 */
export function normalizeTitle(title: string): string {
  const main = title.split(':')[0];
  // Remove apostrophes without inserting a space so "Gravity's" -> "gravitys".
  const words = basicNormalize(main.replace(/['’]/g, '')).split(' ');
  if (words.length > 1 && LEADING_ARTICLES.has(words[0])) words.shift();
  return words.join(' ');
}

/**
 * Display-oriented normalized author name. Handles "Surname, Given" inversion.
 *
 *   "Roberts, Michael" -> "michael roberts"
 *   "F. Scott Fitzgerald" -> "f scott fitzgerald"
 */
export function normalizeAuthor(name: string): string {
  let n = name.trim();
  const comma = n.indexOf(',');
  if (comma > 0) n = `${n.slice(comma + 1).trim()} ${n.slice(0, comma).trim()}`;
  return basicNormalize(n);
}

/**
 * Loose key for matching the same author across sources, robust against
 * initials and middle names: first initial + surname.
 *
 *   "J. R. R. Tolkien" and "J.R.R. Tolkien" -> "j tolkien"
 *   "F. Scott Fitzgerald"                   -> "f fitzgerald"
 *   "Orwell, George"                        -> "g orwell"
 */
export function authorMatchKey(name: string): string {
  const words = normalizeAuthor(name).split(' ').filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0];
  return `${words[0][0]} ${words[words.length - 1]}`;
}

/** Title + primary author key used for identity rule 2 (SPEC §2.1). */
export function titleAuthorKey(title: string, primaryAuthor: string | undefined): string {
  return `t:${normalizeTitle(title)}::a:${primaryAuthor ? authorMatchKey(primaryAuthor) : 'unknown'}`;
}

export interface AuthorEntry {
  name: string;
  /** Open Library author key (`OL27626A`) when the source provides one. */
  key?: string;
}

/**
 * Dedupes author names (keeping source keys aligned) and drops entries whose
 * name itself says translator, editor or illustrator.
 */
export function cleanAuthorEntries(names: readonly string[] | undefined, keys?: readonly string[]): AuthorEntry[] {
  if (!names) return [];
  const seen = new Set<string>();
  const out: AuthorEntry[] = [];
  names.forEach((raw, i) => {
    const name = raw.trim();
    if (!name) return;
    if (/\b(translat|übersetz|trad\.|editor|hrsg|illustrat)/i.test(name)) return;
    const matchKey = authorMatchKey(name);
    if (seen.has(matchKey)) return;
    seen.add(matchKey);
    const key = keys?.[i]?.replace('/authors/', '');
    out.push(key ? { name, key } : { name });
  });
  return out;
}

export function cleanAuthors(names: readonly string[] | undefined): string[] {
  return cleanAuthorEntries(names).map(a => a.name);
}

/** Removes hyphens/spaces, uppercases the check digit. Returns undefined if not 10 or 13 chars. */
export function cleanIsbn(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  return s.length === 10 || s.length === 13 ? s : undefined;
}

/** Converts an ISBN-10 to ISBN-13. Returns the input unchanged if it is already 13 chars. */
export function isbn10to13(isbn: string): string {
  const s = cleanIsbn(isbn);
  if (!s) return isbn;
  if (s.length === 13) return s;
  const core = `978${s.slice(0, 9)}`;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  const check = (10 - (sum % 10)) % 10;
  return `${core}${check}`;
}

/**
 * Converts a 978-prefixed ISBN-13 to ISBN-10 (Amazon's ASIN for print books).
 * 979-prefixed ISBNs have no ISBN-10 form; returns undefined for those.
 */
export function isbn13to10(isbn: string): string | undefined {
  const s = cleanIsbn(isbn);
  if (!s) return undefined;
  if (s.length === 10) return s;
  if (!s.startsWith('978')) return undefined;
  const core = s.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(core[i]) * (10 - i);
  const check = (11 - (sum % 11)) % 11;
  return `${core}${check === 10 ? 'X' : check}`;
}

/** First plausible 4-digit year in a free-form date string. */
export function parseYear(date: string | undefined): number | undefined {
  if (!date) return undefined;
  const m = date.match(/(?<!\d)(1[5-9]\d{2}|20\d{2})(?!\d)/);
  return m ? Number(m[1]) : undefined;
}

const OL_TO_ISO: Record<string, string> = {
  eng: 'en', ger: 'de', deu: 'de', fre: 'fr', fra: 'fr', spa: 'es', ita: 'it',
  por: 'pt', rus: 'ru', jpn: 'ja', chi: 'zh', zho: 'zh', dut: 'nl', nld: 'nl',
  swe: 'sv', dan: 'da', nor: 'no', fin: 'fi', pol: 'pl', cze: 'cs', ces: 'cs',
  hun: 'hu', tur: 'tr', ara: 'ar', heb: 'he', gre: 'el', ell: 'el', kor: 'ko',
  lat: 'la', cat: 'ca', ukr: 'uk', rum: 'ro', ron: 'ro', hin: 'hi', per: 'fa',
  fas: 'fa', vie: 'vi', tha: 'th', ind: 'id', bul: 'bg', hrv: 'hr', srp: 'sr',
  slo: 'sk', slk: 'sk', slv: 'sl', lit: 'lt', lav: 'lv', est: 'et', ice: 'is',
  isl: 'is', wel: 'cy', cym: 'cy', gle: 'ga', baq: 'eu', eus: 'eu', glg: 'gl',
  ben: 'bn', urd: 'ur', tam: 'ta', mal: 'ml', tel: 'te', mar: 'mr', guj: 'gu',
  und: '',
};

/**
 * Maps an Open Library 3-letter code (or `/languages/eng` key) or an ISO 639-1
 * code to ISO 639-1. Unknown or undetermined -> undefined.
 */
export function toIsoLanguage(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const c = code.replace('/languages/', '').toLowerCase().trim();
  if (c.length === 2) return c;
  const iso = OL_TO_ISO[c];
  return iso === undefined ? undefined : iso || undefined;
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian',
  pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', zh: 'Chinese', nl: 'Dutch',
  sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', pl: 'Polish',
  cs: 'Czech', hu: 'Hungarian', tr: 'Turkish', ar: 'Arabic', he: 'Hebrew',
  el: 'Greek', ko: 'Korean', la: 'Latin', ca: 'Catalan', uk: 'Ukrainian',
  ro: 'Romanian', hi: 'Hindi', fa: 'Persian', vi: 'Vietnamese', th: 'Thai',
  id: 'Indonesian', bg: 'Bulgarian', hr: 'Croatian', sr: 'Serbian', sk: 'Slovak',
  sl: 'Slovenian', lt: 'Lithuanian', lv: 'Latvian', et: 'Estonian', is: 'Icelandic',
};

export function languageName(code: string | undefined): string {
  if (!code) return 'Unknown';
  return LANGUAGE_NAMES[code] ?? code.toUpperCase();
}

export function stripHtml(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const t = s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return t || undefined;
}

const NON_BOOK_TITLE = /\b(audiobook|audio book|audio cd|mp3 cd|journal|proceedings)\b/i;

/** SPEC §3 F3.4: audiobooks, journals and proceedings are filtered out. */
export function looksLikeNonBook(title: string, description?: string): boolean {
  return NON_BOOK_TITLE.test(title) || /\b(narrated by|unabridged audio)\b/i.test(description ?? '');
}

const SECONDARY_LITERATURE =
  /\b(study guide|summary|summaries|analysis|book analysis|cliffsnotes|cliff's notes|sparknotes|companion|reader'?s guide|notes on|critical essays|lesson plans|a guide to|casebook|teacher'?s guide|and philosophy|for dummies|for fans|trivia|quiz|questions and answers|festschrift|in plain and simple english)\b/i;

/**
 * Titles that announce themselves as a version of another work (SPEC §9.3
 * step 10): Open Library keeps `1984 (adaptation)` and `Pride and Prejudice
 * [adaptation]` as their own works, and a graphic novel or stage script is
 * not the book someone searched for.
 */
export const MARKED_DERIVATIVE =
  /[([](\s*)(adaptation|adapted|abridged|graphic novel|comic|illustrated|stage|play|script|screenplay|retold)\b|\b(graphic novel|stage adaptation|a play in|retold by|adapted by)\b/i;

/** Titles that are about a work rather than the work itself (SPEC §3 F1.4). */
export function looksLikeSecondaryLiterature(title: string): boolean {
  return SECONDARY_LITERATURE.test(title);
}
