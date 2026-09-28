'use client';

import { useEffect, useRef, useState } from 'react';
import { preloadMosaic } from './MosaicLoader';
import { useRecentSearches } from './useRecentSearches';

/** What the field searches (ROADMAP 6.60): titles and authors together, or one author's books. */
export type SearchMode = 'any' | 'author';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string, mode: SearchMode) => void;
  /** The mode of the search in the address; the reader can switch it before searching. */
  mode: SearchMode;
  /** Larger, centered variant for the empty home page. */
  hero?: boolean;
}


export const POPULAR_SEARCHES = [
  { query: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { query: 'Pride and Prejudice', author: 'Jane Austen' },
  { query: '1984', author: 'George Orwell' },
  { query: "Gravity's Rainbow", author: 'Thomas Pynchon' },
  { query: 'Dune', author: 'Frank Herbert' },
  { query: 'The Hobbit', author: 'J. R. R. Tolkien' },
];

/** The two modes as chips; the labels say what the field will look in. */
const MODES: { mode: SearchMode; label: string }[] = [
  { mode: 'any', label: 'Titles & authors' },
  { mode: 'author', label: 'Author only' },
];

export default function SearchBar({ searchQuery, setSearchQuery, mode, hero }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(searchQuery);
  const [syncedQuery, setSyncedQuery] = useState(searchQuery);
  const [currentMode, setCurrentMode] = useState<SearchMode>(mode);
  const [syncedMode, setSyncedMode] = useState<SearchMode>(mode);
  if (syncedQuery !== searchQuery) {
    // Adopt the query from the URL when it changes (back button, chip click).
    setSyncedQuery(searchQuery);
    setInputValue(searchQuery);
  }
  if (syncedMode !== mode) {
    setSyncedMode(mode);
    setCurrentMode(mode);
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

  const submit = (query: string, asMode: SearchMode = currentMode) => {
    const q = query.trim();
    if (!q) return;
    setInputValue(q);
    setSearchQuery(q, asMode);
    saveRecentSearch(q);
    setShowSuggestions(false);
  };

  /*
    Switching the mode re-asks at once when a search is on screen — the reader
    wants the same words looked up the other way. On the empty home page it
    only changes what the next search will be.
  */
  const switchMode = (next: SearchMode) => {
    setCurrentMode(next);
    if (searchQuery && next !== mode && inputValue.trim()) submit(inputValue, next);
    else inputRef.current?.focus();
  };

  const filteredSuggestions = POPULAR_SEARCHES.filter(
    s => !inputValue || s.query.toLowerCase().includes(inputValue.toLowerCase()) || s.author.toLowerCase().includes(inputValue.toLowerCase()),
  ).slice(0, 4);
  const authorMode = currentMode === 'author';

  const showDropdown = showSuggestions && (recentSearches.length > 0 || filteredSuggestions.length > 0);

  return (
    <form onSubmit={e => { e.preventDefault(); submit(inputValue); }} className="w-full" role="search">
      {/*
        The list closes when focus leaves the field, its button and the list
        itself (ROADMAP 6.56): after Tab it stayed open over the pills
        below while focus was already on the result cards. Escape closes it too.
      */}
      <div
        className="relative"
        onBlur={e => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setShowSuggestions(false);
        }}
        onKeyDown={e => {
          if (e.key !== 'Escape') return;
          // Back to the field, so focus is not left on a suggestion that just vanished;
          // the close comes after the field's own onFocus, so it wins.
          inputRef.current?.focus();
          setShowSuggestions(false);
        }}
      >
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
          placeholder={authorMode ? "An author\u2019s name" : 'A title, or a title and author'}
          aria-label={authorMode ? 'Search an author' : 'Search a book title'}
          autoComplete="off"
          /*
            On a phone the hero field is set a size smaller and gives the
            button a little less room, because at 18 px the placeholder needs
            218 px and a 390 px screen left it 196 — it read "a title and
            auth" (ROADMAP 6.30, SPEC N14). 16 px is also the smallest size
            iOS does not zoom into on focus.
          */
          className={`w-full rounded-lg border border-line bg-surface pl-12 pr-24 text-ink placeholder:text-ink-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors focus:border-ink-3 focus:outline-none sm:pr-28 ${
            hero ? 'py-4 text-base sm:text-lg' : 'py-3 text-base'
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
                  // In the author mode a suggestion is the author, and the title says why she is here.
                  <button key={s.query} type="button" onClick={() => submit(authorMode ? s.author : s.query)} className="flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2">
                    <span className="text-ink">{authorMode ? s.author : s.query}</span>
                    <span className="text-sm text-ink-3">{authorMode ? s.query : s.author}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/*
        The mode chips (ROADMAP 6.60). The language pills that stood here are
        gone (Julian, 2026-09-27, PLAN-search-2026-09 §6.1): measured over 112
        cases, "English" never changed the first card, the others left one to
        three works, seven lists came back empty, and the covers a reader
        hoped for sit on the detail page's language tabs anyway. An old
        `?lang=` is still carried to the detail page as the tab to open.
      */}
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Search in">
        {MODES.map(m => (
          <button key={m.mode} type="button" className="chip" aria-pressed={currentMode === m.mode} onClick={() => switchMode(m.mode)}>
            {m.label}
          </button>
        ))}
      </div>
    </form>
  );
}
