import { OG_SIZE, pairCard } from '@/app/og';
import { coverUrlFor } from '@/lib/coverurl';
import { POOL } from '@/lib/hotornot/game';
import { parseMatchup } from '@/lib/hotornot/matchup';
import { versusEnabled } from '@/lib/hotornot/switch';
import { measure } from '@/app/api/measure';

/**
 * The picture a link to one pairing shows (ROADMAP 6.97): those two covers and
 * the two titles under them. The link is made to be posted, so the card has to
 * be the pairing itself — a generic card would throw away the one thing that
 * makes someone open it.
 */
export const runtime = 'nodejs';
export const revalidate = 86400;
export const alt = 'Two covers of the game, side by side';
export const size = OG_SIZE;
export const contentType = 'image/jpeg';

export default async function Image({ params }: { params: Promise<{ pair: string }> }) {
  measure('og');
  const { pair } = await params;
  const ids = parseMatchup(pair);
  const sides = !ids || !versusEnabled() ? [] : [ids.a, ids.b].map(id => POOL.covers.find(c => c.id === id) ?? null);
  const coverUrls = sides.flatMap(c => (c ? [coverUrlFor(c.id, 'L') ?? ''] : [])).filter(Boolean);
  const titles = sides.flatMap(c => (c?.title ? [c.title] : []));
  return pairCard({
    coverUrls,
    line: titles.length === 2 ? `${titles[0]} or ${titles[1]}?` : 'Which cover would you rather look at?',
  });
}
