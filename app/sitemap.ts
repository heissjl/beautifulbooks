import type { MetadataRoute } from 'next';
import { PUBLISHED_WORKS } from '@/lib/published';
import decadePages from '@/data/decade-pages.json';
import { SITE_URL } from '@/lib/seo';

/**
 * The sitemap (SPEC §10 D11, ROADMAP 5.1).
 *
 * **Every work whose cover was picked by hand**, a hundred at 2026-09-09,
 * where until then it was the eighteen of the home page — and a work page a
 * crawler is never pointed at does not exist for it. The list grows with the
 * curation; nothing is invented, because dead URLs in front of a crawler are
 * worse than a short sitemap.
 *
 * Search pages stay out on purpose: `/?q=…` is a question, not a document.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: 'yearly', priority: 0.1 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.1 },
    /*
      Every work we point at, not only the curated ones (ROADMAP 5.1): a work
      page exists for a crawler once something links to it, and nothing did
      for the works outside the curation — *Nineteen Eighty-Four* among them,
      with a full wall and a decade page nobody could find (2026-09-09).
      `PUBLISHED_WORKS` is the index list, so every entry here has cover
      signatures on disk and folds like the rest of the site.
    */
    ...PUBLISHED_WORKS.map(work => ({
      url: `${SITE_URL}/book/${work.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    /*
      Only the works that actually carry a decade page (ROADMAP 5.4a): the
      threshold is 20 covers across 4 decades, and `scripts/find-decade-pages.ts`
      measures which of the published works clear it. Putting the others in
      here would send a crawler to a 404.
    */
    ...decadePages.pages.map(page => ({
      url: `${SITE_URL}/book/${page.id}/decades`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
