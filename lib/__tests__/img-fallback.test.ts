// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetRateLimits } from '../ratelimit';

/**
 * When archive.org drops one size of a scan, the image route serves the next
 * smaller one for a short while instead of nothing (Julian, 2026-10-06:
 * „archive fällt gerade ständig aus für die großen cover, wir brauchen einen
 * fallback auf die kleinen versionen"). No network: the cover host is a stub.
 */
const jpeg = () => new Response(new Uint8Array(2048), { status: 200, headers: { 'content-type': 'image/jpeg' } });
const down = () => new Response('Service Unavailable', { status: 503, headers: { 'content-type': 'text/html' } });

async function get(size: string, cover: string, ip: string) {
  const { GET } = await import('@/app/img/[size]/[cover]/route');
  return GET(new NextRequest(`http://localhost/img/${size}/${cover}`, { headers: { 'x-forwarded-for': ip } }), { params: Promise.resolve({ size, cover }) });
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetRateLimits();
});

describe('the cover image route', () => {
  it('serves the medium image when the large one fails, kept only an hour', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { asked.push(String(url)); return String(url).includes('-L.') ? down() : jpeg(); }));
    const res = await get('L', 'ol-420313', '10.1.0.1');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-cover-size')).toBe('M');
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(asked.map((u) => u.match(/-([LMS])\./)?.[1])).toEqual(['L', 'M']);
  });

  it('keeps the long cache when the asked size comes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jpeg()));
    const res = await get('L', 'ol-420313', '10.1.0.2');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-cover-size')).toBeNull();
    expect(res.headers.get('cache-control')).toContain(`s-maxage=${60 * 60 * 24 * 30}`);
  });

  it('answers 502, not cached, when the smaller size fails as well', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => down()));
    const res = await get('M', 'ol-13568852', '10.1.0.3');
    expect(res.status).toBe(502);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('asks a Google cover once: its sizes are widths of one image', async () => {
    const fetch = vi.fn(async () => down());
    vi.stubGlobal('fetch', fetch);
    const res = await get('L', 'gb-FxtSEQAAQBAJ', '10.1.0.4');
    expect(res.status).toBe(502);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
