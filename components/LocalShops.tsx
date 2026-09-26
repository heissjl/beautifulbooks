'use client';

import { useCallback, useId, useSyncExternalStore } from 'react';
import {
  defaultLocalCountry,
  isLocalCountry,
  LOCAL_COUNTRIES,
  LOCAL_COUNTRY_KEY,
  LOCAL_SHOPS_COPY,
  localShopLinks,
  type LocalCountry,
  type LocalShopInput,
} from '@/lib/localshops';
import type { Market } from '@/lib/market';

const EVENT = 'local-shop-country-change';

function read(): string {
  try {
    return localStorage.getItem(LOCAL_COUNTRY_KEY) ?? '';
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
 * The reader's country for this section, remembered in localStorage only —
 * a per-viewer convenience that never reaches the server (plan 5.12 §3.4).
 * Falls back to the market's country (E9 stays untouched).
 */
function useLocalCountry(market: Market): [LocalCountry, (country: LocalCountry) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => '');
  const country = isLocalCountry(raw) ? raw : defaultLocalCountry(market);
  const set = useCallback((next: LocalCountry) => {
    try {
      localStorage.setItem(LOCAL_COUNTRY_KEY, next);
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // storage unavailable: nothing to remember the choice in
    }
  }, []);
  return [country, set];
}

/**
 * "Buy from a local bookshop" (ROADMAP 5.12): a second fold beside "Other
 * ways to find it", with deep links into national services of independent
 * bookshops. Plain links: no counting redirect (the `/go` route only knows
 * the retailer table), no fetch, no postcode.
 */
export default function LocalShops({ edition, market }: { edition: LocalShopInput; market: Market }) {
  const [country, setCountry] = useLocalCountry(market);
  const selectId = useId();
  const links = localShopLinks(country, edition);
  const anyFinder = links.some(l => l.kind === 'finder');

  return (
    <details className="group mt-4 border-t border-line pt-3">
      <summary className="cursor-pointer list-none text-sm text-ink-2 transition-colors hover:text-ink">
        <span className="mr-1 inline-block text-accent transition-transform group-open:rotate-90">▸</span>
        {LOCAL_SHOPS_COPY.summary}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-ink-2">{LOCAL_SHOPS_COPY.lead}</p>
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="kicker">{LOCAL_SHOPS_COPY.countryLabel}</label>
          <select
            id={selectId}
            value={country}
            onChange={e => { if (isLocalCountry(e.target.value)) setCountry(e.target.value); }}
            className="min-w-0 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none"
          >
            {LOCAL_COUNTRIES.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
        <ul className="space-y-3">
          {links.map(link => (
            <li key={link.id}>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="btn">
                {link.label}
                {link.kind === 'finder' && <span className="text-xs font-normal text-ink-3">finder</span>}
              </a>
              <p className="mt-1 text-xs leading-relaxed text-ink-3">{link.note}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-ink-3">
          {LOCAL_SHOPS_COPY.noStock}
          {anyFinder && <> {LOCAL_SHOPS_COPY.finderHint}</>}
        </p>
      </div>
    </details>
  );
}
