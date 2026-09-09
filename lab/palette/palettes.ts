/**
 * Candidate colour schemes for ROADMAP 6.22, and the contrast check they have
 * to survive.
 *
 * The question Julian asked is about the **accent**: terracotta `#b1502b` is
 * today the only colour in the interface — search button, language pills,
 * focus rings, links, the verdict note — and therefore the only one competing
 * with the covers. Change it and the site changes character; change the
 * ground and you change the stage.
 *
 * The constraint that decides everything here: **the ground stands behind
 * hundreds of covers in every colour there is.** The more colour it has of
 * its own, the more it argues with them. Paper white was chosen for exactly
 * that reason, so three of the four candidates leave it alone and only one
 * touches it — the point is to see what each change costs, not to redecorate.
 *
 * Nothing in this folder reaches the website; it draws mock-ups (lab/README).
 */

export interface Scheme {
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  accent: string;
  onAccent: string;
}

export interface Candidate {
  id: string;
  name: string;
  /** What changes, and what it buys. */
  claim: string;
  light: Scheme;
  dark: Scheme;
}

/**
 * `ink-3` corrected to WCAG AA.
 *
 * Measured while building this page on 2026-09-09, and it is the finding that
 * outranks the colour question: **today's `ink-3` fails AA on its own ground**
 * — 3.28 in light, 4.14 in dark, against the 4.5 that normal text needs. It
 * carries the metadata lines and the verdict notes at 11–12 px, so the large
 * text exception does not apply. The nearest passing values are barely a
 * shade away (4.55 and 4.51), which is why nobody noticed.
 *
 * The proposals below use them; `today` keeps the failing value, because it
 * is the reference and the table should show what is actually shipped.
 */
const INK3_AA_LIGHT = '#746c62';
const INK3_AA_DARK = '#837b6f';

/** Today's tokens, copied from `app/globals.css`. The reference, not a proposal. */
const TODAY_LIGHT: Scheme = {
  bg: '#f4f0e8', surface: '#fbf9f4', surface2: '#ebe5da',
  ink: '#1a1714', ink2: '#5a534a', ink3: '#8c8377',
  line: '#ddd5c8', accent: '#b1502b', onAccent: '#fff8f2',
};

const TODAY_DARK: Scheme = {
  bg: '#131110', surface: '#1b1815', surface2: '#26221e',
  ink: '#efe8dd', ink2: '#b2a99b', ink3: '#7d7569',
  line: '#2e2925', accent: '#e6a677', onAccent: '#1a1210',
};

