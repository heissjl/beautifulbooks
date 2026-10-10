import HtmlLang from '@/components/HtmlLang';
import { LocaleProvider } from '@/components/i18n';
import { catalogueFor } from '@/lib/i18n/server';

/**
 * The German tree (ROADMAP 6.85, SPEC E23). Nothing under `app/de/` is a page
 * of its own: each file renders the English route's module with `locale="de"`,
 * and this layout gives the client components the same locale. `proxy.ts`
 * rewrites here for a reader whose cookie says `de`; the address never shows
 * the prefix. Segment configs (`revalidate`, `dynamic`) are repeated in each
 * mirror because Next reads them from the file, not from a re-export.
 */
export default function GermanLayout({ children }: { children: React.ReactNode }) {
  return (
    // The catalogue travels as a prop, once, only here (6.104).
    <LocaleProvider locale="de" catalogue={catalogueFor('de')}>
      <HtmlLang locale="de" />
      {children}
    </LocaleProvider>
  );
}
