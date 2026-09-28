'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SearchBar, { type SearchMode } from './SearchBar';

/**
 * The home page's search field, and the only part of that page that needs the
 * browser (ROADMAP 6.49).
 *
 * The page itself is a server component and reads `?q=` and `?lang=` from the
 * request, so the headline, the promise and the curated wall reach a crawler
 * as text. What cannot be done on the server is changing the address while
 * someone types, so that lives here: the field's value comes down as a prop,
 * and every change pushes a new URL — the URL stays the single source of
 * truth for the search (SPEC §3 F1.5). The author mode (ROADMAP 6.60) is
 * `?author=<name>`. There are no language pills any more (6.60, §6.1); an
 * existing `?lang=` travels on with a new search as the detail page's tab
 * wish, as the header search already does (F1.4a), and filters nothing.
 */
interface HomeSearchBarProps {
  searchQuery: string;
  mode: SearchMode;
  language: string;
  hero: boolean;
}

export default function HomeSearchBar({ searchQuery, mode, language, hero }: HomeSearchBarProps) {
  const router = useRouter();
  const navigate = useCallback((q: string, lang: string, nextMode: SearchMode) => {
    const params = new URLSearchParams();
    if (q && nextMode === 'author') params.set('author', q);
    if (q && nextMode === 'any') params.set('q', q);
    if (lang && lang !== 'all' && nextMode === 'any') params.set('lang', lang);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/', { scroll: false });
  }, [router]);

  return (
    <SearchBar
      searchQuery={searchQuery}
      setSearchQuery={(q, nextMode) => navigate(q, language, nextMode)}
      mode={mode}
      hero={hero}
    />
  );
}
