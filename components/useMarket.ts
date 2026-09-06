'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { MARKET_KEY, normalizeMarket, type Market } from '@/lib/market';

const EVENT = 'market-change';

function read(): string {
  try {
    return localStorage.getItem(MARKET_KEY) ?? '';
  } catch {
    return '';
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

/**
 * The user's explicit market choice (SPEC §2.4, E9), or undefined when the
 * server should detect it from the request. Stored in localStorage for the
 * client and mirrored into a cookie so server-side requests see it too.
 */
export function useMarket(): [Market | undefined, (market: Market) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => '');
  const market = normalizeMarket(raw);
  const setMarket = useCallback((next: Market) => {
    try {
      localStorage.setItem(MARKET_KEY, next);
      document.cookie = `${MARKET_KEY}=${next}; path=/; max-age=31536000; samesite=lax`;
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // storage unavailable: the choice lasts for this page only
    }
  }, []);
  return [market, setMarket];
}
