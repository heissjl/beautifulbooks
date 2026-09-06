import { describe, expect, it } from 'vitest';
import { buyLinksFor } from '../buylinks';
import { isbn13to10 } from '../normalize';

describe('isbn13to10', () => {
  it('converts 978 ISBNs, including an X check digit', () => {
    expect(isbn13to10('9780684824772')).toBe('0684824779');
    expect(isbn13to10('9780141187761')).toBe('014118776X');
    expect(isbn13to10('9780804429573')).toBe('080442957X');
    expect(isbn13to10('0684824779')).toBe('0684824779');
  });
  it('has no ISBN-10 for 979 ISBNs or garbage', () => {
    expect(isbn13to10('9798472370790')).toBeUndefined();
    expect(isbn13to10('nope')).toBeUndefined();
  });
});

describe('buyLinksFor / Amazon', () => {
  it('links straight to the product page via ISBN-10, with affiliate tag when set', () => {
    const amazon = (env: Record<string, string | undefined>) => buyLinksFor({ isbn13: '9780684824772' }, env).find(l => l.provider === 'amazon')!.url;
    expect(amazon({})).toBe('https://www.amazon.com/dp/0684824779');
    expect(amazon({ AFFILIATE_AMAZON_TAG: 'bb-20' })).toBe('https://www.amazon.com/dp/0684824779?tag=bb-20');
  });
  it('falls back to a books-only search for 979 ISBNs', () => {
    const url = buyLinksFor({ isbn13: '9798472370790' }, {}).find(l => l.provider === 'amazon')!.url;
    expect(url).toBe('https://www.amazon.com/s?k=9798472370790&i=stripbooks');
  });
  it('returns no links without an ISBN', () => {
    expect(buyLinksFor({ isbn13: undefined })).toEqual([]);
  });
});
