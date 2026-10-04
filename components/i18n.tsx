'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locale';
import { translator, type Translate } from '@/lib/i18n/translate';

/**
 * The locale for client components (ROADMAP 6.85). `app/de/layout.tsx`
 * provides `de`; the root tree has no provider and so speaks English. Server
 * components take the locale as a prop from their page instead.
 */
const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** `t` for the current locale; see lib/i18n/translate.ts for the rules. */
export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => translator(locale), [locale]);
}

export { rich } from './rich';
