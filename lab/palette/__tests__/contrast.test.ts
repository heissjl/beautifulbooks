import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRows, type Scheme } from '../palettes';

/**
 * The site's own tokens, read from app/globals.css, must pass every pair the
 * interface uses (SPEC §5: "jede künftige Änderung an den Tokens wird gegen
 * diese Paare gerechnet"). Added with 6.110e, when placeholders moved from
 * `ink-3` to `ink-2` because `ink-3` on `surface` reads 4.23 in the dark.
 */
const css = readFileSync(join(__dirname, '..', '..', '..', 'app', 'globals.css'), 'utf8');

function block(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

function scheme(vars: Record<string, string>): Scheme {
  return {
    bg: vars.bg, surface: vars.surface, surface2: vars['surface-2'],
    ink: vars.ink, ink2: vars['ink-2'], ink3: vars['ink-3'],
    line: vars.line, accent: vars.accent, onAccent: vars['on-accent'],
  };
}

const [lightText, darkText] = css.split('@media (prefers-color-scheme: dark)');
const light = scheme(block(lightText));
const dark = scheme(block(darkText.split('@theme')[0]));

describe('the site tokens against the pairs the interface uses', () => {
  for (const [name, s] of [['light', light], ['dark', dark]] as const) {
    it(`${name}: every pair passes its threshold`, () => {
      for (const v of Object.values(s)) expect(v).toMatch(/^#[0-9a-fA-F]{6}$/);
      const failing = contrastRows(s).filter(r => !r.passes);
      expect(failing.map(r => `${r.pair} ${r.ratio} < ${r.needs}`)).toEqual([]);
    });
  }
  it('names the placeholder pair', () => {
    expect(contrastRows(light).map(r => r.pair)).toContain('ink-2 auf surface');
  });
});
