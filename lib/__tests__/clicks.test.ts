/**
 * The click redirect's URL shape (SPEC §10 C9). The route itself is thin;
 * what matters is that the shop URL never travels through the link, which is
 * what keeps it from being an open redirect.
 */
import { describe, expect, it, vi } from 'vitest';
import { buyLinksFor, trackedBuyHref } from '../buylinks';
import { recordClick } from '../clicks';

describe('trackedBuyHref', () => {
  it('carries only provider, isbn and market', () => {
    expect(trackedBuyHref('amazon', '9780141036144', 'de')).toBe('/go/amazon/9780141036144?market=de');
    // Nothing a caller passes can point the redirect at another host.
    expect(trackedBuyHref('https://evil.example', '9780141036144', 'us'))
      .toBe('/go/https%3A%2F%2Fevil.example/9780141036144?market=us');
  });

  it('names a provider the table actually has, in every market', () => {
    for (const market of ['us', 'uk', 'de'] as const) {
      const links = buyLinksFor({ isbn13: '9780141036144' }, market, {});
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(trackedBuyHref(link.provider, '9780141036144', market)).toContain(`/go/${link.provider}/`);
      }
    }
  });
});

describe('recordClick', () => {
  it('writes one line with no trace of the reader', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    recordClick({ provider: 'bookshop', market: 'us', isbn13: '9780141036144', kind: 'product' });
    expect(info).toHaveBeenCalledTimes(1);
    const line = info.mock.calls[0][0] as string;
    expect(line.startsWith('bb.click ')).toBe(true);
    const payload = JSON.parse(line.slice('bb.click '.length));
    expect(Object.keys(payload).sort()).toEqual(['at', 'isbn13', 'kind', 'market', 'provider']);
    info.mockRestore();
  });
});
