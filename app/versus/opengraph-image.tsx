import { OG_SIZE, pairCard } from '@/app/og';
import { coverUrlFor } from '@/lib/coverurl';
import { POOL } from '@/lib/hotornot/game';
import { versusEnabled } from '@/lib/hotornot/switch';
import { measure } from '@/app/api/measure';

/**
 * The picture a link to the game shows (ROADMAP 6.98; Julian, 2026-10-06:
 * „baue auch eine allgemeine vorschaukarte für das versus game also /versus").
 *
 * The same card as a named pairing's (6.97), because the game is two covers
 * and a question — a wordmark would say nothing about what is behind the link.
 *
 * **One chosen pairing, not the pair of the day** (Julian, 2026-10-06: „nimm
 * vorerst die vorschaukarte von diesem matchup auch für die vorschaukarte auf
 * das spiel allgemein"): the two covers of the second campaign post, which he
 * picked by eye from a round of the game. A link that is advertised should
 * show what he chose, not what the day drew — `pairOfTheDay` in
 * `lib/hotornot/game.ts` still draws that pair and is kept for when the card
 * should turn over again. The player gets a pair of their own; the card
 * promises nothing else.
 */
export const runtime = 'nodejs';
export const revalidate = 86400;
export const alt = 'Two book covers side by side: which one would you rather look at?';
export const size = OG_SIZE;
export const contentType = 'image/jpeg';

/** The Gruffalo against Merritt's *Le visage dans l'abîme* at J'ai Lu — the pairing of `zug2-1080x1350.jpg`. */
const CARD_PAIR = ['ol:15154344', 'ol:10215294'] as const;

export default async function Image() {
  measure('og');
  const covers = versusEnabled() ? CARD_PAIR.map(id => POOL.covers.find(c => c.id === id) ?? null) : [];
  const coverUrls = covers.flatMap(c => (c ? [coverUrlFor(c.id, 'L') ?? ''] : [])).filter(Boolean);
  return pairCard({ coverUrls, line: 'Which cover would you rather look at?' });
}
