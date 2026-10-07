import { describe, expect, it } from 'vitest';
import { matchupPath, matchupSlug, parseMatchup } from '../hotornot/matchup';

describe('the address of a pairing', () => {
  it('writes both cover ids the way a share link does', () => {
    expect(matchupSlug('ol:15154344', 'ol:10215294')).toBe('ol-15154344-vs-ol-10215294');
    expect(matchupPath('ol:191075', 'ol:15163071')).toBe('/versus/ol-191075-vs-ol-15163071');
  });

  it('reads an address back', () => {
    expect(parseMatchup('ol-15154344-vs-ol-10215294')).toEqual({ a: 'ol:15154344', b: 'ol:10215294' });
  });

  it('goes there and back for a Google cover id, which carries dashes of its own', () => {
    const slug = matchupSlug('gb:aBc-1_2', 'ol:191075');
    expect(parseMatchup(slug)).toEqual({ a: 'gb:aBc-1_2', b: 'ol:191075' });
  });

  it('is not a pairing: the standings, one cover, a cover against itself, nonsense', () => {
    expect(parseMatchup('board')).toBeNull();
    expect(parseMatchup('ol-191075')).toBeNull();
    expect(parseMatchup('ol-191075-vs-ol-191075')).toBeNull();
    expect(parseMatchup('ol-191075-vs-ol-1-vs-ol-2')).toBeNull();
    expect(parseMatchup('x-vs-y')).toBeNull();
    expect(parseMatchup(undefined)).toBeNull();
  });
});
