/**
 * How a frame's moulding is drawn (ROADMAP 5.13f; Julian, 2026-09-29: „das
 * helle holz sieht noch komisch aus, mache das silber und gold
 * fotorealistischer“). Pure and client-safe: CSS backgrounds only.
 *
 * A real frame is four mitred pieces. Each piece here gets
 *  - its material along its length: wood grain from stretched noise (an SVG
 *    turbulence filter), brushed metal from finer stretched noise and a sheen,
 *  - a bevel across its width: a bright outer edge, a darker face, a lit lip,
 *  - its own light: from the top left, so the top is brightest and the bottom
 *    darkest, as a frame on a wall is seen.
 */
export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Material = 'paint' | 'wood' | 'metal';

export interface MouldingStyle {
  material: Material;
  /** Base colour, and the light and dark of the material. */
  base: string;
  light: string;
  dark: string;
}

/** Light from the top left: white on the lit sides, black on the others. */
const LIGHT: Record<Side, string> = {
  top: 'rgba(255,255,255,.16)',
  left: 'rgba(255,255,255,.07)',
  right: 'rgba(0,0,0,.12)',
  bottom: 'rgba(0,0,0,.24)',
};

/** The direction from the outer edge of a piece to its inner lip. */
const ACROSS: Record<Side, string> = { top: '180deg', bottom: '0deg', left: '90deg', right: '270deg' };
/** The direction along a piece. */
const ALONG: Record<Side, string> = { top: '90deg', bottom: '90deg', left: '180deg', right: '180deg' };
const horizontal = (side: Side) => side === 'top' || side === 'bottom';

/** Stretched noise in one colour: grain in the wood's own dark, not grey (black noise made oak look dirty). */
function noise(freqAlong: number, freqAcross: number, side: Side, alpha: number, seed: number, hex = '#000000'): string {
  const [fx, fy] = horizontal(side) ? [freqAlong, freqAcross] : [freqAcross, freqAlong];
  const [r, g, b] = [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3));
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>` +
    `<filter id='g' color-interpolation-filters='sRGB'><feTurbulence type='fractalNoise' baseFrequency='${fx} ${fy}' numOctaves='3' seed='${seed}' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${alpha} 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(%23g)'/></svg>`;
  return `url("data:image/svg+xml;utf8,${svg}")`;
}

/** The CSS background of one piece of the moulding. */
export function mouldingSide(style: MouldingStyle, side: Side): string {
  const light = `linear-gradient(${LIGHT[side]}, ${LIGHT[side]})`;
  const across = ACROSS[side];
  const along = ALONG[side];
  const seed = { top: 3, right: 7, bottom: 11, left: 5 }[side];
  if (style.material === 'wood') {
    return [
      light,
      // Grain: long streaks along the piece, and a few darker figure lines.
      noise(0.006, 0.55, side, 0.5, seed, style.dark),
      noise(0.002, 0.12, side, 0.35, seed + 1, style.dark),
      // A rounded profile: lit outer edge, the face, a shadowed lip.
      `linear-gradient(${across}, rgba(255,255,255,.18) 0%, transparent 18%, transparent 70%, rgba(0,0,0,.18) 88%, rgba(255,255,255,.10) 94%, rgba(0,0,0,.25) 100%)`,
      `linear-gradient(${along}, ${style.base}, ${style.light} 35%, ${style.base} 60%, ${style.dark} 85%, ${style.base})`,
    ].join(', ');
  }
  if (style.material === 'metal') {
    return [
      light,
      // Brushed: very fine streaks along the piece.
      noise(0.004, 1.4, side, 0.1, seed),
      // Sheen along the piece: two soft highlights, as a lamp shows on gilt.
      `linear-gradient(${along}, transparent 0%, rgba(255,255,255,.35) 22%, transparent 34%, transparent 58%, rgba(255,255,255,.28) 72%, transparent 84%)`,
      // Bevel across: bright outer rim, dark cove, bright bead, dark lip.
      `linear-gradient(${across}, ${style.light} 0%, ${style.base} 16%, ${style.dark} 34%, ${style.base} 52%, ${style.light} 66%, ${style.base} 78%, ${style.dark} 92%, ${style.light} 100%)`,
    ].join(', ');
  }
  return [
    light,
    `linear-gradient(${across}, rgba(255,255,255,.12) 0%, transparent 25%, transparent 78%, rgba(0,0,0,.14) 100%)`,
    `linear-gradient(${style.base}, ${style.base})`,
  ].join(', ');
}

/** The clip of one mitred piece, as a CSS polygon; `fx`, `fy` are the moulding's share of width and height in per cent. */
export function mitre(side: Side, fx: number, fy: number): string {
  if (side === 'top') return `polygon(0 0, 100% 0, ${100 - fx}% 100%, ${fx}% 100%)`;
  if (side === 'bottom') return `polygon(${fx}% 0, ${100 - fx}% 0, 100% 100%, 0 100%)`;
  if (side === 'left') return `polygon(0 0, 100% ${fy}%, 100% ${100 - fy}%, 0 100%)`;
  return `polygon(0 ${fy}%, 100% 0, 100% 100%, 0 ${100 - fy}%)`;
}
