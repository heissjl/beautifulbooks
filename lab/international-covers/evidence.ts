/**
 * Language evidence for an Open Library edition that carries no language
 * field (Julian, 2026-09-26: „you can't find an international cover for
 * each book? seems unlikely"). Pure, offline.
 *
 * - **ISBN registration group.** A group is where the publisher registered,
 *   which is a strong hint of the language but not proof: 978-84 is Spain,
 *   Catalan included; 978-3 is German-speaking, Swiss French excluded. Only
 *   groups whose market is overwhelmingly one language are listed; English
 *   groups (0, 1, 979-8) and mixed ones (India 81/93, international 92,
 *   Belgium's share of 90, Belarus 985) answer null.
 * - **Publisher.** Houses that publish (almost) only in one language — the
 *   SF imprints the relaunch's translations appear under. A name that is
 *   also an English imprint ("Pocket", "Nova", "Folio", "Prisma") is
 *   deliberately missing.
 */
import { cleanIsbn, isbn10to13 } from '../../lib/normalize';

/** ISBN-13 prefix → MARC language code. Longest prefix wins. */
const ISBN_GROUPS: Record<string, string> = {
  '9782': 'fre', '97910': 'fre',
  '9783': 'ger',
  '9784': 'jpn',
  '9785': 'rus',
  '9787': 'chi', '978957': 'chi', '978986': 'chi',
  '97880': 'cze',
  '97882': 'nor',
  '97883': 'pol',
  '97884': 'spa', '978950': 'spa', '978956': 'spa', '978958': 'spa', '978968': 'spa', '978970': 'spa', '978607': 'spa', '978987': 'spa', '978980': 'spa', '9789974': 'spa',
  '97885': 'por', '97865': 'por', '978972': 'por', '978989': 'por',
  '97886': 'srp',
  '97887': 'dan',
  '97888': 'ita', '97912': 'ita',
  '97889': 'kor', '97911': 'kor',
  '97890': 'dut', '97894': 'dut',
  '97891': 'swe',
  '978951': 'fin', '978952': 'fin',
  '978953': 'hrv',
  '978954': 'bul',
  '978960': 'gre', '978618': 'gre',
  '978961': 'slv',
  '978963': 'hun',
  '978965': 'heb',
  '978966': 'ukr', '978617': 'ukr',
  '978973': 'rum', '978606': 'rum',
  '978975': 'tur', '978605': 'tur', '9789944': 'tur',
  '978979': 'ind', '978602': 'ind', '978623': 'ind',
  '978964': 'per', '978600': 'per',
  '978974': 'tha', '978616': 'tha',
  '978604': 'vie',
  '9789955': 'lit', '9789986': 'lit', '978609': 'lit',
  '9789949': 'est', '9789985': 'est',
  '9789934': 'lav', '9789984': 'lav',
};

export function isbnLanguage(raw: string | undefined): string | null {
  let isbn = cleanIsbn(raw);
  if (!isbn) return null;
  if (isbn.length === 10) isbn = isbn10to13(isbn);
  if (isbn.length !== 13) return null;
  for (let len = 7; len >= 4; len--) {
    const hit = ISBN_GROUPS[isbn.slice(0, len)];
    if (hit) return hit;
  }
  return null;
}

/** Publisher pattern → language. Whole words, case-insensitive. */
const PUBLISHERS: Array<[RegExp, string]> = [
  [/\b(heyne|goldmann|bastei|l[üu]bbe|moewig|pabel|knaur|ullstein|rowohlt|suhrkamp|fischer (taschenbuch|verlag)|dtv|deutscher taschenbuch|piper|droemer|golkonda|festa|lichtenberg|marion von schr[öo]der|kindler|insel verlag|diogenes|wilhelm heyne)\b/i, 'ger'],
  [/\b(deno[eë]l|j'ai lu|presses pocket|livre de poche|robert laffont|gallimard|albin michel|opta|fleuve noir|librairie des champs|bragelonne|l'atalante|flammarion|marabout|le b[ée]lial|calmann|seuil|mnémos|presses de la cit[ée]|10\s*\/\s*18)\b/i, 'fre'],
  [/\b(minotauro|edhasa|acervo|mart[íi]nez roca|ediciones b|plaza (y|&) jan[ée]s|alianza editorial|debolsillo|ultramar|gigamesh|nova ciencia ficci[óo]n|anagrama|c[áa]tedra|bruguera|ediciones orbis|la factor[íi]a de ideas)\b/i, 'spa'],
  [/\b(urania|mondadori|editrice nord|fanucci|longanesi|einaudi|feltrinelli|garzanti|rizzoli|adelphi|delos|bompiani)\b/i, 'ita'],
  [/(hayakawa|早川|東京創元|tokyo sogensha|sōgensha|kadokawa|角川|新潮|shinchosha)/i, 'jpn'],
  [/(\bast\b|аст|eksmo|эксмо|азбука|azbuka|terra fantastica|мир|северо-запад|полярис)/i, 'rus'],
  [/\b(aleph|europa-am[ée]rica|presen[çc]a|bertrand (brasil|editora)|companhia das letras|l&pm)\b/i, 'por'],
  [/\b(zysk|rebis|pr[óo]szy[ńn]ski|wydawnictwo|iskry|czytelnik)\b/i, 'pol'],
  [/\b(meulenhoff|bruna|luitingh|het spectrum)\b/i, 'dut'],
  [/\b(ithaki|metis|kabalc[ıi]|yay[ıi]nlar[ıi]|yay[ıi]nevi)\b/i, 'tur'],
];

export function publisherLanguage(publishers: readonly string[] | undefined): string | null {
  for (const p of publishers ?? []) for (const [re, lang] of PUBLISHERS) if (re.test(p)) return lang;
  return null;
}
