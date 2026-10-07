import { describe, expect, it } from 'vitest';
import { BLUESKY_LIMIT, HASHTAG, shareTargets, withVia, shareText, THREADS_LIMIT, titleOf, X_LIMIT, X_LINK_LENGTH } from '../inspiration/share';

const link = 'https://buyitscovers.com/shelfportrait/k3x9q2ab';
const longName = 'x'.repeat(40);

describe('share texts', () => {
  it('name the owner when there is one and carry the hashtag', () => {
    expect(shareText('')).toMatch(/^My Shelf-Portrait: the books that inspire me/);
    expect(shareText('Julian')).toMatch(/^Julian’s Shelf-Portrait: the books that inspire Julian/);
    expect(shareText('Julian')).toContain(HASHTAG);
    // "Favourite covers", not "editions read" (Julian, 2026-10-05).
    expect(shareText('')).toContain('my favourite covers');
    expect(shareText('Julian')).toContain('a favourite cover');
    expect(shareText('Julian')).not.toMatch(/edition/);
  });

  it('gives the page its two lines, for the reader or for a name', () => {
    expect(titleOf('')).toBe('My Shelf-Portrait');
    expect(titleOf('Ada')).toBe('Ada’s Shelf-Portrait');
  });

  it('stay inside every platform’s limit, even with the longest name', () => {
    const text = shareText(longName);
    expect(text.length + 1 + X_LINK_LENGTH).toBeLessThanOrEqual(X_LIMIT);
    // With the longest mark a button adds (2026-10-06).
    expect(`${text} ${link}?via=bluesky`.length).toBeLessThanOrEqual(BLUESKY_LIMIT);
    expect(`${text} ${link}?via=threads`.length).toBeLessThanOrEqual(THREADS_LIMIT);
  });

  it('give every platform the link, encoded', () => {
    const targets = shareTargets(link, 'Julian');
    expect(targets.map(t => t.id)).toEqual(['x', 'threads', 'bluesky', 'whatsapp', 'telegram']);
    for (const t of targets) {
      expect(t.href).toContain(encodeURIComponent(link));
      expect(t.href.startsWith('https://')).toBe(true);
      expect(t.href).not.toContain(' ');
    }
  });

  it('mark each platform’s link with its ?via=, so the analytics can tell where a board was passed on', () => {
    for (const t of shareTargets(link, 'Julian')) expect(t.href).toContain(encodeURIComponent(`${link}?via=${t.id}`));
    expect(withVia(`${link}?x=1`, 'x')).toBe(`${link}?x=1&via=x`);
    expect(withVia('not a url', 'x')).toBe('not a url');
  });
});
