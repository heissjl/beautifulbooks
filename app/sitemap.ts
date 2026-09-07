import type { MetadataRoute } from 'next';
import { CURATED_WORKS } from '@/lib/curated';
import { SITE_URL } from '@/lib/seo';

/**
 * The sitemap (SPEC §10 D11).
 *
 * Only the curated works for now. §10 D11 asks for about 500; that list does
 * not exist yet, and inventing work ids would put dead URLs in front of a
 * crawler, which is worse than a short sitemap. Search pages are left out on
 * purpose: they are query results, not documents.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    ...CURATED_WORKS.map(work => ({
      url: `${SITE_URL}/book/${work.id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
