import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * What the shared-link cards have in common (ROADMAP 6.61): the site's two
 * faces and its colours. `next/og` cannot use the page's next/font files and
 * reads neither WOFF2 nor variable fonts, so static WOFF copies of Xanh Mono
 * and Jost live in `assets/og/` (OFL, licences beside them). Latin and
 * Latin Extended only: a title in another script falls back to the
 * generator's default face, as every title did before.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export const OG = {
  bg: '#131110',
  ink: '#f4f0e8',
  ink2: '#a8a09a',
  paper: '#f4f0e8',
  paperInk: '#1f1b18',
  paperInk2: '#746c62',
  accent: '#945138',
  accentDark: '#dbac94',
} as const;

type OgFont = { name: string; data: Buffer; weight: 400; style: 'normal' | 'italic' };

let fonts: Promise<OgFont[]> | null = null;

export function ogFonts(): Promise<OgFont[]> {
  fonts ??= Promise.all(
    ([
      ['Xanh Mono', 'xanh-mono-latin-400-normal.woff', 'normal'],
      ['Xanh Mono', 'xanh-mono-latin-ext-400-normal.woff', 'normal'],
      ['Xanh Mono', 'xanh-mono-latin-400-italic.woff', 'italic'],
      ['Xanh Mono', 'xanh-mono-latin-ext-400-italic.woff', 'italic'],
      ['Jost', 'jost-latin-400-normal.woff', 'normal'],
      ['Jost', 'jost-latin-ext-400-normal.woff', 'normal'],
    ] as const).map(async ([name, file, style]) => ({
      name,
      data: await readFile(join(process.cwd(), 'assets/og', file)),
      weight: 400 as const,
      style,
    })),
  );
  return fonts;
}

export const DISPLAY = { fontFamily: 'Xanh Mono' } as const;
export const TEXT = { fontFamily: 'Jost' } as const;

/**
 * Text in Xanh Mono with the page's tighter word spacing (SPEC §5). The
 * generator ignores `word-spacing`, and a Xanh Mono space is a full cell
 * (0.5em), so the words are set as separate boxes: `space` is what is left
 * of the space — 0.2em for the headline's -0.3em, 0.35em for -0.15em.
 */
export function Display({ children, size, color, space = 0.2, italic = false, lineHeight = 1.1 }: {
  children: string;
  size: number;
  color: string;
  space?: number;
  italic?: boolean;
  lineHeight?: number;
}) {
  return (
    <div
      style={{
        ...DISPLAY, display: 'flex', flexWrap: 'wrap', fontSize: size, color, lineHeight,
        columnGap: Math.round(space * size), fontStyle: italic ? 'italic' : 'normal',
      }}
    >
      {children.split(/\s+/).filter(Boolean).map((word, i) => <span key={i}>{word}</span>)}
    </div>
  );
}

/** The name as the header sets it: Xanh Mono, italic. */
export function Wordmark({ size, color }: { size: number; color: string }) {
  return <Display size={size} color={color} space={0.35} italic>Beautiful Books</Display>;
}
