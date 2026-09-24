'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SearchBar from './SearchBar';

/**
 * The home page's search field, and the only part of that page that needs the
 * browser (ROADMAP 6.49).
 *
 * The page itself is a server component and reads `?q=` and `?lang=` from the
 * request, so the headline, the promise and the curated wall reach a crawler
 * as text. What cannot be done on the server is changing the address while
 * someone types, so that lives here: the field's value comes down as a prop,
 * and every change pushes a new URL — the URL stays the single source of
 * truth for the search (SPEC §3 F1.5).
 */
interface HomeSearchBarProps {
  searchQuery: string;
  language: string;
  hero: boolean;
}

export default function HomeSearchBar({ searchQuery, language, hero }: HomeSearchBarProps) {
  const router = useRouter();
  const navigate = useCallback((q: string, lang: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (lang && lang !== 'all') params.set('lang', lang);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/', { scroll: false });
  }, [router]);

  return (
    <SearchBar
      searchQuery={searchQuery}
      setSearchQuery={q => navigate(q, language)}
      language={language}
      setLanguage={lang => navigate(searchQuery, lang)}
      hero={hero}
    />
  );
}
