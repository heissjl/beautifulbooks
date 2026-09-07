'use client';

import { useState } from 'react';
import type { AvailabilityResponse } from '@/app/api/availability/route';
import type { ShopStatus } from '@/lib/availability';

interface AvailabilityCheckProps {
  isbn13: string;
  /** Reported per retailer, keyed by provider id. */
  onResult: (byProvider: Map<string, ShopStatus>) => void;
  checked: boolean;
}

/**
 * Asks each shop whether its link for this ISBN leads anywhere (SPEC §9.3
 * step 16). On demand only: it costs one request per shop, and most shops
 * would rather not be asked.
 */
export default function AvailabilityCheck({ isbn13, onResult, checked }: AvailabilityCheckProps) {
  const [state, setState] = useState<'idle' | 'checking' | 'failed'>('idle');

  if (checked) return null;

  return (
    <button
      type="button"
      className="btn mt-2 py-1.5 text-xs"
      disabled={state === 'checking'}
      onClick={() => {
        setState('checking');
        fetch(`/api/availability?isbn=${encodeURIComponent(isbn13)}`)
          .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
          .then((data: AvailabilityResponse) => {
            onResult(new Map(data.shops.map(s => [s.provider, s.status])));
            setState('idle');
          })
          .catch(() => setState('failed'));
      }}
    >
      {state === 'checking' ? 'Asking the shops…' : state === 'failed' ? 'Check failed, try again' : 'Check availability'}
    </button>
  );
}

/**
 * What each answer means, in the reader's words.
 *
 * Only `listed` carries information. `nothing` must not read as "the shop
 * does not have it": Hugendubel and genialokal do have the book and simply
 * build their results in the browser, where a server cannot see them
 * (measured 2026-09-07). Claiming absence there would be a plain lie.
 */
export const SHOP_STATUS_LABEL: Record<ShopStatus, string> = {
  listed: 'found it',
  nothing: 'can’t tell',
  blocked: 'won’t answer',
  error: 'no answer',
};

export const SHOP_STATUS_TITLE: Record<ShopStatus, string> = {
  listed: 'The shop’s page for this ISBN differs from its page for an ISBN that cannot exist, so it found something. Not a stock check.',
  nothing: 'The shop’s page for this ISBN looks exactly like its page for an ISBN that cannot exist. Either it holds nothing, or it builds its results in the browser, where a server cannot see them. Both are common, so this says nothing either way.',
  blocked: 'The shop refuses automated requests or answered with a bot check, so nothing can be said either way.',
  error: 'The shop did not answer in time.',
};
