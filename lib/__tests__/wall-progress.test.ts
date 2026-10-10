/**
 * The wall's counter line (SPEC §9.3 step 11; ROADMAP 6.71b): a running
 * count says so, the final one does not.
 */
import { describe, expect, it } from 'vitest';
import { progressLabel } from '@/components/workWall';

describe('progressLabel', () => {
  it('says "so far" while pages still come', () => {
    expect(progressLabel(254, { checked: 1100, total: 1180, done: false, truncated: null }))
      .toBe('254 covers so far, from 1,100 of 1,180 editions checked');
  });

  it('states the final numbers plainly once the walk is done', () => {
    expect(progressLabel(287, { checked: 1180, total: 1180, done: true, truncated: null })).toBe('287 covers from 1,180 editions');
    expect(progressLabel(1, { checked: 1, total: 1, done: true, truncated: null })).toBe('1 cover from 1 edition');
  });

  it('names the cap and a source that stopped', () => {
    expect(progressLabel(40, { checked: 300, total: 900, done: true, truncated: 'cap' })).toBe('40 covers from the first 300 of 900 editions');
    expect(progressLabel(40, { checked: 300, total: 900, done: true, truncated: 'error' })).toContain('stopped answering');
  });
});
