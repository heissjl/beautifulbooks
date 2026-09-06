'use client';

import { useState, useEffect, useRef } from 'react';
import { useRecentSearches } from './useRecentSearches';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  language: string;
  setLanguage: (language: string) => void;
}

const LANGUAGES = [
  { code: '', label: 'All Languages' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'zh', label: 'Chinese' },
];

// Curated suggestions with known good results
const POPULAR_SEARCHES = [
  { query: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { query: 'Pride and Prejudice', author: 'Jane Austen' },
  { query: '1984', author: 'George Orwell' },
  { query: 'To Kill a Mockingbird', author: 'Harper Lee' },
  { query: 'Dune', author: 'Frank Herbert' },
  { query: 'The Hobbit', author: 'J.R.R. Tolkien' },
];

export default function SearchBar({ searchQuery, setSearchQuery, language, setLanguage }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(searchQuery);
  const [syncedQuery, setSyncedQuery] = useState(searchQuery);
  if (syncedQuery !== searchQuery) {
    // Derived-state pattern: adopt the query from the URL when it changes.
    setSyncedQuery(searchQuery);
    setInputValue(searchQuery);
  }
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, saveRecentSearch] = useRecentSearches();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSearchQuery(inputValue);
      saveRecentSearch(inputValue);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (query: string) => {
    setInputValue(query);
    setSearchQuery(query);
    saveRecentSearch(query);
    setShowSuggestions(false);
  };

  const filteredSuggestions = POPULAR_SEARCHES.filter(
    s => !inputValue || s.query.toLowerCase().includes(inputValue.toLowerCase()) || s.author.toLowerCase().includes(inputValue.toLowerCase())
  ).slice(0, 4);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-3">
        {/* Language Filter */}
        <div className="relative">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="appearance-none h-full px-4 pr-10 text-gray-900 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition-all cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Search for books by title or author..."
            className="w-full pl-12 pr-4 py-4 text-gray-900 bg-white border border-amber-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent shadow-sm transition-all"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm font-medium"
          >
            Search
          </button>

          {/* Autocomplete Suggestions */}
          {showSuggestions && (recentSearches.length > 0 || filteredSuggestions.length > 0) && (
            <div
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-2 bg-white border border-amber-200 rounded-xl shadow-lg overflow-hidden z-20"
            >
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="border-b border-gray-100">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Recent Searches
                  </div>
                  {recentSearches.map((search, index) => (
                    <button
                      key={`recent-${index}`}
                      type="button"
                      onClick={() => handleSuggestionClick(search)}
                      className="w-full px-4 py-2 text-left hover:bg-amber-50 transition-colors flex items-center gap-2 text-gray-700"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {search}
                    </button>
                  ))}
                </div>
              )}

              {/* Popular Searches */}
              {filteredSuggestions.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Popular Books
                  </div>
                  {filteredSuggestions.map((suggestion, index) => (
                    <button
                      key={`popular-${index}`}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion.query)}
                      className="w-full px-4 py-2 text-left hover:bg-amber-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{suggestion.query}</div>
                      <div className="text-xs text-gray-500">{suggestion.author}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Suggestions */}
      <div className="mt-2 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500">Popular:</span>
        {POPULAR_SEARCHES.slice(0, 4).map((suggestion) => (
          <button
            key={suggestion.query}
            type="button"
            onClick={() => handleSuggestionClick(suggestion.query)}
            className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors"
          >
            {suggestion.query}
          </button>
        ))}
      </div>
    </form>
  );
}
