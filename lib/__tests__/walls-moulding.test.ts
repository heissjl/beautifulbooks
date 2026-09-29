import { describe, expect, it } from 'vitest';
import { mouldingEdge, mouldingImage, mouldingSvg, SAMPLE } from '../walls/moulding';

const gold = { material: 'metal' as const, base: '#c49a3a', light: '#f8e7a8', dark: '#7a5616' };
const oak = { material: 'wood' as const, base: '#c99c64', light: '#ddb987', dark: '#a97c48' };
const black = { material: 'paint' as const, base: '#1f1c1a', light: '#3a3532', dark: '#0f0d0c' };

describe('moulding sample (5.13f, border-image)', () => {
  it('draws four mitred pieces, each lit from the top left', () => {
    const svg = mouldingSvg(gold);
    for (const side of ['top', 'right', 'bottom', 'left']) expect(svg).toContain(`<clipPath id="c${side}">`);
    expect(svg).toContain(`points="0,0 ${SAMPLE.size},0 ${SAMPLE.size - SAMPLE.band},${SAMPLE.band} ${SAMPLE.band},${SAMPLE.band}"`);
    expect(svg).toMatch(/clip-path="url\(#ctop\)">.*fill="#ffffff" fill-opacity="0.16"/);
    expect(svg).toMatch(/clip-path="url\(#cbottom\)">.*fill="#000000" fill-opacity="0.24"/);
  });

  it('runs the grain along each piece, in the wood’s own dark and in sRGB', () => {
    const svg = mouldingSvg(oak);
    expect(svg).toContain('baseFrequency="0.012 0.45"');
    expect(svg).toContain('baseFrequency="0.45 0.012"');
    expect(svg).toContain('color-interpolation-filters="sRGB"');
    expect(svg).toContain('0 0 0 0 0.663');
  });

  it('paints a painted frame without grain', () => {
    expect(mouldingSvg(black)).not.toContain('feTurbulence');
  });

  it('is a CSS image with nothing left unescaped', () => {
    const css = mouldingImage(oak);
    expect(css.startsWith('url("data:image/svg+xml,')).toBe(true);
    // A raw "#" would end the data URL at the first colour or url(#…).
    expect(css).not.toContain('#');
    expect(mouldingEdge(oak)).toContain(oak.base);
  });
});
