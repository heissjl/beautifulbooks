import type { Market } from '@/lib/market';

/**
 * The three market flags as inline SVG, 16 × 11 like a stamp (ROADMAP 6.110c,
 * Julian 2026-10-27: „svg flaggen"). Until then the switcher showed the emoji
 * flags, the only emoji on the site: Apple's colour pictures here, two
 * letters on Windows. These draw the same everywhere. Each is a simplified
 * flag, not the official geometry — at 16 px nothing finer would show.
 */
const FLAGS: Record<Market, React.ReactNode> = {
  us: (
    <>
      <rect width="16" height="11" fill="#fff" />
      <g fill="#b22234">
        <rect y="0" width="16" height="1" /><rect y="2" width="16" height="1" /><rect y="4" width="16" height="1" />
        <rect y="6" width="16" height="1" /><rect y="8" width="16" height="1" /><rect y="10" width="16" height="1" />
      </g>
      <rect width="7" height="6" fill="#3c3b6e" />
    </>
  ),
  uk: (
    <>
      <rect width="16" height="11" fill="#012169" />
      <path d="M0 0L16 11M16 0L0 11" stroke="#fff" strokeWidth="2" />
      <path d="M8 0V11M0 5.5H16" stroke="#fff" strokeWidth="3" />
      <path d="M8 0V11M0 5.5H16" stroke="#c8102e" strokeWidth="1.6" />
    </>
  ),
  de: (
    <>
      <rect width="16" height="3.7" fill="#000" />
      <rect y="3.7" width="16" height="3.6" fill="#dd0000" />
      <rect y="7.3" width="16" height="3.7" fill="#ffce00" />
    </>
  ),
};

export default function MarketFlag({ market }: { market: Market }) {
  return (
    <svg viewBox="0 0 16 11" width="16" height="11" className="shrink-0 rounded-[1px]" aria-hidden="true">
      {FLAGS[market]}
    </svg>
  );
}
