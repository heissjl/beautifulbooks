import type { MetadataRoute } from 'next';
import { CURATED_LIST } from '@/lib/curated';
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
    ...CURATED_LIST.map(work => ({
      url: `${SITE_URL}/book/${work.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    /*
      Only the works that actually carry a decade page (ROADMAP 5.4a): the
      threshold is 20 covers across 4 decades, and `scripts/find-decade-pages.ts`
      checked which of the curated ones clear it — 90 of 105 at 2026-09-09.
      Putting the other 15 in here would send a crawler to a 404.
    */
    ...decadePages.pages.map(page => ({
      url: `${SITE_URL}/book/${page.id}/decades`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
