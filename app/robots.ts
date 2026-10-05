import type { MetadataRoute } from 'next';
import decadePages from '@/data/decade-pages.json';
import { PUBLISHED_WORKS } from '@/lib/published';
import { robotsRules } from '@/lib/robots';
import { SITE_URL } from '@/lib/seo';

/**
 * The rules are in lib/robots.ts (ROADMAP 2.18n): the named crawlers get the
 * book pages the sitemap lists — the same two lists as app/sitemap.ts — and
 * nothing of the endless rest.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: robotsRules(PUBLISHED_WORKS.map(work => work.id), decadePages.pages.map(page => page.id)),
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
