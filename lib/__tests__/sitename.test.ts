import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SITE_NAME } from '../seo';

/**
 * The name of the site is written once, in lib/seo.ts (ROADMAP 0.5). Before
 * 2026-10-02 it stood in eight files, which is what made a rename a search.
 * This walks the website's own folders; lab/ and scripts/ are not the site.
 */
const ROOT = path.resolve(__dirname, '../..');
const NAMES = [SITE_NAME, 'Beautiful Books', 'Other Covers'];

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === '__fixtures__' ? [] : sources(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('the name of the site', () => {
  it('is written out in lib/seo.ts and nowhere else in app/, components/ and lib/', () => {
    const offenders = ['app', 'components', 'lib']
      .flatMap((dir) => sources(path.join(ROOT, dir)))
      .filter((file) => path.relative(ROOT, file) !== path.join('lib', 'seo.ts'))
      .filter((file) => {
        const text = readFileSync(file, 'utf8');
        return NAMES.some((name) => text.includes(name));
      })
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
