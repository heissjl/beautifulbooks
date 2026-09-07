/**
 * Markets (SPEC §2.4, decision E9). A market decides which retailers are
 * offered, in which order, on which Amazon domain and with which affiliate
 * tag. The UI language stays English regardless of market.
 */
export type Market = 'us' | 'uk' | 'de';

export const MARKETS: ReadonlyArray<{ id: Market; label: string; flag: string }> = [
  { id: 'us', label: 'United States', flag: '🇺🇸' },
  { id: 'uk', label: 'United Kingdom', flag: '🇬🇧' },
  { id: 'de', label: 'Germany', flag: '🇩🇪' },
];

export const DEFAULT_MARKET: Market = 'us';

/** Cookie and localStorage key for the user's explicit choice. */
export const MARKET_KEY = 'market';

export function isMarket(value: unknown): value is Market {
  return value === 'us' || value === 'uk' || value === 'de';
}

export function normalizeMarket(raw: string | null | undefined): Market | undefined {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'gb') return 'uk';
  return isMarket(v) ? v : undefined;
}

const COUNTRY_TO_MARKET: Record<string, Market> = {
  US: 'us', CA: 'us',
  GB: 'uk', IE: 'uk',
  DE: 'de', AT: 'de', CH: 'de',
};

export interface MarketSignals {
  /** Explicit choice: query parameter or cookie value. */
  explicit?: string | null;
  /** ISO 3166-1 alpha-2 from the hosting platform (Vercel: `x-vercel-ip-country`). */
  country?: string | null;
  /** `Accept-Language` header. */
  acceptLanguage?: string | null;
}

/**
 * Explicit choice wins, then the request's country, then the browser
 * language, then the default (US). Never throws.
 */
export function detectMarket({ explicit, country, acceptLanguage }: MarketSignals): Market {
  const chosen = normalizeMarket(explicit);
  if (chosen) return chosen;

  const byCountry = COUNTRY_TO_MARKET[(country ?? '').toUpperCase()];
  if (byCountry) return byCountry;

  const first = (acceptLanguage ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  if (first.startsWith('de')) return 'de';
  if (first === 'en-gb' || first === 'en-ie') return 'uk';

  return DEFAULT_MARKET;
}

/** Parses one cookie out of a raw `Cookie` header. */
export function cookieValue(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
