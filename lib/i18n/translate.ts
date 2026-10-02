/**
 * Translating one sentence (ROADMAP 6.82).
 *
 * **The English sentence is the key.** Calling `t` with "No books found" looks
 * the sentence up in the German catalogue (`de.ts`) and falls back to the
 * English. So the English stays in the component next to the reasoning that
 * worded it, the German lives in one file, and a change to the English
 * invalidates its translation by construction: the lookup misses, and
 * `lib/__tests__/i18n.test.ts` names the sentence until the catalogue is
 * updated. A stale translation cannot survive silently.
 *
 * Placeholders are `{name}`, filled from the second argument. A number is written
 * in the locale's own digits grouping (1.234 in German, 1,234 in English).
 */
import { de } from './de';
import { DEFAULT_LOCALE, intlTag, type Locale } from './locale';

export type Vars = Record<string, string | number>;

/** Translates one English sentence; `vars` fill `{name}` placeholders. */
export type Translate = (text: string, vars?: Vars) => string;

const CATALOGUES: Partial<Record<Locale, Readonly<Record<string, string>>>> = { de };

export function formatNumber(n: number, locale: Locale): string {
  return n.toLocaleString(intlTag(locale));
}

/** Fills `{name}` placeholders; a number is formatted for the locale. */
export function fill(template: string, vars: Vars | undefined, locale: Locale): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    if (value === undefined) return match;
    return typeof value === 'number' ? formatNumber(value, locale) : value;
  });
}

export function translate(locale: Locale, text: string, vars?: Vars): string {
  const table = locale === DEFAULT_LOCALE ? undefined : CATALOGUES[locale];
  return fill(table?.[text] ?? text, vars, locale);
}

/** A `t` bound to one locale. The English `t` is the identity plus placeholders. */
export function translator(locale: Locale): Translate {
  return (text, vars) => translate(locale, text, vars);
}

/** The English `t`, for code paths that have no locale yet (tests, server logs). */
export const english: Translate = translator(DEFAULT_LOCALE);
