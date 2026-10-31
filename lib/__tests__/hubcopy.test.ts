/** The hub's own text (ROADMAP 6.107 Teil A, lib/hubcopy.ts). */
import { describe, expect, it } from 'vitest';
import { HUB_GROUPS } from '../collections';
import { GROUP_HEADING, GROUP_TEXT, groupHeading, groupText } from '../hubcopy';
import { translator } from '../i18n/server';

describe('the hub copy', () => {
  it('has a heading and three sentences for each group, and claims nothing about completeness', () => {
    for (const group of HUB_GROUPS) {
      expect(GROUP_HEADING[group]).toMatch(/\S/);
      expect(GROUP_TEXT[group]).toHaveLength(3);
      for (const sentence of GROUP_TEXT[group]) {
        expect(sentence).toMatch(/[.!?]$/);
        expect(sentence).not.toMatch(/\b(all|every|complete|whole)\b/i);
      }
    }
  });

  it('speaks German through the translator', () => {
    const t = translator('de');
    expect(groupHeading('lists', t)).toBe('Preise und Listen');
    expect(groupText('series', t)[0]).toMatch(/Verlagsreihe/);
    expect(groupText('series')[0]).toMatch(/^A publisher/);
  });
});
