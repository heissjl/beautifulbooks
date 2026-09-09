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
 * removed, trailing bracketed additions removed, punctuation removed,
 * leading article removed.
 *
 *   "The Great Gatsby: A Novel"                                  -> "great gatsby"
 *   "Gravity's Rainbow"                                           -> "gravitys rainbow"
 *   "Ansichten eines Clowns (Methuen's Twentieth Century Texts)" -> "ansichten eines clowns"
 *
 * The bracket rule is ROADMAP 6.15 step 1: a series or edition note in
 * brackets at the end of a title does not make it another title. Only
 * trailing groups go, and only when something is left in front of them —
 * "(Untitled)" stays what it is.
 */
export function normalizeTitle(title: string): string {
  const main = stripTrailingBrackets(title.split(':')[0]);
  // Remove apostrophes without inserting a space so "Gravity's" -> "gravitys".
  const words = basicNormalize(main.replace(/['’]/g, '')).split(' ');
  if (words.length > 1 && LEADING_ARTICLES.has(words[0])) words.shift();
  return words.join(' ');
}

/**
 * A work title fit to be *used*: the trailing bracketed note removed, the
 * subtitle kept.
 *
 * Open Library is a wiki and its titles show it — OL468431W, the work this
 * spec leans on most, is called literally `The Great Gatsby(Published In
 * 1925)`, missing space included. The same cleanup already ran inside
 * `normalizeTitle`, but only for *comparing*; nothing cleaned a title that
 * was going to be shown or searched with. It surfaced when the "read it in
 * another edition" row started searching shops by the work's title (ROADMAP
 * 1.11): the query would have been that string, and no shop answers it.
 *
 * Unlike `normalizeTitle` the subtitle stays — "Beloved: A Novel" is a title
 * a shop can find, and this is a display string, not a key.
 */
export function displayTitle(title: string): string {
  return stripTrailingBrackets(title).trim() || title;
}

function stripTrailingBrackets(s: string): string {
  let out = s.trim();
  for (;;) {
    const next = out.replace(/\s*(\([^()]*\)|\[[^\[\]]*\])\s*$/, '');
    if (next === out || next.trim() === '') return out;
    out = next.trim();
  }
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
  /\b(study guide|summary|summaries|analysis|book analysis|cliffsnotes|cliff's notes|sparknotes|companion|reader'?s guide|critical essays|lesson plans|a guide to|casebook|teacher'?s guide|and philosophy|for dummies|for fans|trivia|quiz|questions and answers|festschrift|in plain and simple english)\b/i;

/**
 * A title that *ends* in "notes" is a set of notes about a book: "Crime and
 * Punishment Notes" (Cliffs Notes, 8 editions) sat at position 3 of `crime and
 * punishment` on 2026-09-07, and "Things Fall Apart, notes" at position 3 of
 * its own search. It must be the end of the title, not a word inside it, or
 * the rule would swallow Dostoevsky's own *Notes from Underground*.
 */
const NOTES_ABOUT = /(?:,\s*notes|\snotes)\s*$/i;

/**
 * "Notes on X" only counts as being *about* X when something precedes it:
 * "Barron's Notes on Macbeth" yes, "Notes on a Scandal" no.
 *
 * The plain `notes on` this replaces was measured wrong on 2026-09-08: a
 * search for `notes on a scandal` put Zoë Heller's novel at position 4,
 * behind Sheridan and *The Brothers Karamazov*, because its own title read
 * as a study guide. What the anchor gives up is a study guide called exactly
 * "Notes on <title>"; CliffsNotes and SparkNotes are caught by name anyway.
 */
const NOTES_ON_MIDWAY = /\S\s+notes on\b/i;

/**
 * Titles that announce themselves as a version of another work (SPEC §9.3
 * step 10): Open Library keeps `1984 (adaptation)` and `Pride and Prejudice
 * [adaptation]` as their own works, and a graphic novel or stage script is
 * not the book someone searched for.
 */
export const MARKED_DERIVATIVE =
  /[([](\s*)(adaptation|adapted|abridged|graphic novel|comic|illustrated|stage|play|script|screenplay|retold)\b|\b(graphic novel|stage adaptation|a play in|retold by|adapted by)\b|\bin (one|two|three|four|five|six|seven|\d+) acts?\b|\b(a play|an opera)\b/i;

/** Titles that are about a work rather than the work itself (SPEC §3 F1.4). */
export function looksLikeSecondaryLiterature(title: string): boolean {
  const t = title.trim();
  return SECONDARY_LITERATURE.test(t) || NOTES_ABOUT.test(t) || NOTES_ON_MIDWAY.test(t);
}

/**
 * What an ISBN's registration group says about where the printing was
 * registered (ROADMAP 1.11, lever 1).
 *
 * Measured over 567 editions from the five fixture works on 2026-09-08: of
 * the 243 editions that carry a cover, **44 % have an ISBN from neither the
 * English- nor the German-language area** — Turkey 47, Spain 18, Italy 14,
 * India 9, and a long tail. Those are not the bad covers, they are the
 * interesting ones, so nothing is hidden; but a Bookshop.org link built from
 * a Turkish ISBN is a link into the void, and this table is what lets the
 * shops be ordered by which of them has a chance.
 *
 * `area` is deliberately coarse — it only has to answer "does this belong to
 * the reader's market?". `place` exists for the sentence that explains the
 * order, and it is absent rather than guessed: a group outside the table
 * yields `other` with no name, and the wording then says what it knows
 * ("outside the English-language area") instead of inventing a country.
 *
 * 979-8 is its own area: Amazon issues that range for its own print-on-demand
 * titles. 182 of the 526 ISBNs in the measurement were 979-8 — but 181 of
 * them carry no cover at all, so they barely reach the wall.
 */
export interface IsbnRegistration {
  /** `en`, `de`, `fr`, `kdp` or `other`. Compared against the market's own area. */
  area: 'en' | 'de' | 'fr' | 'kdp' | 'other';
  /** The place the group stands for. Absent when the group is not in the table. */
  place?: string;
}

/** Leading digits of an ISBN-13 (prefix + registration group) -> what they mean. */
const REGISTRATION_GROUPS: Record<string, IsbnRegistration> = {
  // Language areas that span many countries; named as areas, not countries.
  '9780': { area: 'en', place: 'the English-language area' },
  '9781': { area: 'en', place: 'the English-language area' },
  '9782': { area: 'fr', place: 'the French-language area' },
  '9783': { area: 'de', place: 'the German-language area' },
  '97910': { area: 'fr', place: 'the French-language area' },
  '9784': { area: 'other', place: 'Japan' },
  '9785': { area: 'other', place: 'the Russian-language area' },
  '9787': { area: 'other', place: 'China' },
  '9798': { area: 'kdp', place: 'Amazon’s own 979-8 range' },
  '97911': { area: 'other', place: 'South Korea' },
  '97912': { area: 'other', place: 'Italy' },
  '97913': { area: 'other', place: 'Spain' },
  // Two-digit groups.
  '97880': { area: 'other', place: 'Czechia and Slovakia' },
  '97881': { area: 'other', place: 'India' },
  '97882': { area: 'other', place: 'Norway' },
  '97883': { area: 'other', place: 'Poland' },
  '97884': { area: 'other', place: 'Spain' },
  '97885': { area: 'other', place: 'Brazil' },
  '97886': { area: 'other', place: 'Serbia and Montenegro' },
  '97887': { area: 'other', place: 'Denmark' },
  '97888': { area: 'other', place: 'Italy' },
  '97889': { area: 'other', place: 'South Korea' },
  '97890': { area: 'other', place: 'the Dutch-language area' },
  '97891': { area: 'other', place: 'Sweden' },
  '97892': { area: 'other', place: 'an international organisation' },
  '97893': { area: 'other', place: 'India' },
  '97894': { area: 'other', place: 'the Dutch-language area' },
  // Three-digit groups.
  '978600': { area: 'other', place: 'Iran' },
  '978601': { area: 'other', place: 'Kazakhstan' },
  '978602': { area: 'other', place: 'Indonesia' },
  '978603': { area: 'other', place: 'Saudi Arabia' },
  '978604': { area: 'other', place: 'Vietnam' },
  '978605': { area: 'other', place: 'Turkey' },
  '978606': { area: 'other', place: 'Romania' },
  '978607': { area: 'other', place: 'Mexico' },
  '978608': { area: 'other', place: 'North Macedonia' },
  '978609': { area: 'other', place: 'Lithuania' },
  '978611': { area: 'other', place: 'Thailand' },
  '978612': { area: 'other', place: 'Peru' },
  '978613': { area: 'other', place: 'Mauritius' },
  '978614': { area: 'other', place: 'Lebanon' },
  '978615': { area: 'other', place: 'Hungary' },
  '978616': { area: 'other', place: 'Thailand' },
  '978617': { area: 'other', place: 'Ukraine' },
  '978618': { area: 'other', place: 'Greece' },
  '978619': { area: 'other', place: 'Bulgaria' },
  '978620': { area: 'other', place: 'Mauritius' },
  '978621': { area: 'other', place: 'the Philippines' },
  '978622': { area: 'other', place: 'Iran' },
  '978623': { area: 'other', place: 'Indonesia' },
  '978624': { area: 'other', place: 'Sri Lanka' },
  '978625': { area: 'other', place: 'Turkey' },
  '978626': { area: 'other', place: 'Taiwan' },
  '978627': { area: 'other', place: 'Pakistan' },
  '978628': { area: 'other', place: 'Colombia' },
  '978629': { area: 'other', place: 'Malaysia' },
  '978630': { area: 'other', place: 'Romania' },
  '978631': { area: 'other', place: 'Argentina' },
  '978950': { area: 'other', place: 'Argentina' },
  '978951': { area: 'other', place: 'Finland' },
  '978952': { area: 'other', place: 'Finland' },
  '978953': { area: 'other', place: 'Croatia' },
  '978954': { area: 'other', place: 'Bulgaria' },
  '978955': { area: 'other', place: 'Sri Lanka' },
  '978956': { area: 'other', place: 'Chile' },
  '978957': { area: 'other', place: 'Taiwan' },
  '978958': { area: 'other', place: 'Colombia' },
  '978959': { area: 'other', place: 'Cuba' },
  '978960': { area: 'other', place: 'Greece' },
  '978961': { area: 'other', place: 'Slovenia' },
  '978962': { area: 'other', place: 'Hong Kong' },
  '978963': { area: 'other', place: 'Hungary' },
  '978964': { area: 'other', place: 'Iran' },
  '978965': { area: 'other', place: 'Israel' },
  '978966': { area: 'other', place: 'Ukraine' },
  '978967': { area: 'other', place: 'Malaysia' },
  '978968': { area: 'other', place: 'Mexico' },
  '978969': { area: 'other', place: 'Pakistan' },
  '978970': { area: 'other', place: 'Mexico' },
  '978971': { area: 'other', place: 'the Philippines' },
  '978972': { area: 'other', place: 'Portugal' },
  '978973': { area: 'other', place: 'Romania' },
  '978974': { area: 'other', place: 'Thailand' },
  '978975': { area: 'other', place: 'Turkey' },
  '978976': { area: 'other', place: 'the Caribbean Community' },
  '978977': { area: 'other', place: 'Egypt' },
  '978978': { area: 'other', place: 'Nigeria' },
  '978979': { area: 'other', place: 'Indonesia' },
  '978980': { area: 'other', place: 'Venezuela' },
  '978981': { area: 'other', place: 'Singapore' },
  '978982': { area: 'other', place: 'the South Pacific' },
  '978983': { area: 'other', place: 'Malaysia' },
  '978984': { area: 'other', place: 'Bangladesh' },
  '978985': { area: 'other', place: 'Belarus' },
  '978986': { area: 'other', place: 'Taiwan' },
  '978987': { area: 'other', place: 'Argentina' },
  '978988': { area: 'other', place: 'Hong Kong' },
  '978989': { area: 'other', place: 'Portugal' },
  // Four-digit groups: only those the measurement actually met, plus their
  // neighbours. The rest fall through to `other` without a name, which is
  // the honest answer.
  '9789934': { area: 'other', place: 'Latvia' },
  '9789935': { area: 'other', place: 'Iceland' },
  '9789941': { area: 'other', place: 'Georgia' },
  '9789942': { area: 'other', place: 'Ecuador' },
  '9789943': { area: 'other', place: 'Uzbekistan' },
  '9789944': { area: 'other', place: 'Turkey' },
  '9789945': { area: 'other', place: 'the Dominican Republic' },
  '9789947': { area: 'other', place: 'Algeria' },
  '9789948': { area: 'other', place: 'the United Arab Emirates' },
  '9789949': { area: 'other', place: 'Estonia' },
  '9789952': { area: 'other', place: 'Azerbaijan' },
  '9789953': { area: 'other', place: 'Lebanon' },
  '9789954': { area: 'other', place: 'Morocco' },
  '9789955': { area: 'other', place: 'Lithuania' },
  '9789957': { area: 'other', place: 'Jordan' },
  '9789958': { area: 'other', place: 'Bosnia and Herzegovina' },
  '9789960': { area: 'other', place: 'Saudi Arabia' },
  '9789961': { area: 'other', place: 'Algeria' },
  '9789963': { area: 'other', place: 'Cyprus' },
  '9789965': { area: 'other', place: 'Kazakhstan' },
  '9789966': { area: 'other', place: 'Kenya' },
  '9789968': { area: 'other', place: 'Costa Rica' },
  '9789971': { area: 'other', place: 'Singapore' },
  '9789972': { area: 'other', place: 'Peru' },
  '9789973': { area: 'other', place: 'Tunisia' },
  '9789974': { area: 'other', place: 'Uruguay' },
  '9789975': { area: 'other', place: 'Moldova' },
  '9789976': { area: 'other', place: 'Tanzania' },
  '9789977': { area: 'other', place: 'Costa Rica' },
  '9789978': { area: 'other', place: 'Ecuador' },
  '9789979': { area: 'other', place: 'Iceland' },
  '9789984': { area: 'other', place: 'Latvia' },
  '9789985': { area: 'other', place: 'Estonia' },
  '9789986': { area: 'other', place: 'Lithuania' },
  '9789989': { area: 'other', place: 'North Macedonia' },
};

const UNNAMED: IsbnRegistration = { area: 'other' };

/**
 * Reads the registration group of an ISBN-13. Offline, no request, no guess.
 * Returns `undefined` for anything that is not a 13-digit 978/979 ISBN.
 */
export function registrationArea(isbn: string | undefined): IsbnRegistration | undefined {
  const s = cleanIsbn(isbn);
  if (!s || s.length !== 13) return undefined;
  if (!s.startsWith('978') && !s.startsWith('979')) return undefined;
  // Longest match wins: 979-8 must not be read as 979-80.
  for (let len = 8; len >= 4; len--) {
    const hit = REGISTRATION_GROUPS[s.slice(0, len)];
    if (hit) return hit;
  }
  return UNNAMED;
}
