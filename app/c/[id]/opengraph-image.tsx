import SiteCard from '@/app/opengraph-image';
import { asJpeg, coverWallCard } from '@/app/og';
import { coverUrlFor } from '@/lib/coverurl';
import { isWallId } from '@/lib/walls/model';
import { wallStoreFromEnv } from '@/lib/walls/store';
import { wallsEnabled } from '@/lib/walls/switch';

/**
 * The card of a reader's shared collection (ROADMAP 6.61, 5.13a; Julian
 * 2026-09-29: „für geteilte User-Collections soll auch eine Vorschaukarte
 * kommen").
 *
 * The same wall as a collection of ours (`coverWallCard`): the reader's
 * covers in their order, their title, and the name they chose to show, if
 * any — nothing the page itself does not show, and never anything about the
 * owner beyond that name (E22). A collection Julian or reports took down,
 * an empty one, a switched-off feature or a silent store gets the site card.
 *
 * Built on request and kept an hour: a reader's collection changes while it
 * is being made, and messengers keep their own copy of a card anyway.
 */
export const revalidate = 3600;
export const alt = 'A collection of covers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

/** A reader's title as the card can hold it: two lines at most. */
function cardTitle(title: string): string {
  const t = title.trim();
  return t.length > 70 ? `${t.slice(0, 69).trimEnd()}…` : t;
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = wallsEnabled() && isWallId(id) ? wallStoreFromEnv() : null;
  const wall = store ? await store.get(id).catch(() => null) : null;
  if (!wall || wall.hiddenBy || wall.tiles.length === 0) return asJpeg(await SiteCard());

  const coverUrls = wall.tiles.map(t => coverUrlFor(`ol:${t.coverId}`, 'M')).filter((u): u is string => !!u);
  const count = `${wall.tiles.length} ${wall.tiles.length === 1 ? 'cover' : 'covers'}`;
  return coverWallCard({
    coverUrls,
    title: cardTitle(wall.title),
    facts: wall.by ? `${count}, collected by ${wall.by}` : count,
  });
}
