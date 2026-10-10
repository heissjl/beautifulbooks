/**
 * The rules of the German catalogue (ROADMAP 6.85).
 *
 * The English sentence is the key, so this file is what keeps a translation
 * from going stale: it reads every `t('…')` in app/, components/ and lib/,
 * and every table whose values reach `t` through a variable, and fails on an
 * English sentence the catalogue does not know, on a German entry whose
 * English is gone, on placeholders that do not match, and on German copy
 * that claims completeness (the rule of CLAUDE.md, in German).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { fill } from '../i18n/translate';
import { translate } from '../i18n/server';
import { VERDICT_LEAD, VERDICT_MEANING } from '../verdicts';
import { SHOP_STATUS_LABEL, SHOP_STATUS_TITLE } from '@/components/AvailabilityCheck';
import { MODES } from '@/components/SearchBar';
import { TAB_LABELS } from '@/components/CollectionEditor';
import { RATE_LIMITED } from '@/app/api/rate';
import { localShopCopy, LOCAL_COUNTRIES } from '../localshops';
import { registrationPlaces } from '../normalize';
import { AREA_NAME } from '../linkplan';
import { MARKETS } from '../market';

const ROOT = join(__dirname, '..', '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__' || name === '__fixtures__' || name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

/** Every literal first argument of `t(…)`: single or double quotes, or a template literal without `${`. */
function literalKeys(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const re = /\bt\(\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`)/g;
  for (const dir of ['app', 'components', 'lib']) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(re)) {
        const raw = m[1] ?? m[2] ?? m[3];
        const key = raw.replace(/\\(['"`])/g, '$1');
        const list = found.get(key) ?? [];
        list.push(file.slice(ROOT.length + 1));
        found.set(key, list);
      }
    }
  }
  return found;
}

/** Sentences that reach `t` through a table rather than a literal. */
function tableKeys(): string[] {
  return [
    ...Object.values(VERDICT_LEAD),
    ...Object.values(VERDICT_MEANING),
    ...Object.values(SHOP_STATUS_LABEL),
    ...Object.values(SHOP_STATUS_TITLE),
    ...MODES.map(m => m.label),
    ...Object.values(TAB_LABELS),
    RATE_LIMITED,
    ...MARKETS.map(m => m.label),
    ...localShopCopy(),
    ...LOCAL_COUNTRIES.map(c => c.label),
    ...registrationPlaces(),
    ...Object.values(AREA_NAME),
  ];
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe('the German catalogue', () => {
  const literals = literalKeys();
  const wanted = new Set([...literals.keys(), ...tableKeys()]);

  it('finds the sentences in the code at all', () => {
    expect(literals.size).toBeGreaterThan(100);
  });

  it('has a German sentence for every English one the code shows', () => {
    const missing = [...wanted].filter(k => !(k in de));
    expect(missing, `missing in lib/i18n/de.ts:\n${missing.map(k => `  ${JSON.stringify(k)}  (${(literals.get(k) ?? ['table']).join(', ')})`).join('\n')}`).toEqual([]);
  });

  it('has no German sentence whose English is gone', () => {
    const orphans = Object.keys(de).filter(k => !wanted.has(k));
    expect(orphans, `no longer in the code:\n${orphans.map(k => `  ${JSON.stringify(k)}`).join('\n')}`).toEqual([]);
  });

  it('keeps every placeholder', () => {
    const broken = Object.entries(de).filter(([en, ger]) => placeholders(en).join() !== placeholders(ger).join());
    expect(broken.map(([en]) => en)).toEqual([]);
  });

  it('is never the English sentence unchanged, except for names', () => {
    // A proper name or a word that is the same in German ("Cover, {caption}", "Format") may be identical; a sentence may not be.
    const same = Object.entries(de).filter(([en, ger]) => en === ger && /\b[a-z]{2,}\b/.test(en.replace(/\{\w+\}/g, '')));
    expect(same.map(([en]) => en)).toEqual([]);
  });

  it('claims no completeness about covers or editions, in German either', () => {
    // "Alle Sprachen" names the wall's own pill and "Alle ansehen" a link; a claim is one about covers, editions or printings.
    const claims = /\b(sämtliche|vollständig\w*|komplett\w*)\b|\b(alle|jede[rsmn]?)\s+(Cover|Ausgaben?|Drucke?|Bücher)\b/i;
    const bad = Object.entries(de).filter(([, ger]) => claims.test(ger)).map(([en, ger]) => `${en} → ${ger}`);
    expect(bad).toEqual([]);
  });
});

describe('translate', () => {
  it('falls back to the English and fills placeholders in the locale', () => {
    expect(translate('en', '{n} books', { n: 1234 })).toBe('1,234 books');
    expect(translate('de', '{n} books', { n: 1234 })).toBe('1.234 Bücher');
    expect(translate('de', 'A sentence nobody translated')).toBe('A sentence nobody translated');
  });
  it('leaves an unknown placeholder alone', () => {
    expect(fill('{a} and {b}', { a: 'x' }, 'en')).toBe('x and {b}');
  });
});
