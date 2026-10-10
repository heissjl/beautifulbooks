'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translatorWith, type Catalogue, type Translate } from '@/lib/i18n/translate';

/**
 * The locale for client components (ROADMAP 6.85). `app/de/layout.tsx`
 * provides `de`; the root tree has no provider and so speaks English. Server
 * components take the locale as a prop from their page instead.
 */
const LocaleContext = createContext<{ locale: Locale; catalogue?: Catalogue }>({ locale: DEFAULT_LOCALE });

/**
 * The catalogue comes in as a prop from the server (`app/de/layout.tsx`), so
 * it is serialised once for a German reader and never bundled for an English
 * one (ROADMAP 6.104).
 */
export function LocaleProvider({ locale, catalogue, children }: { locale: Locale; catalogue?: Catalogue; children: ReactNode }) {
  const value = useMemo(() => ({ locale, catalogue }), [locale, catalogue]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/** `t` for the current locale; see lib/i18n/translate.ts for the rules. */
export function useT(): Translate {
  const { locale, catalogue } = useContext(LocaleContext);
  return useMemo(() => translatorWith(catalogue, locale), [catalogue, locale]);
}

export { rich } from './rich';
