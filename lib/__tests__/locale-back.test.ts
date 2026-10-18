/**
 * Where the language route sends a reader back (ROADMAP 6.106): the referer
 * wins, a `back` is one plain path, and nothing the request made up becomes a
 * redirect target.
 */
import { describe, expect, it } from 'vitest';
import { backTarget, localeCookieString } from '../i18n/locale';

const ORIGIN = 'https://buyitscovers.com';

describe('backTarget', () => {
  it('prefers a same-origin referer, with its query', () => {
    expect(backTarget('https://buyitscovers.com/?q=gatsby&lang=de', '/about', ORIGIN)).toBe('/?q=gatsby&lang=de');
    expect(backTarget('https://buyitscovers.com/book/OL468431W?cover=123', null, ORIGIN)).toBe('/book/OL468431W?cover=123');
  });

  it('ignores a foreign referer and a referer that is the API itself', () => {
    expect(backTarget('https://evil.example/?q=x', '/about', ORIGIN)).toBe('/about');
    expect(backTarget('https://buyitscovers.com/api/locale/de', '/collections', ORIGIN)).toBe('/collections');
    expect(backTarget('not a url', '/about', ORIGIN)).toBe('/about');
  });

  it('takes only one plain path as back', () => {
    expect(backTarget(null, '/de/about', ORIGIN)).toBe('/de/about');
    expect(backTarget(null, '//evil.example', ORIGIN)).toBe('/');
    expect(backTarget(null, 'https://evil.example', ORIGIN)).toBe('/');
    expect(backTarget(null, '/\\evil.example', ORIGIN)).toBe('/');
    expect(backTarget(null, '/about\r\nSet-Cookie: x', ORIGIN)).toBe('/');
    expect(backTarget(null, 'about', ORIGIN)).toBe('/');
    expect(backTarget(null, null, ORIGIN)).toBe('/');
    expect(backTarget(undefined, '', ORIGIN)).toBe('/');
  });
});

describe('the locale cookie', () => {
  it('is written with one set of attributes', () => {
    expect(localeCookieString('de')).toBe('locale=de; path=/; max-age=31536000; samesite=lax');
  });
});
