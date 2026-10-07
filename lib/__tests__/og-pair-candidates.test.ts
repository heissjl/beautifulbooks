import { describe, expect, it } from 'vitest';
import { pairCoverCandidates } from '@/app/og';

describe('pairCoverCandidates', () => {
  it('tries the site’s own image route, L then M, before Open Library directly', () => {
    expect(pairCoverCandidates('ol:191075', 'https://example.test')).toEqual([
      'https://example.test/img/L/ol-191075',
      'https://example.test/img/M/ol-191075',
      'https://covers.openlibrary.org/b/id/191075-M.jpg',
    ]);
  });
});
