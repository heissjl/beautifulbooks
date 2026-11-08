/**
 * The build's check on its prerendered book pages (ROADMAP 2.18e): a page
 * without the work's JSON-LD went out without catalogue data; more than one
 * in ten of those fails the build, one stray page does not.
 */
import { describe, expect, it } from 'vitest';
// A plain .mjs script: it runs after `next build`, where tsx is not installed.
import { hasCatalogueData, verdict } from '../../scripts/check-prerender.mjs';

const withData = '<title>The covers of Dune</title><script type="application/ld+json">{"@type":"Book"}</script>';
const without = '<title>Buy Its Covers</title>';

describe('check-prerender', () => {
  it('tells a page with the work’s data from one with the site default', () => {
    expect(hasCatalogueData(withData)).toBe(true);
    expect(hasCatalogueData(without)).toBe(false);
  });

  it('lets one page in eighteen through and fails on five', () => {
    const pages = (bad: number) => Array.from({ length: 18 }, (_, i) => ({ id: `OL${i}W`, html: i < bad ? without : withData }));
    expect(verdict(pages(1))).toMatchObject({ ok: true, missing: ['OL0W'] });
    expect(verdict(pages(5)).ok).toBe(false);
    expect(verdict([]).ok).toBe(true);
  });
});
