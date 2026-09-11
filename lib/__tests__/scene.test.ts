import { describe, expect, it } from 'vitest';
import { leadCover } from '../scene';
import { proxiedCoverSrc } from '../coverurl';

describe('leadCover', () => {
  const hero = 'https://covers.openlibrary.org/b/id/8243960-L.jpg';

  it('names the cover by id, so the tile can fly to its slot', () => {
    expect(leadCover(hero)?.id).toBe('ol:8243960');
  });

  it('keeps the very address the page already shows', () => {
    // The stage's hero renders proxiedCoverSrc(hero); the first tile must be
    // that same request, or it is a second picture and a second download.
    expect(leadCover(hero)?.url).toBe(proxiedCoverSrc(hero));
    expect(leadCover(hero)?.url).toContain('/img/');
  });

  it('keeps the size the card used, not the size the scene preloads', () => {
    expect(leadCover(hero)?.url).toMatch(/\/L\//);
  });

  it('gives nothing without a card, or for an address it cannot name', () => {
    expect(leadCover(undefined)).toBeUndefined();
    expect(leadCover('https://example.com/whatever.jpg')).toBeUndefined();
  });
});
