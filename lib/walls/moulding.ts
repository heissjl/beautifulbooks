/**
 * How a frame's moulding is drawn (ROADMAP 5.13f). Pure and client-safe.
 *
 * Julian, 2026-09-29: „bau den Rahmen per border-image“, after Level Frames'
 * collage builder, which stretches the photo of a small sample frame over any
 * size with CSS `border-image`. We draw our own sample instead of using a
 * photo: a square SVG frame whose four mitred pieces each carry
 *  - their material along their length: wood grain from stretched noise (an
 *    SVG turbulence filter in the wood's own dark, in sRGB — the default
 *    linear RGB made the grain pale), brushed metal from finer noise and a sheen,
 *  - a profile across their width: outer edge, face, cove, bead, lip,
 *  - their own light, from the top left: top brightest, bottom darkest.
 * `border-image` keeps the corners as drawn and stretches each piece only
 * along its length, which is the direction grain and brushing run.
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

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];
/** The sample: a square of `SIZE`, the moulding `BAND` wide. */
export const SAMPLE = { size: 300, band: 60 } as const;

/** Light from the top left: white on the lit sides, black on the others. */
const LIGHT: Record<Side, [string, number]> = {
  top: ['#ffffff', 0.16],
  left: ['#ffffff', 0.07],
  right: ['#000000', 0.12],
  bottom: ['#000000', 0.24],
};

const horizontal = (side: Side) => side === 'top' || side === 'bottom';

/** The piece of the sample for one side, mitred at 45°. */
function polygon(side: Side): string {
  const { size: S, band: B } = SAMPLE;
  if (side === 'top') return `0,0 ${S},0 ${S - B},${B} ${B},${B}`;
  if (side === 'bottom') return `${B},${S - B} ${S - B},${S - B} ${S},${S} 0,${S}`;
  if (side === 'left') return `0,0 ${B},${B} ${B},${S - B} 0,${S}`;
  return `${S - B},${B} ${S},0 ${S},${S} ${S - B},${S - B}`;
}

/** From the outer edge of a piece to its inner lip, in the sample's units. */
function across(side: Side): [number, number, number, number] {
  const { size: S, band: B } = SAMPLE;
  if (side === 'top') return [0, 0, 0, B];
  if (side === 'bottom') return [0, S, 0, S - B];
  if (side === 'left') return [0, 0, B, 0];
  return [S, 0, S - B, 0];
}

function rgb(hex: string): [string, string, string] {
  return [1, 3, 5].map((i) => (parseInt(hex.slice(i, i + 2), 16) / 255).toFixed(3)) as [string, string, string];
}

/** Stops of the profile across a piece, outer edge first. */
function profile(style: MouldingStyle): Array<[number, string, number]> {
  const { base, light, dark } = style;
  if (style.material === 'metal') {
    return [[0, light, 1], [0.16, base, 1], [0.34, dark, 1], [0.52, base, 1], [0.66, light, 1], [0.78, base, 1], [0.92, dark, 1], [1, light, 1]];
  }
  if (style.material === 'wood') {
    return [[0, light, 1], [0.14, base, 1], [0.7, base, 1], [0.86, dark, 1], [0.93, light, 1], [1, dark, 1]];
  }
  return [[0, light, 1], [0.2, base, 1], [0.8, base, 1], [1, dark, 1]];
}

/** Grain: low frequency along the piece, high across it. */
function grain(style: MouldingStyle): { along: number; across: number; alpha: number } | null {
  if (style.material === 'wood') return { along: 0.012, across: 0.45, alpha: 0.55 };
  if (style.material === 'metal') return { along: 0.006, across: 1.2, alpha: 0.18 };
  return null;
}

/** The sample frame as SVG markup. */
export function mouldingSvg(style: MouldingStyle): string {
  const { size: S } = SAMPLE;
  const g = grain(style);
  const [r, gr, b] = rgb(style.material === 'metal' ? '#000000' : style.dark);
  const defs: string[] = [];
  const body: string[] = [];
  if (g) {
    for (const dir of ['h', 'v'] as const) {
      const [fx, fy] = dir === 'h' ? [g.along, g.across] : [g.across, g.along];
      defs.push(
        `<filter id="g${dir}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
          `<feTurbulence type="fractalNoise" baseFrequency="${fx} ${fy}" numOctaves="3" seed="${dir === 'h' ? 3 : 7}"/>` +
          `<feColorMatrix values="0 0 0 0 ${r}  0 0 0 0 ${gr}  0 0 0 0 ${b}  0 0 0 ${g.alpha} 0"/></filter>`,
      );
    }
  }
  for (const side of SIDES) {
    const [x1, y1, x2, y2] = across(side);
    defs.push(`<clipPath id="c${side}"><polygon points="${polygon(side)}"/></clipPath>`);
    defs.push(
      `<linearGradient id="p${side}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
        profile(style).map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('') +
        `</linearGradient>`,
    );
    const [lc, la] = LIGHT[side];
    body.push(
      `<g clip-path="url(#c${side})">` +
        `<rect width="${S}" height="${S}" fill="url(#p${side})"/>` +
        (g ? `<rect width="${S}" height="${S}" filter="url(#g${horizontal(side) ? 'h' : 'v'})"/>` : '') +
        `<rect width="${S}" height="${S}" fill="${lc}" fill-opacity="${la}"/>` +
        `</g>`,
    );
  }
  // A sheen along the metal: two soft highlights, as a lamp shows on gilt.
  if (style.material === 'metal') {
    defs.push(
      `<linearGradient id="sh" x1="0" y1="0" x2="1" y2="1">` +
        `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff" stop-opacity=".3"/>` +
        `<stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/>` +
        `<stop offset=".75" stop-color="#fff" stop-opacity=".22"/><stop offset=".88" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    );
    body.push(`<path d="M0 0H${S}V${S}H0Z M${SAMPLE.band} ${SAMPLE.band}V${S - SAMPLE.band}H${S - SAMPLE.band}V${SAMPLE.band}Z" fill="url(#sh)" fill-rule="evenodd"/>`);
  }
  // The mitre joints: a hairline, as a real corner shows.
  const B = SAMPLE.band;
  body.push(
    `<path d="M0 0L${B} ${B}M${S} 0L${S - B} ${B}M0 ${S}L${B} ${S - B}M${S} ${S}L${S - B} ${S - B}" stroke="#000" stroke-opacity=".18" stroke-width="1"/>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
}

/** The sample as a CSS image, for `border-image-source` and the swatches. */
export function mouldingImage(style: MouldingStyle): string {
  return `url("data:image/svg+xml,${encodeURIComponent(mouldingSvg(style))}")`;
}

/**
 * The outer side of the moulding, seen in the angled view: the material with
 * its grain running along the side, a little darker than the face.
 */
export function mouldingEdge(style: MouldingStyle): string {
  const g = grain(style);
  const [r, gr, b] = rgb(style.material === 'metal' ? '#000000' : style.dark);
  const layers = [`linear-gradient(90deg, rgba(0,0,0,.28), rgba(0,0,0,.12) 60%, rgba(0,0,0,.22))`];
  if (g) {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="600"><filter id="g" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${g.across} ${g.along}" numOctaves="3" seed="5"/>` +
      `<feColorMatrix values="0 0 0 0 ${r}  0 0 0 0 ${gr}  0 0 0 0 ${b}  0 0 0 ${g.alpha} 0"/></filter>` +
      `<rect width="100%" height="100%" filter="url(#g)"/></svg>`;
    layers.push(`url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
  }
  layers.push(`linear-gradient(${style.base}, ${style.base})`);
  return layers.join(', ');
}
