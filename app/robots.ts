import type { MetadataRoute } from 'next';
import { robotsRules } from '@/lib/robots';
import { SITE_URL } from '@/lib/seo';

/**
 * The rules are in lib/robots.ts (ROADMAP 2.18n, 6.107): search crawlers in
 * with a pause, training crawlers and SEO tools out.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: robotsRules(),
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
