import SiteCard from '@/app/opengraph-image';
import { asJpeg, coverWallCard } from '@/app/og';
import { allCollections, authorsShown } from '@/lib/collections';
import { liveCollectionBySlug } from '@/lib/collections-live';
import { wallCover } from '@/lib/curated';
import { SITE_URL } from '@/lib/seo';

/**
 * The card of a shared collection (ROADMAP 6.61, Julian 2026-09-29: „wir
 * brauchen noch eine Vorschaukarte für Collections").
 *
 * A wall of the collection's own covers, in its order — the first fourteen
 * that load, two rows of seven, or one row when fewer than fourteen load —
 * with the title under it. Like a work's card and unlike
 * the site card, it may show real covers: it shows the very covers the page
 * it points to shows.
 *
 * Only a published collection gets one. A draft is visible to signed-in
 * friends only, and a crawler has no cookie, so a draft's link shows the
 * site card rather than covers nobody else can open.
 *
 * **Built ahead** for every collection the file publishes (Julian,
 * 2026-09-29: „für die von uns erstellten Sammlungen kannst du die Karten ja
 * vorberechnen"): a shared link then gets a finished image and never waits
 * on Open Library, whose covers take 0.5–1.7 s each. A collection published
 * later by its switch, or whose content changes online, is built on its
 * first request and renewed once a day like the others.
 */
export const revalidate = 86400;

export function generateStaticParams() {
  return allCollections({ includeDrafts: false }).map(c => ({ slug: c.slug }));
}

export const alt = 'Covers of this collection';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await liveCollectionBySlug(slug).catch(() => null);
  // The site card as JPEG too, since this route is declared as one.
  if (!c) return asJpeg(await SiteCard());

  const coverUrls = c.works
    .filter(w => w.image || w.coverId > 0)
    .map(w => {
      const src = wallCover(w, 'M');
      // A collection's own image is a path on this site; a fetch needs the whole address.
      return src.startsWith('/') ? `${SITE_URL}${src}` : src;
    });
  const names = c.kind === 'authors' ? authorsShown(c) : [];
  const byline = names.length === 0 ? '' : names.length <= 2 ? names.join(' and ') : `${names[0]}, ${names[1]} and ${names.length - 2} more`;
  const count = `${c.works.length} ${c.works.length === 1 ? 'book' : 'books'}`;
  return coverWallCard({ coverUrls, title: c.title, facts: `${count}${byline ? ` by ${byline}` : ''}` });
}
