/**
 * The catalogues, for the server (ROADMAP 6.104). Server pages take `locale`
 * as a prop and call `translator(locale)` from here; the German layout hands
 * `catalogueFor('de')` to the client's `LocaleProvider` once. Client code
 * never imports this file — that is the point: the German sits in the server
 * bundle and in the German pages' props, not in every reader's JavaScript.
 */
import { de } from './de';
import { DEFAULT_LOCALE, type Locale } from './locale';
import { translateWith, translatorWith, type Catalogue, type Translate, type Vars } from './translate';

const CATALOGUES: Partial<Record<Locale, Catalogue>> = { de };

export function catalogueFor(locale: Locale): Catalogue | undefined {
  return locale === DEFAULT_LOCALE ? undefined : CATALOGUES[locale];
}

export function translate(locale: Locale, text: string, vars?: Vars): string {
  return translateWith(catalogueFor(locale), locale, text, vars);
}

/** A `t` bound to one locale. The English `t` is the identity plus placeholders. */
export function translator(locale: Locale): Translate {
  return translatorWith(catalogueFor(locale), locale);
}
