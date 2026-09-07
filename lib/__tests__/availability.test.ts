/**
 * Reading a shop's answer against the control ISBN (SPEC §9.3 step 16).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAvailability, classify, CONTROL_ISBN } from '../availability';

describe('classify', () => {
  const page = (bytes: number, blocked = false) => ({ bytes, blocked });

  it('calls it a listing when the page is much bigger than the control', () => {
    expect(classify(page(96_512), page(12_373))).toBe('listed');
  });

  it('calls it nothing when the page matches the control, results being drawn in the browser', () => {
    // Hugendubel answers 245,802 bytes for a real ISBN and for an invented one.
    expect(classify(page(245_802), page(245_802))).toBe('nothing');
    expect(classify(page(245_900), page(245_802))).toBe('nothing');
  });

  it('reports a refusal or a bot check as blocked, never as an absence', () => {
    expect(classify(page(0, true), page(12_000))).toBe('blocked');
    expect(classify(page(3_781, true), page(3_781, true))).toBe('blocked');
  });

  it('reports a failure as an error rather than guessing', () => {
    expect(classify(null, page(12_000))).toBe('error');
    expect(classify(page(90_000), null)).toBe('error');
    expect(classify(page(90_000), page(0, true))).toBe('error');
  });
});

describe('checkAvailability', () => {
  const calls: string[] = [];
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('thalia')) {
        const body = url.includes(CONTROL_ISBN) ? 'x'.repeat(12_000) : 'x'.repeat(96_000);
        return new Response(body, { status: 200 });
      }
      if (url.includes('amazon')) return new Response('please solve this CAPTCHA', { status: 200 });
      if (url.includes('booklooker')) return new Response('', { status: 429 });
      return new Response('x'.repeat(50_000), { status: 200 });
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('asks every shop of the market twice: for the ISBN and for the control', async () => {
    const shops = await checkAvailability('9783499130656', 'de', { env: {} });
    expect(shops.map(s => s.provider)).toEqual(['thalia', 'genialokal', 'amazon', 'hugendubel', 'abebooks', 'booklooker']);
    expect(calls).toHaveLength(12);
    // Amazon addresses a book by its ISBN-10, so its URLs carry neither ISBN-13.
    expect(calls.filter(u => u.includes(CONTROL_ISBN))).toHaveLength(5);
    expect(calls.filter(u => u.includes('/dp/'))).toHaveLength(2);
  });

  it('separates a listing, a bot check and a refusal', async () => {
    const shops = await checkAvailability('9783499130656', 'de', { env: {} });
    const status = Object.fromEntries(shops.map(s => [s.provider, s.status]));
    expect(status.thalia).toBe('listed');
    expect(status.amazon).toBe('blocked');
    expect(status.booklooker).toBe('blocked');
    // Same size for both ISBNs: the shop renders its results in the browser.
    expect(status.hugendubel).toBe('nothing');
  });
});
