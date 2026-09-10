'use client';

import { useEffect, useRef, useState } from 'react';
import { preloadMosaic } from './MosaicLoader';
import { useRecentSearches } from './useRecentSearches';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  language: string;
  setLanguage: (language: string) => void;
  /** Larger, centered variant for the empty home page. */
  hero?: boolean;
}

export const LANGUAGES = [
  { code: '', label: 'All languages' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
];

export const POPULAR_SEARCHES = [
  { query: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { query: 'Pride and Prejudice', author: 'Jane Austen' },
  { query: '1984', author: 'George Orwell' },
  { query: "Gravity's Rainbow", author: 'Thomas Pynchon' },
  { query: 'Dune', author: 'Frank Herbert' },
  { query: 'The Hobbit', author: 'J. R. R. Tolkien' },
];

export default function SearchBar({ searchQuery, setSearchQuery, language, setLanguage, hero }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(searchQuery);
  const [syncedQuery, setSyncedQuery] = useState(searchQuery);
  if (syncedQuery !== searchQuery) {
    // Adopt the query from the URL when it changes (back button, chip click).
    setSyncedQuery(searchQuery);
    setInputValue(searchQuery);
  }
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, saveRecentSearch] = useRecentSearches();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current && !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const submit = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setInputValue(q);
    setSearchQuery(q);
    saveRecentSearch(q);
    setShowSuggestions(false);
  };

  const filteredSuggestions = POPULAR_SEARCHES.filter(
    s => !inputValue || s.query.toLowerCase().includes(inputValue.toLowerCase()) || s.author.toLowerCase().includes(inputValue.toLowerCase()),
  ).slice(0, 4);

  const showDropdown = showSuggestions && (recentSearches.length > 0 || filteredSuggestions.length > 0);

  return (
    <form onSubmit={e => { e.preventDefault(); submit(inputValue); }} className="w-full" role="search">
      <div className="relative">
        <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value);
            /*
              The loading mosaic is fetched here, not when the search is sent:
              the file is about 90 KB and takes two to four tenths of a second
              on a phone, and that is time nobody should spend staring at an
              empty frame. Whoever never types never fetches one, and the
              second keystroke costs nothing — the promise is shared.
            */
            preloadMosaic();
          }}
          onFocus={() => setShowSuggestions(true)}
          placeholder="A title, or a title and author"
          aria-label="Search a book title"
          autoComplete="off"
          className={`w-full rounded-lg border border-line bg-surface pl-12 pr-28 text-ink placeholder:text-ink-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors focus:border-ink-3 focus:outline-none ${
            hero ? 'py-4 text-lg' : 'py-3 text-base'
          }`}
        />
        <button type="submit" className="btn btn-accent absolute right-2 top-1/2 -translate-y-1/2 py-1.5">
          Search
        </button>

        {showDropdown && (
          <div
            ref={suggestionsRef}
            className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_12px_32px_-12px_rgb(0_0_0/0.35)]"
          >
            {recentSearches.length > 0 && (
              <div className="border-b border-line py-1">
                <p className="kicker px-4 py-2">Recent</p>
                {recentSearches.map(search => (
                  <button key={search} type="button" onClick={() => submit(search)} className="flex w-full items-center gap-3 px-4 py-2 text-left text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
                    <svg className="h-4 w-4 text-ink-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {search}
                  </button>
                ))}
              </div>
            )}
            {filteredSuggestions.length > 0 && (
              <div className="py-1">
                <p className="kicker px-4 py-2">Popular</p>
                {filteredSuggestions.map(s => (
                  <button key={s.query} type="button" onClick={() => submit(s.query)} className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2">
                    <span className="text-ink">{s.query}</span>
                    <span className="text-sm text-ink-3">{s.author}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Language">
        {LANGUAGES.map(lang => (
          <button
            key={lang.code}
            type="button"
            className="chip"
            aria-pressed={(language || '') === lang.code}
            onClick={() => setLanguage(lang.code)}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </form>
  );
}
