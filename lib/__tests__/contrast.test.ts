import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, CONTRAST_AA } from '../contrast';

/**
 * The tokens that are actually shipped, checked against WCAG AA (SPEC §5).
 *
 * This test exists because the palette failed and shipped anyway: `ink-3`
 * reached 3.28 on paper from the day it was written, and it took drawing the
 * mock-ups for ROADMAP 6.22 to notice — the passing shade is barely a step
 * darker, so no eye was going to catch it. Reading `app/globals.css` rather
 * than a copy of the values is the point: a copy would drift, and the drift
 * is exactly the failure mode.
 */
const CSS = readFileSync(join(import.meta.dirname, '..', '..', 'app', 'globals.css'), 'utf8');

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8});/g)) out[name] = value;
  return out;
}

/** The bare `:root` block: the light palette. */
function lightTokens(): Record<string, string> {
  const at = CSS.indexOf(':root {');
  return tokens(CSS.slice(at, CSS.indexOf('}', at)));
}

/** The `prefers-color-scheme: dark` block, layered over the light one. */
function darkTokens(): Record<string, string> {
  const at = CSS.indexOf('@media (prefers-color-scheme: dark)');
  return { ...lightTokens(), ...tokens(CSS.slice(at, CSS.indexOf('\n}', at))) };
}

/** The pairs that occur in the interface, and what each of them carries. */
const PAIRS: Array<[string, string, string]> = [
  ['ink', 'bg', 'headings and body text'],
  ['ink-2', 'bg', 'the verdict lead sentence'],
  ['ink-3', 'bg', 'metadata lines and verdict notes, 11-12px'],
  ['accent', 'bg', 'links and the note that explains the shop order'],
  ['on-accent', 'accent', 'the search button and the active language pill'],
  ['ink', 'surface-2', 'text on a tile'],
];

describe('the shipped palette holds WCAG AA', () => {
  for (const [mode, read] of [['light', lightTokens], ['dark', darkTokens]] as const) {
    describe(mode, () => {
      const t = read();
      it.each(PAIRS)('%s on %s — %s', (a, b) => {
        expect(t[a], `--${a} missing from globals.css`).toBeDefined();
        expect(t[b], `--${b} missing from globals.css`).toBeDefined();
        expect(contrastRatio(t[a], t[b])).toBeGreaterThanOrEqual(CONTRAST_AA);
      });
    });
  }

  it('reads real values, so the test cannot pass on an empty palette', () => {
    expect(Object.keys(lightTokens()).length).toBeGreaterThan(6);
    expect(darkTokens().bg).not.toBe(lightTokens().bg);
  });
});

describe('contrastRatio', () => {
  it('agrees with the fixed points of the definition', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    // Order does not matter; the ratio is symmetric.
    expect(contrastRatio('#945138', '#f4f0e8')).toBeCloseTo(contrastRatio('#f4f0e8', '#945138'), 10);
  });

  it('records what the old tokens scored, so the regression stays legible', () => {
    expect(contrastRatio('#8c8377', '#f4f0e8')).toBeLessThan(CONTRAST_AA);
    expect(contrastRatio('#7d7569', '#131110')).toBeLessThan(CONTRAST_AA);
    // The old accent passed, but by 0.06 — which is why softening it needed
    // to darken it as well (ROADMAP 6.22).
    expect(contrastRatio('#b1502b', '#f4f0e8')).toBeGreaterThanOrEqual(CONTRAST_AA);
    expect(contrastRatio('#b1502b', '#f4f0e8')).toBeLessThan(4.7);
    expect(contrastRatio('#945138', '#f4f0e8')).toBeGreaterThan(5.2);
  });
});
