import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

/**
 * Crawlers are welcome on the pages, not on the API (SPEC §10 D).
 *
 * `/api/` is disallowed because every call there costs an external request
 * and, on two of the routes, a slice of the Google Books quota (§8.7). The
 * pages themselves carry the same data in a form a crawler can read.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
