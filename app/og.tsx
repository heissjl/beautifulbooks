import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * What the shared-link cards have in common (ROADMAP 6.61): the site's two
 * faces and its colours. `next/og` reads neither WOFF2 nor variable fonts, so
 * it takes the WOFF twins of the page's Xanh from `assets/fonts/` and static
 * WOFF copies of Jost from `assets/og/` (OFL, licences beside them). Latin
 * and Latin Extended only: a title in another script falls back to the
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
      ['Xanh', 'fonts/xanh-proportional-regular.woff', 'normal'],
      ['Xanh', 'fonts/xanh-proportional-italic.woff', 'italic'],
      ['Jost', 'og/jost-latin-400-normal.woff', 'normal'],
      ['Jost', 'og/jost-latin-ext-400-normal.woff', 'normal'],
    ] as const).map(async ([name, file, style]) => ({
      name,
      data: await readFile(join(process.cwd(), 'assets', file)),
      weight: 400 as const,
      style,
    })),
  );
  return fonts;
}

export const DISPLAY = { fontFamily: 'Xanh' } as const;
export const TEXT = { fontFamily: 'Jost' } as const;

/** Text in Xanh, as the page sets headings (SPEC §5). */
export function Display({ children, size, color, italic = false, lineHeight = 1.1 }: {
  children: string;
  size: number;
  color: string;
  italic?: boolean;
  lineHeight?: number;
}) {
  return (
    <div style={{ ...DISPLAY, display: 'flex', fontSize: size, color, lineHeight, fontStyle: italic ? 'italic' : 'normal' }}>
      {children}
    </div>
  );
}

/** The name as the header sets it: Xanh, italic. */
export function Wordmark({ size, color }: { size: number; color: string }) {
  return <Display size={size} color={color} italic>Beautiful Books</Display>;
}
