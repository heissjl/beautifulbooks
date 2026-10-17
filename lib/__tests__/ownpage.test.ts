/** Google only for the site's own pages (ROADMAP 2.18f, lib/ownpage.ts). */
import { describe, expect, it } from 'vitest';
import { askedFromOwnPage } from '../ownpage';

const bag = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null });

describe('askedFromOwnPage', () => {
  it('is true only for a same-origin fetch', () => {
    expect(askedFromOwnPage(bag({ 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(askedFromOwnPage(bag({ 'sec-fetch-site': 'Same-Origin' }))).toBe(true);
  });
  it('is false for a script, a direct visit or another site', () => {
    expect(askedFromOwnPage(bag({}))).toBe(false);
    expect(askedFromOwnPage(bag({ 'sec-fetch-site': 'none' }))).toBe(false);
    expect(askedFromOwnPage(bag({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(askedFromOwnPage(bag({ 'sec-fetch-site': 'same-site' }))).toBe(false);
  });
});
