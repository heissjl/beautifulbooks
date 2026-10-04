'use client';

import { useT } from './i18n';

/**
 * The sign that a column scrolls on (Julian, 2026-09-26, options 1 + 2): a
 * soft fading edge at the bottom of the scroll area, shown only while there
 * is more below, and on it a small "More ↓" that scrolls the column down.
 * Sticks to the bottom of its scroll container; takes no room when hidden.
 */
export default function MoreBelow({ show, onMore, lift = 0 }: { show: boolean; onMore: () => void; lift?: number }) {
  const t = useT();
  if (!show) return null;
  return (
    // `lift`: how far the scroll box reaches below the window; the hint sticks that much higher, at the window's edge.
    <div style={{ bottom: lift }} className="pointer-events-none sticky -mt-16 flex h-16 items-end justify-center bg-gradient-to-t from-bg via-bg/70 to-transparent pb-1">
      <button
        type="button"
        onClick={onMore}
        className="pointer-events-auto rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2 shadow-sm transition-colors hover:border-accent hover:text-accent"
      >
        {t('More')} <span aria-hidden="true">&darr;</span>
      </button>
    </div>
  );
}
