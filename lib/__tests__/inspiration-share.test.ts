import { describe, expect, it } from 'vitest';
import { BLUESKY_LIMIT, HASHTAG, shareTargets, shareText, THREADS_LIMIT, X_LIMIT, X_LINK_LENGTH } from '../inspiration/share';

const link = 'https://buyitscovers.com/inspiration/k3x9q2ab';
const longName = 'x'.repeat(40);

describe('share texts', () => {
  it('name the owner when there is one and carry the hashtag', () => {
    expect(shareText('')).toMatch(/^The books that inspired me/);
    expect(shareText('Julian')).toMatch(/^The books that inspired Julian/);
    expect(shareText('Julian')).toContain(HASHTAG);
  });

  it('stay inside every platform’s limit, even with the longest name', () => {
    const text = shareText(longName);
    expect(text.length + 1 + X_LINK_LENGTH).toBeLessThanOrEqual(X_LIMIT);
    expect(`${text} ${link}`.length).toBeLessThanOrEqual(BLUESKY_LIMIT);
    expect(`${text} ${link}`.length).toBeLessThanOrEqual(THREADS_LIMIT);
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
});
