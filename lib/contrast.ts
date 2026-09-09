/**
 * WCAG contrast, so a colour decision can be checked instead of eyeballed
 * (SPEC §5, ROADMAP 6.22).
 *
 * It lives in `lib/` rather than beside the palette mock-ups because the
 * shipped tokens are tested against it: `app/globals.css` failed AA on
 * `ink-3` from the day it was written — 3.28 in light, 4.14 in dark — and
 * nobody saw it, because the passing shade is barely a step darker. A number
 * catches that; an eye does not.
 */

/** sRGB channel to linear light. */
function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map(c => c + c).join('') : m;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio between two hex colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * AA for normal text. The site's smallest text — metadata lines, verdict
 * notes — sits at 11–12 px, so the large-text exception (3.0) never applies
 * to `ink-2` or `ink-3`.
 */
export const CONTRAST_AA = 4.5;
