/**
 * Every page has its German mirror (ROADMAP 6.85, SPEC §2.6): `proxy.ts`
 * rewrites a German reader to `app/de/<route>`, and a route without a file
 * there answers 404 to that reader only — a failure nobody sees in English.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(__dirname, '..', '..', 'app');

function pages(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (path === join(APP, 'de') || path === join(APP, 'api')) continue;
      pages(path, out);
    } else if (name === 'page.tsx' || name === 'loading.tsx') out.push(relative(APP, path));
  }
  return out;
}

describe('the German mirror tree', () => {
  it('has a file for every page and loading screen outside app/de and app/api', () => {
    const missing = pages(APP).filter(p => !existsSync(join(APP, 'de', p)));
    expect(missing, `add a mirror under app/de/ for:\n${missing.map(m => `  ${m}`).join('\n')}`).toEqual([]);
  });

  it('has no mirror without a page', () => {
    const extra = pages(join(APP, 'de')).map(p => relative('de', p)).filter(p => !p.startsWith('[...rest]') && !existsSync(join(APP, p)));
    expect(extra).toEqual([]);
  });
});
