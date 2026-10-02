'use client';

import { useEffect } from 'react';
import type { Locale } from '@/lib/i18n/locale';

/**
 * Sets `<html lang>` for the German tree. The root layout is shared by both
 * trees and prints `en`; reading the cookie there would make every page
 * dynamic, which is the one thing the proxy rewrite exists to avoid.
 */
export default function HtmlLang({ locale }: { locale: Locale }) {
  useEffect(() => {
    const before = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => { document.documentElement.lang = before; };
  }, [locale]);
  return null;
}
