/** What the sitemap offers (ROADMAP 6.107, lib/sitemapplan.ts). */
import { describe, expect, it } from 'vitest';
import { DECADE_MIN_COVERS, decadePagesToOffer, lastGrown } from '../sitemapplan';

describe('lastGrown', () => {
  it('is the newest added date, never today', () => {
    expect(lastGrown(['2026-09-26', undefined, '2026-10-02T10:00:00Z', '2026-09-30'])).toBe('2026-10-02');
    expect(lastGrown([undefined, 'not a date'])).toBeUndefined();
  });
});

describe('decadePagesToOffer', () => {
  it('offers a decade page only for a work in a published collection with enough covers', () => {
    const pages = [
      { id: 'OL1W', coverCount: DECADE_MIN_COVERS },
      { id: 'OL2W', coverCount: DECADE_MIN_COVERS - 1 },
      { id: 'OL3W', coverCount: 300 },
    ];
    expect(decadePagesToOffer(pages, new Set(['OL1W', 'OL2W'])).map(p => p.id)).toEqual(['OL1W']);
  });
});
