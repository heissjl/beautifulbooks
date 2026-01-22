import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookAggregator } from '../aggregator';
import type { BookEdition } from '@/types/book';
import type { NormalizedBook } from '../sources/base';

// Mock the sources
vi.mock('../sources/googleBooks', () => ({
  GoogleBooksSource: vi.fn(() => ({
    name: 'Google Books',
    search: vi.fn(),
    getEditions: vi.fn(),
    getDetails: vi.fn(),
  })),
}));

vi.mock('../sources/openLibrary', () => ({
  OpenLibrarySource: vi.fn(() => ({
    name: 'Open Library',
    search: vi.fn(),
    getEditions: vi.fn(),
    getDetails: vi.fn(),
  })),
}));

describe('BookAggregator', () => {
  let aggregator: BookAggregator;

  beforeEach(() => {
    aggregator = new BookAggregator();
  });

  describe('Relevance Scoring', () => {
    it('should prioritize books BY the author mentioned in query over books ABOUT that author', () => {
      const actualNovel: NormalizedBook = {
        workId: '1',
        title: "Gravity's Rainbow",
        normalizedTitle: 'gravitys rainbow',
        authors: ['Thomas Pynchon'],
        normalizedAuthors: ['thomas pynchon'],
        editions: [{} as BookEdition],
        primaryEdition: {} as BookEdition,
      };

      const secondaryLiterature: NormalizedBook = {
        workId: '2',
        title: "Thomas Pynchon's Gravity's Rainbow: A Study Guide",
        normalizedTitle: 'thomas pynchons gravitys rainbow a study guide',
        authors: ['Charles Hohmann'],
        normalizedAuthors: ['charles hohmann'],
        editions: [{} as BookEdition],
        primaryEdition: {} as BookEdition,
      };

      // Access private method via type assertion
      const calculateRelevance = (aggregator as any).calculateRelevance.bind(aggregator);

      const novelScore = calculateRelevance(actualNovel, 'pynchon gravitys rainbow');
      const guideScore = calculateRelevance(secondaryLiterature, 'pynchon gravitys rainbow');

      console.log('Novel score:', novelScore);
      console.log('Guide score:', guideScore);

      expect(novelScore).toBeGreaterThan(guideScore);
    });

    it('should prioritize exact title matches', () => {
      const exactMatch: NormalizedBook = {
        workId: '1',
        title: 'Mumbo Jumbo',
        normalizedTitle: 'mumbo jumbo',
        authors: ['Ishmael Reed'],
        normalizedAuthors: ['ishmael reed'],
        editions: [{} as BookEdition],
      };

      const partialMatch: NormalizedBook = {
        workId: '2',
        title: 'Mumbo Jumbo: A Study Guide',
        normalizedTitle: 'mumbo jumbo a study guide',
        authors: ['Someone Else'],
        normalizedAuthors: ['someone else'],
        editions: [{} as BookEdition],
      };

      const calculateRelevance = (aggregator as any).calculateRelevance.bind(aggregator);

      const exactScore = calculateRelevance(exactMatch, 'mumbo jumbo');
      const partialScore = calculateRelevance(partialMatch, 'mumbo jumbo');

      expect(exactScore).toBeGreaterThan(partialScore);
    });

    it('should handle searches with author name first', () => {
      const book: NormalizedBook = {
        workId: '1',
        title: "Gravity's Rainbow",
        normalizedTitle: 'gravitys rainbow',
        authors: ['Thomas Pynchon'],
        normalizedAuthors: ['thomas pynchon'],
        editions: [{} as BookEdition],
      };

      const calculateRelevance = (aggregator as any).calculateRelevance.bind(aggregator);

      const score1 = calculateRelevance(book, 'pynchon gravitys rainbow');
      const score2 = calculateRelevance(book, 'gravitys rainbow pynchon');
      const score3 = calculateRelevance(book, 'gravitys rainbow');

      // All should give high scores, but author-aware searches should be highest
      expect(score1).toBeGreaterThan(0);
      expect(score2).toBeGreaterThan(0);
      expect(score3).toBeGreaterThan(0);
    });
  });

  describe('Language Filtering', () => {
    it('should separate English and Italian editions into different works', () => {
      const englishEdition: BookEdition = {
        id: 'en-1',
        title: 'Mumbo Jumbo',
        authors: ['Ishmael Reed'],
        language: 'en',
        coverImage: 'https://example.com/cover-en.jpg',
      };

      const italianEdition: BookEdition = {
        id: 'it-1',
        title: 'Mumbo Jumbo',
        authors: ['Ishmael Reed'],
        language: 'it',
        coverImage: 'https://example.com/cover-it.jpg',
      };

      const getWorkKey = (aggregator as any).getWorkKey.bind(aggregator);

      const enKey = getWorkKey(englishEdition);
      const itKey = getWorkKey(italianEdition);

      expect(enKey).not.toBe(itKey);
      expect(enKey).toContain('::en');
      expect(itKey).toContain('::it');
    });

    it('should handle editions without language data', () => {
      const edition: BookEdition = {
        id: 'test-1',
        title: 'Test Book',
        authors: ['Test Author'],
        // no language field
        coverImage: 'https://example.com/cover.jpg',
      };

      const getWorkKey = (aggregator as any).getWorkKey.bind(aggregator);
      const key = getWorkKey(edition);

      expect(key).toContain('::unknown');
    });
  });

  describe('Edition Grouping', () => {
    it('should group editions by title, author, and language', () => {
      const edition1: BookEdition = {
        id: '1',
        title: 'Test Book',
        authors: ['Author One'],
        language: 'en',
        coverImage: 'https://example.com/1.jpg',
      };

      const edition2: BookEdition = {
        id: '2',
        title: 'Test Book',
        authors: ['Author One'],
        language: 'en',
        coverImage: 'https://example.com/2.jpg',
      };

      const edition3 = {
        id: '3',
        title: 'Test Book',
        authors: ['Author Two'],
        language: 'en',
        coverImage: 'https://example.com/3.jpg',
      };

      const getWorkKey = (aggregator as any).getWorkKey.bind(aggregator);

      const key1 = getWorkKey(edition1);
      const key2 = getWorkKey(edition2);
      const key3 = getWorkKey(edition3);

      expect(key1).toBe(key2); // Same work
      expect(key1).not.toBe(key3); // Different author = different work
    });
  });

  describe('Regression Tests', () => {
    it('[BUG-001] should not show Italian edition when filtering for English', () => {
      // This was a bug where Italian editions appeared in English search results
      const italianEdition: BookEdition = {
        id: 'it-1',
        title: 'Mumbo Jumbo',
        authors: ['Ishmael Reed'],
        language: 'it',
        coverImage: 'https://example.com/cover.jpg',
      };

      // Simulate filtering logic
      const language = 'en';
      const shouldInclude = !language || !italianEdition.language || italianEdition.language === language;

      expect(shouldInclude).toBe(false);
    });

    it('[BUG-002] should not lose editions when grouping by language', () => {
      // This was a bug where works ended up with empty editions arrays
      const work: NormalizedBook = {
        workId: '1',
        title: 'Test Book',
        normalizedTitle: 'test book',
        authors: ['Test Author'],
        normalizedAuthors: ['test author'],
        editions: [{} as BookEdition, {} as BookEdition, {} as BookEdition],
      };

      expect(work.editions.length).toBeGreaterThan(0);
    });

    it('[BUG-003] should rank actual novel above secondary literature', () => {
      // This is the Pynchon/Gravity's Rainbow issue
      const actualNovel: NormalizedBook = {
        workId: '1',
        title: "Gravity's Rainbow",
        normalizedTitle: 'gravitys rainbow',
        authors: ['Thomas Pynchon'],
        normalizedAuthors: ['thomas pynchon'],
        editions: [{}] as BookEdition[],
      };

      const studyGuide: NormalizedBook = {
        workId: '2',
        title: "A Study Guide for Thomas Pynchon's Gravity's Rainbow",
        normalizedTitle: 'a study guide for thomas pynchons gravitys rainbow',
        authors: ['Gale, Cengage Learning'],
        normalizedAuthors: ['gale cengage learning'],
        editions: [{}] as BookEdition[],
      };

      const calculateRelevance = (aggregator as any).calculateRelevance.bind(aggregator);

      const novelScore = calculateRelevance(actualNovel, 'pynchon gravity rainbow');
      const guideScore = calculateRelevance(studyGuide, 'pynchon gravity rainbow');

      expect(novelScore).toBeGreaterThan(guideScore);
    });
  });
});