export const CANDIDATES: Candidate[] = [
  {
    id: 'today',
    name: 'Heute · Terrakotta',
    claim:
      'Der Stand. Terrakotta ist warm und nah an den Rot- und Ockertönen, die auf Buchrücken '
      + 'häufig sind — es fällt auf der Wand deshalb weniger als Fremdkörper auf, konkurriert dort '
      + 'aber auch am ehesten mit den Covern selbst. Unverändert übernommen, samt dem ink-3, das '
      + 'WCAG AA verfehlt — daher die rote Zeile in seiner Tabelle.',
    light: TODAY_LIGHT,
    dark: TODAY_DARK,
  },
  {
    id: 'ink',
    name: 'Tinte · gar keine Akzentfarbe',
    claim:
      'Die radikale Antwort: die Oberfläche hat keine eigene Farbe, der Akzent ist dieselbe Tinte '
      + 'wie der Text, unterschieden nur durch Unterstreichung und Gewicht. Alle Farbe auf der Seite '
      + 'kommt dann von den Covern — was das Produktversprechen ist. Preis: Knöpfe und Fokusringe '
      + 'müssen ihre Sichtbarkeit aus Form statt aus Farbe holen, und die Seite wirkt strenger. '
      + 'Enthält, wie alle Vorschläge, das korrigierte ink-3.',
    light: { ...TODAY_LIGHT, ink3: INK3_AA_LIGHT, accent: '#2c2622', onAccent: '#f7f4ee' },
    dark: { ...TODAY_DARK, ink3: INK3_AA_DARK, accent: '#e8e1d6', onAccent: '#17130f' },
  },
  {
    id: 'indigo',
    name: 'Indigo · kühler Akzent auf warmem Papier',
    claim:
      'Ein Blau, das kein Cover je trägt, auf demselben Papier. Es tritt hinter die Wand zurück, '
      + 'weil es mit nichts auf ihr verwandt ist, und der Kontrast warm/kalt macht die Bedienelemente '
      + 'sofort als Bedienelemente lesbar. Preis: die Seite wird sachlicher und verliert die Wärme, '
      + 'die heute Papier und Akzent gemeinsam erzeugen. Enthält das korrigierte ink-3.',
    light: { ...TODAY_LIGHT, ink3: INK3_AA_LIGHT, accent: '#2f4b7c', onAccent: '#f5f7fb' },
    dark: { ...TODAY_DARK, ink3: INK3_AA_DARK, accent: '#9db6e0', onAccent: '#10141c' },
  },
  {
    id: 'olive',
    name: 'Olive · gedämpft, dazu kühleres Papier',
    claim:
      'Der einzige Kandidat, der auch die Grundfarbe anfasst: ein Papier mit weniger Gelb, dazu ein '
      + 'stumpfes Oliv. Beides tritt zurück; die Wand wird kühler beleuchtet und die Cover wirken '
      + 'wärmer, als sie sind. Preis: das Papier verliert seinen Charakter und nähert sich Weiß. '
      + 'Enthält das korrigierte ink-3.',
    light: {
      bg: '#f2f1ec', surface: '#faf9f6', surface2: '#e8e7e1',
      ink: '#191a17', ink2: '#54564f', ink3: '#6d6f67',
      line: '#d9d9d2', accent: '#5c6b3c', onAccent: '#f7f8f3',
    },
    dark: {
      bg: '#111210', surface: '#191a17', surface2: '#232520',
      ink: '#e9eae4', ink2: '#a9aba2', ink3: '#7c7e75',
      line: '#2b2d28', accent: '#a8bd7c', onAccent: '#12140f',
    },
  },
];

/** sRGB channel to linear, for the WCAG relative luminance. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const m = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export interface ContrastRow {
  pair: string;
  ratio: number;
  /** AA for normal text is 4.5; for large text and UI borders 3.0. */
  needs: number;
  passes: boolean;
}

/**
 * The pairs that actually occur in the interface. `ink-2` and `ink-3` carry
 * the metadata and the verdict notes, which is why they are checked at all —
 * a scheme that fails there fails, however good it looks (ROADMAP 6.22).
 */
export function contrastRows(scheme: Scheme): ContrastRow[] {
  const pairs: Array<[string, string, string, number]> = [
    ['ink auf bg', scheme.ink, scheme.bg, 4.5],
    ['ink-2 auf bg', scheme.ink2, scheme.bg, 4.5],
    // `ink-3` trägt Metadaten und Verdikt-Hinweise bei 11–12 px, also gilt
    // die Schwelle für normalen Text, nicht die für großen.
    ['ink-3 auf bg', scheme.ink3, scheme.bg, 4.5],
    ['accent auf bg', scheme.accent, scheme.bg, 4.5],
    ['on-accent auf accent', scheme.onAccent, scheme.accent, 4.5],
    ['ink auf surface-2', scheme.ink, scheme.surface2, 4.5],
    /*
      Eine 1-px-Trennlinie ist kein Text und keine Bedienelementgrenze, die
      etwas bedeutet; WCAG verlangt dafür nichts. Die Zeile steht hier zur
      Anschauung, mit Schwelle 1, damit sie nicht als Durchfaller erscheint
      und die echten Durchfaller überdeckt.
    */
    ['line auf bg (nur zur Anschauung)', scheme.line, scheme.bg, 1],
  ];
  return pairs.map(([pair, a, b, needs]) => {
    const ratio = Math.round(contrast(a, b) * 100) / 100;
    return { pair, ratio, needs, passes: ratio >= needs };
  });
}
