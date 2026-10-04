/**
 * Colour schemes taken from the material instead of from taste (Julian,
 * 2026-10-02: „mach ein mockup"), and the contrast check they must pass.
 *
 * The finding behind it (docs/gestaltung-ki-anmutung.md): cream `#f4f0e8`
 * with terracotta `#945138` is close to Anthropic's own brand colours, so the
 * site looks like what a model builds when nobody tells it a colour. The
 * candidates here borrow from book design that readers know — Heinz
 * Edelmann's yellow for Reihe Hanser, the Penguin orange band — or drop the
 * accent and leave all colour to the covers.
 *
 * Unlike lab/palette (ROADMAP 6.22, which only swapped the accent), a scheme
 * here separates three jobs the accent does on the site today: link text,
 * the filled button, and the selected tab. Yellow and Penguin orange cannot
 * be text on a light ground (they fail AA), but they can be a fill with ink
 * on it, which is how the books themselves use them.
 *
 * Nothing in this folder reaches the website (lab/README).
 */
import { CONTRAST_AA, contrastRatio } from '../../lib/contrast';

export interface Scheme {
  bg: string;
  surface: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  /** Links and small accented text. */
  accent: string;
  /** The filled button (Search, the first shop). */
  button: string;
  onButton: string;
  /** The selected tab or language. */
  select: string;
  onSelect: string;
  /** An optional band across the top of the page, as on a Penguin cover. */
  band?: string;
}

export interface Look {
  id: string;
  name: string;
  /** Today's labels, arrows and dot lines, or the proposal without them. */
  form: 'today' | 'proposal';
  claim: string;
  light: Scheme;
  dark: Scheme;
}

const TODAY_LIGHT: Scheme = {
  bg: '#f4f0e8', surface: '#fbf9f4', ink: '#1a1714', ink2: '#5a534a', ink3: '#746c62', line: '#ddd5c8',
  accent: '#945138', button: '#945138', onButton: '#fff8f2', select: '#1a1714', onSelect: '#f4f0e8',
};
const TODAY_DARK: Scheme = {
  bg: '#131110', surface: '#1b1815', ink: '#efe8dd', ink2: '#b2a99b', ink3: '#837b6f', line: '#2e2925',
  accent: '#dbac94', button: '#dbac94', onButton: '#1a1210', select: '#efe8dd', onSelect: '#131110',
};

export const LOOKS: Look[] = [
  {
    id: 'today',
    name: 'Heute',
    form: 'today',
    claim: 'Creme und Terrakotta, Großbuchstaben-Etiketten, Pillen, Pfeile, Mittelpunkte, Slogan im Kopf. Zum Vergleich, so wie ausgeliefert.',
    light: TODAY_LIGHT,
    dark: TODAY_DARK,
  },
  {
    id: 'today-form',
    name: 'Heutige Farben, neue Form',
    form: 'proposal',
    claim: 'Nur die Vorschläge zu Etiketten, Pfeilen, Mittelpunkten und Slogan, die Farben bleiben. Zeigt, wie viel die Form allein ausmacht.',
    light: TODAY_LIGHT,
    dark: TODAY_DARK,
  },
  {
    id: 'gallery',
    name: 'Galerie · keine Akzentfarbe',
    form: 'proposal',
    claim: 'Kühles, fast weißes Papier und Tinte, sonst nichts. Alle Farbe kommt von den Covern — das, was SPEC §8.1 verspricht. Links tragen Unterstreichung statt Farbe. Am wenigsten „Vorlage", am strengsten.',
    light: {
      bg: '#f6f6f3', surface: '#ffffff', ink: '#121212', ink2: '#4a4a48', ink3: '#686865', line: '#e0e0dc',
      accent: '#121212', button: '#121212', onButton: '#ffffff', select: '#121212', onSelect: '#ffffff',
    },
    dark: {
      bg: '#111111', surface: '#191919', ink: '#ececea', ink2: '#b0b0ac', ink3: '#8a8a86', line: '#2a2a28',
      accent: '#ececea', button: '#ececea', onButton: '#111111', select: '#ececea', onSelect: '#111111',
    },
  },
  {
    id: 'hanser',
    name: 'Edelmann-Gelb · Reihe Hanser',
    form: 'proposal',
    claim: 'Das Gelb, das Heinz Edelmann ab 1967 für die Reihe Hanser setzte, als Fläche: Suchknopf, gewählte Sprache, erster Laden. Schwarze Schrift darauf, wie auf den Umschlägen. Text bleibt Tinte, weil Gelb auf hellem Grund unlesbar ist.',
    light: {
      bg: '#f8f7f2', surface: '#ffffff', ink: '#141414', ink2: '#4b4a45', ink3: '#69675f', line: '#e2e0d6',
      accent: '#141414', button: '#f2c200', onButton: '#141414', select: '#f2c200', onSelect: '#141414',
    },
    dark: {
      bg: '#121211', surface: '#1a1a18', ink: '#eeede6', ink2: '#b4b2a8', ink3: '#8c8a80', line: '#2b2a26',
      accent: '#f2c200', button: '#f2c200', onButton: '#141414', select: '#f2c200', onSelect: '#141414',
    },
  },
  {
    id: 'penguin',
    name: 'Penguin-Orange · das Band',
    form: 'proposal',
    claim: 'Das Orange der Penguin-Romane von 1935 als Band über der Seite und als Fläche für Knopf und Auswahl, Schrift schwarz darauf; Links in einem dunklen Orange, das auf weißem Grund AA hält. Am wärmsten, und das einzige mit einer erkennbaren Herkunft auf den ersten Blick.',
    light: {
      bg: '#fbfaf7', surface: '#ffffff', ink: '#141414', ink2: '#4b4a46', ink3: '#6a6862', line: '#e4e1da',
      accent: '#a84400', button: '#f07020', onButton: '#141414', select: '#f07020', onSelect: '#141414',
      band: '#f07020',
    },
    dark: {
      bg: '#121110', surface: '#1a1917', ink: '#efece6', ink2: '#b6b2aa', ink3: '#8d8981', line: '#2c2a27',
      accent: '#ff9a52', button: '#f07020', onButton: '#141414', select: '#f07020', onSelect: '#141414',
      band: '#f07020',
    },
  },
];

export interface ContrastRow {
  pair: string;
  ratio: number;
  needs: number;
  passes: boolean;
}

/** The pairs that occur on the page; `ink-3` carries 11–12 px metadata, so AA applies. */
export function contrastRows(s: Scheme): ContrastRow[] {
  const pairs: Array<[string, string, string]> = [
    ['ink auf bg', s.ink, s.bg],
    ['ink-2 auf bg', s.ink2, s.bg],
    ['ink-3 auf bg', s.ink3, s.bg],
    ['Link auf bg', s.accent, s.bg],
    ['Schrift auf Knopf', s.onButton, s.button],
    ['Schrift auf Auswahl', s.onSelect, s.select],
  ];
  return pairs.map(([pair, a, b]) => {
    const ratio = Math.round(contrastRatio(a, b) * 100) / 100;
    return { pair, ratio, needs: CONTRAST_AA, passes: ratio >= CONTRAST_AA };
  });
}
