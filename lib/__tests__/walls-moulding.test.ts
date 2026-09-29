import { describe, expect, it } from 'vitest';
import { mitre, mouldingSide } from '../walls/moulding';

const gold = { material: 'metal' as const, base: '#c9a13b', light: '#f7e7ad', dark: '#7d5a14' };
const oak = { material: 'wood' as const, base: '#d2ad78', light: '#e2c496', dark: '#b88d58' };

describe('moulding (5.13f)', () => {
  it('lights the top and shades the bottom', () => {
    expect(mouldingSide(gold, 'top')).toMatch(/^linear-gradient\(rgba\(255,255,255/);
    expect(mouldingSide(gold, 'bottom')).toMatch(/^linear-gradient\(rgba\(0,0,0/);
  });

  it('runs the wood grain along each piece', () => {
    // Stretched noise: low frequency along the piece, high across it.
    expect(mouldingSide(oak, 'top')).toContain("baseFrequency='0.006 0.55'");
    expect(mouldingSide(oak, 'left')).toContain("baseFrequency='0.55 0.006'");
  });

  it('mitres the corners so the pieces meet on the diagonal', () => {
    expect(mitre('top', 4, 5)).toBe('polygon(0 0, 100% 0, 96% 100%, 4% 100%)');
    expect(mitre('right', 4, 5)).toBe('polygon(0 5%, 100% 0, 100% 100%, 0 95%)');
  });
});
