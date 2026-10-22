/** A small body read with a ceiling (red team 2026-10-09, L3; app/api/body.ts). */
import { describe, expect, it } from 'vitest';
import { readBounded } from '@/app/api/body';

const post = (body: BodyInit | null, headers: Record<string, string> = {}) => new Request('http://localhost/api/seen', { method: 'POST', body, headers });

describe('readBounded', () => {
  it('reads a body under the ceiling, whole', async () => {
    expect(await readBounded(post('{"t":"book"}'), 1024)).toBe('{"t":"book"}');
    expect(await readBounded(post(null), 1024)).toBe('');
  });

  it('refuses a declared length over the ceiling before reading a byte', async () => {
    const request = post('x', { 'content-length': '5000' });
    expect(await readBounded(request, 1024)).toBeNull();
  });

  it('cuts off a long body at the ceiling instead of holding it', async () => {
    const long = 'a'.repeat(5000);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 5; i++) controller.enqueue(new TextEncoder().encode(long.slice(i * 1000, (i + 1) * 1000)));
        controller.close();
      },
    });
    const request = new Request('http://localhost/api/csp', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
    expect(await readBounded(request, 1024)).toBeNull();
    expect(await readBounded(post('b'.repeat(1024)), 1024)).toBe('b'.repeat(1024));
  });
});
