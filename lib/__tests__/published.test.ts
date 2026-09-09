/**
 * The list the sitemap points at (ROADMAP 5.1, 5.4a).
 *
 * What matters here is not the count, which grows, but that every entry is an
 * address that can exist and has cover signatures behind it. A work in the
 * sitemap without signatures renders a decade page that folds nothing.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLISHED_WORKS, isPublished } from '../published';

describe('the works the site points at', () => {
  it('holds work ids only, in a shape a URL can carry', () => {
    expect(PUBLISHED_WORKS.length).toBeGreaterThan(0);
    expect(PUBLISHED_WORKS.every(w => /^OL\d+W$/.test(w.id))).toBe(true);
    expect(PUBLISHED_WORKS.every(w => w.title.length > 0)).toBe(true);
  });

  it('names each work once, or the sitemap would repeat an address', () => {
    const ids = PUBLISHED_WORKS.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has cover signatures for every work it publishes', () => {
    // The reason the publish list and the index list are the same file: a
    // work without signatures shows the duplicate covers of 2026-09-09.
    const index = JSON.parse(
      readFileSync(path.join(process.cwd(), 'data', 'cover-index.json'), 'utf8'),
    ) as { works: Array<[string, string, string]> };
    const indexed = new Set(index.works.map(w => w[0]));
    const missing = PUBLISHED_WORKS.filter(w => !indexed.has(w.id)).map(w => w.id);
    expect(missing).toEqual([]);
  });

  it('answers about a work it has never heard of without guessing', () => {
    expect(isPublished('OL999999999W')).toBe(false);
    expect(isPublished(PUBLISHED_WORKS[0].id)).toBe(true);
  });
});
