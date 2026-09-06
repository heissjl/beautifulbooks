/**
 * Purchase links generated from an edition's ISBN (SPEC §2.3, §8.3).
 *
 * Links are never stored. Affiliate parameters come from environment
 * variables; without them the neutral link is produced so the site works
 * before any affiliate program is approved.
 */
import type { BuyLink, Edition } from './model';

interface Provider {
  id: string;
  label: string;
  /** Environment variable holding the affiliate id/tag. */
  affiliateEnv?: string;
  url: (isbn13: string, affiliate: string | undefined) => string;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'bookshop',
    label: 'Bookshop.org',
    affiliateEnv: 'AFFILIATE_BOOKSHOP_ID',
    url: (isbn, aff) => (aff ? `https://bookshop.org/a/${aff}/${isbn}` : `https://bookshop.org/search?keywords=${isbn}`),
  },
  {
    id: 'amazon',
    label: 'Amazon',
    affiliateEnv: 'AFFILIATE_AMAZON_TAG',
    url: (isbn, aff) => `https://www.amazon.com/s?k=${isbn}${aff ? `&tag=${encodeURIComponent(aff)}` : ''}`,
  },
  {
    id: 'abebooks',
    label: 'AbeBooks',
    affiliateEnv: 'AFFILIATE_ABEBOOKS_ID',
    url: (isbn, aff) => `https://www.abebooks.com/servlet/SearchResults?isbn=${isbn}${aff ? `&cm_sp=${encodeURIComponent(aff)}` : ''}`,
  },
];

export function buyLinksFor(edition: Pick<Edition, 'isbn13'>, env: NodeJS.ProcessEnv = process.env): BuyLink[] {
  if (!edition.isbn13) return [];
  return PROVIDERS.map(p => ({
    provider: p.id,
    label: p.label,
    url: p.url(edition.isbn13!, p.affiliateEnv ? env[p.affiliateEnv] || undefined : undefined),
  }));
}
