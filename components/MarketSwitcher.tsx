'use client';

import { MARKETS, type Market } from '@/lib/market';
import { useT } from './i18n';

interface MarketSwitcherProps {
  /** Market currently in effect (chosen or detected). */
  market: Market;
  onChange: (market: Market) => void;
  compact?: boolean;
}

/** "Shop in: US · UK · DE" chips (SPEC §2.4, E9). */
export default function MarketSwitcher({ market, onChange, compact }: MarketSwitcherProps) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('Shop in')}>
      {!compact && <span className="kicker mr-1">{t('Shop in')}</span>}
      {MARKETS.map(m => (
        <button
          key={m.id}
          type="button"
          className="chip"
          aria-pressed={m.id === market}
          onClick={() => onChange(m.id)}
          title={t(m.label)}
        >
          <span aria-hidden="true">{m.flag}</span>
          {m.id.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
