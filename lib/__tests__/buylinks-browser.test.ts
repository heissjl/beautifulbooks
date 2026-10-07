import { describe, expect, it } from 'vitest';
import { buyLinksFor, buyLinksIn, earningNow, titleSearchLinksFor, titleSearchLinksIn } from '../buylinks';
import { MARKETS } from '../market';

/**
 * A market switch rebuilds the shop links in the browser (2026-10-06). They
 * must say what the server's links say — shop, label, kind, whether they earn
 * — in every mode; only the address may differ, because the browser has no
 * tag and nothing opens that address (clicks go through /go/).
 */
const withoutUrl = <T extends { url: string }>(links: T[]) => links.map(link => ({ ...link, url: undefined }));

const ENVS: Record<string, Record<string, string | undefined>> = {
  hobby: {},
  'hobby with tags set': { AFFILIATE_AMAZON_TAG_US: 'x-20', AFFILIATE_BOOKSHOP_ID_UK: '123' },
  'shop without tags': { NEXT_PUBLIC_SITE_MODE: 'shop' },
  'shop with some tags': { NEXT_PUBLIC_SITE_MODE: 'shop', AFFILIATE_AMAZON_TAG_US: 'x-20', AFFILIATE_BOOKSHOP_ID_UK: '123', AFFILIATE_AMAZON_TAG_DE: 'y-21' },
};

describe('shop links built in the browser', () => {
  for (const [name, env] of Object.entries(ENVS)) {
    for (const { id: market } of MARKETS) {
      it(`match the server's in ${market}, ${name}`, () => {
        const earning = earningNow(env)[market];
        for (const isbn13 of ['9780141182636', '9791234567896', undefined]) {
          expect(withoutUrl(buyLinksIn({ isbn13 }, market, earning))).toEqual(withoutUrl(buyLinksFor({ isbn13 }, market, env)));
        }
        const terms = { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' };
        expect(withoutUrl(titleSearchLinksIn(terms, market, earning))).toEqual(withoutUrl(titleSearchLinksFor(terms, market, env)));
      });
    }
  }

  it('names shops, never a tag', () => {
    const earning = earningNow(ENVS['shop with some tags']);
    expect(JSON.stringify(earning)).not.toMatch(/x-20|y-21|123/);
    expect(earning.us).toContain('amazon');
  });
});
