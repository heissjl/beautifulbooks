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
 * `?author=<name>`; the ISBN mode (6.91) is `?q=<isbn>`, as a pasted ISBN
 * always was. There are no language pills any more (6.60, §6.1); an
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
    // An ISBN is asked as a pasted one always was (6.29); the page reads the mode back from its shape.
    if (q && (nextMode === 'any' || nextMode === 'isbn')) params.set('q', q);
    if (lang && lang !== 'all' && nextMode !== 'author') params.set('lang', lang);
    const qs = params.toString();
    /*
      A new search starts at the top of the page (ROADMAP 6.79). `scroll:
      false` keeps the offset the reader had, and the hero above the field
      goes away with the search, so the field slid up by the hero's height:
      measured at 1512 × 790 with the page scrolled 100 px, it ended at
      −11 to 81 px, half behind the 57 px header. At the top it sits at 89 px
      whatever the offset was. Scrolling before the push, while the hero is
      still there, means nothing moves under the reader twice.
    */
    window.scrollTo({ top: 0, behavior: 'instant' });
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
