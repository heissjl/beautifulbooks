// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { boardQuery, emptyBoard, isFull, place, type Board } from '../inspiration/board';
import { resetRateLimits } from '../ratelimit';

/**
 * Only a full board is shared, and a story or post never carries a gap
 * (Julian, 2026-10-06, after a picture of nine places with three covers:
 * „wie kann man sicher gehen, dass so ein bug mit nur teilweiser befüllung
 * nie passiert"). These tests ask no network: a short board is refused before
 * any cover is fetched, and the cover host is a stub.
 */

const book = (n: number) => ({ workId: `OL${n}W`, coverId: `ol:${n}` });
const filled = (size: 3 | 6 | 9, count: number): Board => {
  let b = emptyBoard(size);
  for (let i = 0; i < count; i++) b = place(b, i, book(i + 1));
  return b;
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetRateLimits();
});

describe('a full board', () => {
  it('is full only when every place holds a book', () => {
    expect(isFull(filled(9, 9))).toBe(true);
    expect(isFull(filled(9, 3))).toBe(false);
    expect(isFull(filled(3, 3))).toBe(true);
    expect(isFull(emptyBoard(9))).toBe(false);
  });
});

describe('the link route', () => {
  it('gives a board with empty places no link', async () => {
    const { POST } = await import('@/app/api/inspiration/link/route');
    const res = await POST(new NextRequest('http://localhost/api/inspiration/link', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1' },
      body: JSON.stringify({ q: boardQuery(filled(9, 3)) }),
    }));
    expect(res.status).toBe(400);
  });
});

describe('the poster route', () => {
  const poster = async (q: string, ip: string) => {
    const { GET } = await import('@/app/api/inspiration/poster/route');
    return GET(new NextRequest(`http://localhost/api/inspiration/poster?${q}`, { headers: { 'x-forwarded-for': ip } }));
  };

  it('draws no story or post of a board with empty places, and asks no cover for it', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    for (const format of ['story', 'feed']) {
      const res = await poster(`${boardQuery(filled(9, 3))}&format=${format}`, '10.0.0.2');
      expect(res.status).toBe(400);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers 503 instead of a picture with a gap when a cover does not come from any source', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      asked.push(String(url));
      return new Response('', { status: 504 });
    }));
    const res = await poster(`${boardQuery(filled(3, 3))}&format=feed`, '10.0.0.3');
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    // Each cover three times: the site's own image route large and medium (the edge often holds them while
    // archive.org is down), then Open Library's medium image directly.
    expect(asked.filter((u) => u.includes('/img/L/')).length).toBe(3);
    expect(asked.filter((u) => u.includes('/img/M/')).length).toBe(3);
    expect(asked.filter((u) => u.includes('covers.openlibrary.org') && u.includes('-M.')).length).toBe(3);
    expect(asked.some((u) => u.includes('covers.openlibrary.org') && u.includes('-L.'))).toBe(false);
  });
});

describe('the poster route, with archive.org down', () => {
  it('draws the picture from the site\'s own image route when Open Library fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/img/M/')) {
        const { default: sharp } = await import('sharp');
        // Noise, not one colour: a flat image compresses below the 1 KB that marks Open Library's empty answer.
        const pixels = Buffer.from(Array.from({ length: 180 * 270 * 3 }, (_, i) => (i * 7919) % 251));
        const png = await sharp(pixels, { raw: { width: 180, height: 270, channels: 3 } }).jpeg().toBuffer();
        return new Response(new Uint8Array(png), { status: 200, headers: { 'content-type': 'image/jpeg' } });
      }
      return new Response('', { status: 503 });
    }));
    const { GET } = await import('@/app/api/inspiration/poster/route');
    const res = await GET(new NextRequest(`http://localhost/api/inspiration/poster?${boardQuery(filled(3, 3))}&format=feed&look=plain`, { headers: { 'x-forwarded-for': '10.0.0.4' } }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
  }, 30000);
});
