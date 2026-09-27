/**
 * Typo correction (ROADMAP 6.60, SPEC F1.9): the pure rules, and the word
 * list the server builds from data/ (lib/lexicon.ts).
 */
import { describe, expect, it } from 'vitest';
import type { WorkSummary } from '../model';
import { searchVocabulary } from '../lexicon';
import {
  WEAK_BEST_EDITIONS, buildVocabulary, correctQuery, correctionIsBetter, editDistance, isWeakResult,
  maxEdits, nearestWord, normalizeWord,
} from '../spelling';

const work = (editionCount: number): WorkSummary => ({
  id: `OL${editionCount}W`, title: 't', authors: ['a'], coverUrls: [], languages: [], editionCount,
});

describe('editDistance', () => {
  it('counts a swap of neighbours as one edit', () => {
    expect(editDistance('tolkein', 'tolkien')).toBe(1);
    expect(editDistance('gatbsy', 'gatsby')).toBe(1);
  });
  it('counts insertions, deletions and substitutions', () => {
    expect(editDistance('hemmingway', 'hemingway')).toBe(1);
    expect(editDistance('gatsbee', 'gatsby')).toBe(2);
    expect(editDistance('prejudise', 'prejudice')).toBe(1);
  });
  it('gives up past the limit', () => {
    expect(editDistance('dostojewski', 'dostoevsky', 2)).toBe(3);
    expect(editDistance('a', 'abcdef', 2)).toBe(3);
  });
});

describe('maxEdits', () => {
  it('leaves short words alone and allows more for long ones', () => {
    expect(maxEdits(3)).toBe(0);
    expect(maxEdits(5)).toBe(1);
    expect(maxEdits(7)).toBe(2);
  });
});

describe('normalizeWord', () => {
  it('folds case, diacritics and apostrophes', () => {
    expect(normalizeWord("Gravity's")).toBe('gravitys');
    expect(normalizeWord('Páramo')).toBe('paramo');
  });
});

describe('correctQuery', () => {
  const vocabulary = buildVocabulary([
    'The Great Gatsby', 'F. Scott Fitzgerald', 'Pride and Prejudice', 'Jane Austen',
    'The Hobbit', 'J. R. R. Tolkien', 'Harry Potter', 'Stoner',
  ]);

  it('replaces an unknown word by the nearest known one, in the sources’ spelling', () => {
    expect(correctQuery('Tolkein', vocabulary)?.to).toBe('Tolkien');
    expect(correctQuery('pride and prejudise', vocabulary)?.to).toBe('pride and prejudice');
  });

  it('keeps lower case when the reader typed lower case', () => {
    expect(correctQuery('gatsbee', vocabulary)?.to).toBe('gatsby');
    expect(correctQuery('harry poter', vocabulary)?.to).toBe('harry potter');
  });

  it('says nothing when every word is known, short, a number, or out of reach', () => {
    expect(correctQuery('the great gatsby', vocabulary)).toBeNull();
    expect(correctQuery('1984', vocabulary)).toBeNull();
    expect(correctQuery('zzzznotabook', vocabulary)).toBeNull();
    // Three letters: too many real words are one edit apart.
    expect(correctQuery('hob', vocabulary)).toBeNull();
  });

  it('prefers a candidate that keeps the first letter', () => {
    const v = buildVocabulary(['Moon', 'Noon', 'Noon', 'Noon']);
    expect(nearestWord('moom', v)).toBe('moon');
  });
});

describe('isWeakResult / correctionIsBetter', () => {
  it('calls empty and small answers weak, and a strong one not', () => {
    expect(isWeakResult([])).toBe(true);
    expect(isWeakResult([work(11)])).toBe(true);
    expect(isWeakResult([work(WEAK_BEST_EDITIONS + 1)])).toBe(false);
  });

  it('replaces an empty answer by any answer, a weak one only by a much stronger one', () => {
    expect(correctionIsBetter([], [work(3)])).toBe(true);
    expect(correctionIsBetter([work(11)], [work(481)])).toBe(true);
    expect(correctionIsBetter([work(11)], [work(40)])).toBe(false);
    expect(correctionIsBetter([work(11)], [])).toBe(false);
  });
});

describe('the lexicon (data/)', () => {
  const vocabulary = searchVocabulary();

  it('knows the words the measured typos should become', () => {
    for (const w of ['gatsby', 'prejudice', 'tolkien', 'hemingway', 'potter', 'orwell', 'hobbit']) {
      expect(vocabulary.counts.has(w), w).toBe(true);
    }
  });

  it('corrects the measured typos (docs/history.md, 2026-09-27)', () => {
    expect(correctQuery('gatsbee', vocabulary)?.to).toBe('gatsby');
    expect(correctQuery('Tolkein', vocabulary)?.to).toBe('Tolkien');
    expect(correctQuery('Hemmingway', vocabulary)?.to).toBe('Hemingway');
    expect(correctQuery('pride and prejudise', vocabulary)?.to).toBe('pride and prejudice');
    expect(correctQuery('lord of the rigns', vocabulary)?.to).toBe('lord of the rings');
  });

  it('leaves the five acceptance queries alone', () => {
    for (const q of ['mumbo jumbo', '1984', "gravity's rainbow", 'the great gatsby', 'pride and prejudice']) {
      expect(correctQuery(q, vocabulary), q).toBeNull();
    }
  });
});
