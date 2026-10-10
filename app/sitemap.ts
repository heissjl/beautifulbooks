import type { MetadataRoute } from 'next';
import decadePages from '@/data/decade-pages.json';
import { SITE_URL } from '@/lib/seo';
import { liveCollections, liveRecords } from '@/lib/collections-live';
import { decadePagesToOffer, lastGrown } from '@/lib/sitemapplan';
import { inspirationEnabled } from '@/lib/inspiration/switch';

/**
 * The sitemap (SPEC §10 D11, ROADMAP 5.1).
 *
 * **Since 2026-10-10 the collections and some decade pages, no book pages**
 * (ROADMAP 6.107, lib/sitemapplan.ts says why). Until then it listed every
 * index work (500) and every decade page (322), each dated "now".
 *
 * Search pages stay out on purpose: `/?q=…` is a question, not a document.
 */
/** Hourly, so a collection published from /curate reaches the sitemap without a deploy (5.10g). */
export const revalidate = 3600;

/** When the text of the About page last changed; move it with the text (a date a crawler can trust, 6.107). */
const ABOUT_UPDATED = '2026-10-09';
/** When the Shelf-Portrait editor's page last changed. */
const SHELFPORTRAIT_UPDATED = '2026-10-06';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const published = (await liveCollections({ includeDrafts: false })).filter(c => c.published);
  // The picks with their dates live in the records; the published switches in the parsed collections.
  const records = new Map((await liveRecords()).map(r => [r.slug, r]));
  const grown = new Map(published.map(c => [c.slug, lastGrown(records.get(c.slug)?.works.map(w => w.addedAt) ?? [])]));
  const newest = [...grown.values()].filter((d): d is string => !!d).sort().at(-1);
  const inCollections = new Set(published.flatMap(c => c.works.map(w => w.id)));

  const collections = published.length
    ? [
        { url: `${SITE_URL}/collections`, ...(newest ? { lastModified: newest } : {}) },
        ...published.map(c => {
          const day = grown.get(c.slug);
          return { url: `${SITE_URL}/collections/${c.slug}`, ...(day ? { lastModified: day } : {}) };
        }),
      ]
    : [];
  /*
    Decade pages: the work is in a published collection and has enough covers
    for the page to say something (`DECADE_MIN_COVERS`). Dated by the decade
    index's build, which is when their content was last measured.
  */
  const decades = decadePagesToOffer(decadePages.pages, inCollections).map(page => ({
    url: `${SITE_URL}/book/${page.id}/decades`,
    lastModified: decadePages.builtAt.slice(0, 10),
  }));

  // No changeFrequency, no priority: both engines ignore them (Google, Bing, 2025–2026).
  return [
    { url: SITE_URL, ...(newest ? { lastModified: newest } : {}) },
    { url: `${SITE_URL}/about`, lastModified: ABOUT_UPDATED },
    ...collections,
    ...decades,
    /*
      The Shelf-Portrait's editor, where it is switched on (ROADMAP 5.18b, indexed since 2026-10-06).
      Shared boards stay out and `noindex`: a grid of covers without words is thin, and there is no end to them.
    */
    ...(inspirationEnabled() ? [{ url: `${SITE_URL}/shelfportrait`, lastModified: SHELFPORTRAIT_UPDATED }] : []),
  ];
}
