import { OG_SIZE, pairCard } from '@/app/og';
import { coverUrlFor } from '@/lib/coverurl';
import { pairOfTheDay } from '@/lib/hotornot/game';
import { versusEnabled } from '@/lib/hotornot/switch';
import { measure } from '@/app/api/measure';

/**
 * The picture a link to the game shows (ROADMAP 6.98; Julian, 2026-10-06:
 * „baue auch eine allgemeine vorschaukarte für das versus game").
 *
 * The same card as a named pairing's (6.97), because the game is two covers
 * and a question — a wordmark would say nothing about what is behind the
 * link. The pair is drawn from the pool with the day as the seed, so the
 * picture holds for the day it is cached and the same address looks new in a
 * feed tomorrow. It is not the pair the player then gets: that one is drawn
 * when the page loads, and the card never promises otherwise.
 */
export const runtime = 'nodejs';
export const revalidate = 86400;
export const alt = 'Two book covers side by side: which one would you rather look at?';
export const size = OG_SIZE;
export const contentType = 'image/jpeg';

export default async function Image() {
  measure('og');
  const pair = versusEnabled() ? pairOfTheDay() : null;
  const coverUrls = pair ? [pair.a, pair.b].flatMap(c => [coverUrlFor(c.id, 'L') ?? '']).filter(Boolean) : [];
  return pairCard({ coverUrls, line: 'Which cover would you rather look at?' });
}
