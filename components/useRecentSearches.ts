'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

const KEY = 'recentSearches';
const MAX = 5;
const EVENT = 'recent-searches-change';

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Recent searches in localStorage (SPEC §3 F1.6), hydration-safe. */
export function useRecentSearches(): [string[], (query: string) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => '[]');
  const recent = useMemo<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
    } catch {
      return [];
    }
  }, [raw]);

  const add = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    const next = [q, ...recent.filter(s => s !== q)].slice(0, MAX);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // storage unavailable: recent searches are a convenience only
    }
  }, [recent]);

  return [recent, add];
}
