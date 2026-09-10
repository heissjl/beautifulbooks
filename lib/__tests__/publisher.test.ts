/**
 * The publisher as a search term (ROADMAP 1.11, Julian 2026-09-10).
 *
 * Every string below is one Open Library actually handed over in the
 * fixtures; none of them is invented for the test.
 */
import { describe, expect, it } from 'vitest';
import { searchablePublisher } from '../normalize';

describe('a publisher that would only narrow the search', () => {
  it('drops the self-publishing platforms', () => {
    // 231 of 581 mentions in the fixtures, 40 %. The name says which platform
    // printed it, not who published it, and it buries every real result.
    for (const raw of [
      'Independently Published',
      'independently published',
      'CreateSpace Independent Publishing Platform',
      'Createspace Independent Publishing Platform',
      'Lulu Press, Inc.',
      'Lulu.com',
      'Books on Demand GmbH',
    ]) {
      expect(searchablePublisher(raw)).toBeUndefined();
    }
  });

  it('has nothing to say about an empty field', () => {
    expect(searchablePublisher(undefined)).toBeUndefined();
    expect(searchablePublisher('   ')).toBeUndefined();
  });
});

describe('spellings that mean the same house', () => {
  it('sheds a legal form', () => {
    expect(searchablePublisher('Penguin Books, Limited')).toBe('Penguin Books');
    expect(searchablePublisher('Pan Books Ltd')).toBe('Pan Books');
    expect(searchablePublisher('Allison & Busby LTD')).toBe('Allison & Busby');
    expect(searchablePublisher('Audio Book Contractors, LLC')).toBe('Audio Book Contractors');
    expect(searchablePublisher('Diogenes Verlag AG')).toBe('Diogenes Verlag');
  });

  it('sheds a word for the trade, and both at once', () => {
    expect(searchablePublisher('Arcturus Publishing')).toBe('Arcturus');
    expect(searchablePublisher('HarperCollins Publishers Limited')).toBe('HarperCollins');
    expect(searchablePublisher('Dover Publications, Incorporated')).toBe('Dover');
    expect(searchablePublisher('Penguin Publishing Group')).toBe('Penguin');
  });

  it('sheds a parenthetical', () => {
    expect(searchablePublisher('Penguin (Non-Classics)')).toBe('Penguin');
    expect(searchablePublisher('Random House Inc (T)')).toBe('Random House');
  });
});

describe('what must survive untouched', () => {
  it('keeps a word that is part of the name', () => {
    // Trimming these would ask about a house that does not exist.
    expect(searchablePublisher('Viking Press')).toBe('Viking Press');
    expect(searchablePublisher('Bantam Books')).toBe('Bantam Books');
    expect(searchablePublisher('FISCHER Taschenbuch')).toBe('FISCHER Taschenbuch');
    expect(searchablePublisher('Editores Mexicanos Unidos')).toBe('Editores Mexicanos Unidos');
    expect(searchablePublisher('Fine Editions Press')).toBe('Fine Editions Press');
  });

  it('never returns an empty string, which would search for nothing', () => {
    for (const raw of ['Publishing', 'Ltd', ', Inc.']) {
      const out = searchablePublisher(raw);
      expect(out === undefined || out.length > 0).toBe(true);
    }
  });
});
