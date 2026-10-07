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

  it('answers 503 instead of a picture with a gap when a cover does not come at either size', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      asked.push(String(url));
      return new Response('', { status: 504 });
    }));
    const res = await poster(`${boardQuery(filled(3, 3))}&format=feed`, '10.0.0.3');
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    // Each cover was asked twice: the large image, then the medium one.
    expect(asked.filter((u) => u.includes('-L.')).length).toBe(3);
    expect(asked.filter((u) => u.includes('-M.')).length).toBe(3);
  });
});
