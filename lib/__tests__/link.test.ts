import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every link of the site goes through components/Link.tsx, which turns
 * Next's viewport prefetching off (ROADMAP 2.18a). A file that imports
 * `next/link` itself brings it back for its links: on 2026-10-05 that was 14
 * book pages rendered for one visit that opened none of them.
 */
const ROOT = path.resolve(__dirname, '../..');
const WRAPPER = path.join('components', 'Link.tsx');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === '__fixtures__' ? [] : sources(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe('links', () => {
  it('import next/link in components/Link.tsx and nowhere else in app/ and components/', () => {
    const offenders = ['app', 'components']
      .flatMap((dir) => sources(path.join(ROOT, dir)))
      .filter((file) => path.relative(ROOT, file) !== WRAPPER)
      .filter((file) => /from ['"]next\/link['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it('do not prefetch unless a caller asks', () => {
    const wrapper = readFileSync(path.join(ROOT, WRAPPER), 'utf8');
    expect(wrapper).toMatch(/<NextLink prefetch=\{false\} \{\.\.\.props\} \/>/);
  });
});
