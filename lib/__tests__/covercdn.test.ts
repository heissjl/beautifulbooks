/**
 * Covers through Vercel's image optimization (ROADMAP 2.18o): the addresses,
 * the retry, the hidden list, and the widths next.config.ts must allow.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../../next.config';
import {
  COVER_ORIGIN, OPTIMIZED_WIDTH, coverProxyPath, coverRoutePath, mosaicTileSrc, proxiedCoverSrc, retryCoverSrc,
} from '../coverurl';
import { isHiddenCoverUrl, setHiddenCoversForTest } from '../hiddencovers';

afterEach(() => {
  vi.unstubAllEnvs();
  setHiddenCoversForTest(null);
});

const source = (url: string) => new URLSearchParams(url.split('?').slice(1).join('?')).get('url');

describe('off (next dev, tests, COVER_CDN=off)', () => {
  it('asks our route directly, as before', () => {
    vi.stubEnv('NEXT_PUBLIC_COVER_CDN', 'off');
    expect(coverProxyPath('ol:123', 'M')).toBe('/img/M/ol-123');
    expect(proxiedCoverSrc('https://covers.openlibrary.org/b/id/123-L.jpg')).toBe('/img/L/ol-123');
  });
});

describe('on (a Vercel build)', () => {
  it('asks the optimizer for our own route, one width per size', () => {
    vi.stubEnv('NEXT_PUBLIC_COVER_CDN', 'on');
    const src = coverProxyPath('ol:123', 'M');
    expect(src.startsWith('/_next/image?')).toBe(true);
    expect(source(src)).toBe(`${COVER_ORIGIN}/img/M/ol-123`);
    expect(src).toContain(`&w=${OPTIMIZED_WIDTH.M}&q=75`);
    expect(proxiedCoverSrc('https://covers.openlibrary.org/b/id/123-S.jpg')).toContain(`w=${OPTIMIZED_WIDTH.S}`);
    expect(mosaicTileSrc('https://covers.openlibrary.org/b/id/123-L.jpg', 1)).toBe(coverProxyPath('ol:123', 'M'));
  });

  it('puts the retry marker on the source, where the optimizer keys', () => {
    vi.stubEnv('NEXT_PUBLIC_COVER_CDN', 'on');
    const retry = retryCoverSrc(coverProxyPath('gb:AbC', 'L'));
    expect(source(retry)).toBe(`${COVER_ORIGIN}/img/L/gb-AbC?retry=1`);
    expect(retry).toContain(`w=${OPTIMIZED_WIDTH.L}`);
    expect(retryCoverSrc('https://example.com/x.jpg')).toBe('https://example.com/x.jpg');
  });

  it('reads the route path back, and nothing that is not ours', () => {
    vi.stubEnv('NEXT_PUBLIC_COVER_CDN', 'on');
    expect(coverRoutePath(coverProxyPath('ol:9', 'S'))).toBe('/img/S/ol-9');
    expect(coverRoutePath('/_next/image?url=https%3A%2F%2Fevil.example%2Fimg%2FS%2Fol-9&w=128&q=75')).toBeNull();
    expect(coverRoutePath('/img/M/ol-9')).toBe('/img/M/ol-9');
  });

  it('knows a hidden cover behind an optimizer address', () => {
    vi.stubEnv('NEXT_PUBLIC_COVER_CDN', 'on');
    setHiddenCoversForTest(['ol:9']);
    expect(isHiddenCoverUrl(coverProxyPath('ol:9', 'M'))).toBe(true);
    expect(isHiddenCoverUrl(coverProxyPath('ol:10', 'M'))).toBe(false);
  });
});

describe('next.config.ts', () => {
  it('allows every width the covers ask for, and only our route as a source', () => {
    const images = nextConfig.images!;
    const allowed = new Set([...(images.imageSizes ?? []), ...(images.deviceSizes ?? [640, 750, 828, 1080, 1200, 1920, 2048, 3840])]);
    for (const width of Object.values(OPTIMIZED_WIDTH)) expect(allowed.has(width)).toBe(true);
    const host = new URL(COVER_ORIGIN).hostname;
    expect(images.remotePatterns).toEqual([{ protocol: 'https', hostname: host, pathname: '/img/**' }]);
    expect(images.minimumCacheTTL).toBeGreaterThanOrEqual(60 * 60 * 24 * 30);
  });
});
