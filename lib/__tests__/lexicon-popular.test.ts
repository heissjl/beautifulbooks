import { describe, expect, it } from 'vitest';
import { searchVocabulary } from '@/lib/lexicon';
import { correctQuery } from '@/lib/spelling';

describe('the search lexicon', () => {
  it('knows the most read works, so a known title is not corrected towards a collection word', () => {
    // "pirates" came with a collection draft (2026-10-08) and is two edits from "piranesi".
    expect(searchVocabulary().counts.has('piranesi')).toBe(true);
    expect(correctQuery('piranesi', searchVocabulary())).toBeNull();
  });
});
