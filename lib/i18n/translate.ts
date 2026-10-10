/**
 * Translating one sentence (ROADMAP 6.85).
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
import { DEFAULT_LOCALE, intlTag, type Locale } from './locale';

/*
  No catalogue is imported here (ROADMAP 6.104, 2026-10-10). Until then this
  file imported `de` statically, and `useT()` pulled the whole German
  catalogue — 914 entries, 92.7 KB in each of two client chunks, 31.7 KB
  gzipped — into every reader's first page, English readers included. Now the
  catalogue is handed in: the server reads it from `./server`, the German
  layout passes it to the client once as a prop, and the English client bundle
  carries no German at all.
*/

export type Vars = Record<string, string | number>;

/** Translates one English sentence; `vars` fill `{name}` placeholders. */
export type Translate = (text: string, vars?: Vars) => string;

/** English sentence → translated sentence. */
export type Catalogue = Readonly<Record<string, string>>;

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

/** Translates with a given catalogue; English (or no catalogue) is the identity plus placeholders. */
export function translateWith(table: Catalogue | undefined, locale: Locale, text: string, vars?: Vars): string {
  const found = locale === DEFAULT_LOCALE ? undefined : table?.[text];
  return fill(found ?? text, vars, locale);
}

/** A `t` bound to one locale and its catalogue. */
export function translatorWith(table: Catalogue | undefined, locale: Locale): Translate {
  return (text, vars) => translateWith(table, locale, text, vars);
}

/** The English `t`, for code paths that have no locale yet (tests, server logs). */
export const english: Translate = translatorWith(undefined, DEFAULT_LOCALE);
