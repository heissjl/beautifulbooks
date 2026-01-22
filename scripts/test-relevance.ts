/**
 * Standalone test script for relevance scoring
 * Run with: npx ts-node scripts/test-relevance.ts
 */

import type { NormalizedBook } from '../lib/sources/base';
import type { BookEdition } from '../types/book';
import { normalizeTitle, normalizeAuthor } from '../lib/sources/base';

// Copy the relevance calculation logic here for testing
function calculateRelevance(book: NormalizedBook, query: string): number {
  const normalizedQuery = normalizeTitle(query);
  const queryWords = normalizedQuery.split(' ');
  let score = 0;

  // Exact title match
  if (book.normalizedTitle === normalizedQuery) {
    score += 100;
  } else if (book.normalizedTitle.startsWith(normalizedQuery)) {
    score += 50;
  } else if (book.normalizedTitle.includes(normalizedQuery)) {
    score += 25;
  }

  // Check if query contains author name - if so, strongly prefer books BY that author
  const queryContainsAuthor = book.normalizedAuthors.some(author =>
    queryWords.some(word => word.length > 3 && author.includes(word))
  );

  if (queryContainsAuthor) {
    // Big boost if the book is BY the author mentioned in the query
    score += 150;
  } else {
    // Small penalty if query mentions an author but this book is by someone else
    const queryHasAuthorWord = queryWords.some(word =>
      word.length > 3 && ['by', 'author'].every(stopWord => word !== stopWord)
    );
    if (queryHasAuthorWord && book.normalizedAuthors.length > 0) {
      score -= 50;
    }
  }

  // More editions = more popular/relevant
  score += Math.min(book.editions.length * 2, 20);

  return score;
}

// Test cases
console.log('='.repeat(80));
console.log('RELEVANCE SCORING TESTS');
console.log('='.repeat(80));

// Test 1: Pynchon Gravity's Rainbow
console.log('\n[TEST 1] Pynchon Gravity\'s Rainbow - Actual novel vs secondary literature');
console.log('-'.repeat(80));

const actualNovel: NormalizedBook = {
  workId: '1',
  title: "Gravity's Rainbow",
  normalizedTitle: normalizeTitle("Gravity's Rainbow"),
  authors: ['Thomas Pynchon'],
  normalizedAuthors: ['Thomas Pynchon'].map(normalizeAuthor),
  editions: Array(23).fill({} as BookEdition), // 23 editions
};

const studyGuide1: NormalizedBook = {
  workId: '2',
  title: "Thomas Pynchon's Gravity's rainbow",
  normalizedTitle: normalizeTitle("Thomas Pynchon's Gravity's rainbow"),
  authors: ['Hohmann, Charles', 'Charles Hohmann'],
  normalizedAuthors: ['Hohmann, Charles', 'Charles Hohmann'].map(normalizeAuthor),
  editions: Array(3).fill({} as BookEdition), // 3 editions
};

const studyGuide2: NormalizedBook = {
  workId: '3',
  title: "A Study Guide for Thomas Pynchon's \"Gravity's Rainbow\"",
  normalizedTitle: normalizeTitle("A Study Guide for Thomas Pynchon's \"Gravity's Rainbow\""),
  authors: ['Gale, Cengage Learning'],
  normalizedAuthors: ['Gale, Cengage Learning'].map(normalizeAuthor),
  editions: Array(1).fill({} as BookEdition),
};

const query1 = 'pynchon gravitys rainbow';

const novelScore = calculateRelevance(actualNovel, query1);
const guide1Score = calculateRelevance(studyGuide1, query1);
const guide2Score = calculateRelevance(studyGuide2, query1);

console.log(`Query: "${query1}"`);
console.log(`\n1. "${actualNovel.title}" by ${actualNovel.authors.join(', ')}`);
console.log(`   Score: ${novelScore} (${actualNovel.editions.length} editions)`);
console.log(`\n2. "${studyGuide1.title}" by ${studyGuide1.authors.join(', ')}`);
console.log(`   Score: ${guide1Score} (${studyGuide1.editions.length} editions)`);
console.log(`\n3. "${studyGuide2.title}" by ${studyGuide2.authors.join(', ')}`);
console.log(`   Score: ${guide2Score} (${studyGuide2.editions.length} editions)`);

console.log(`\n✓ RESULT: ${novelScore > guide1Score && novelScore > guide2Score ? 'PASS - Novel ranks highest' : 'FAIL - Secondary literature ranks higher'}`);

// Test 2: Mumbo Jumbo
console.log('\n\n[TEST 2] Mumbo Jumbo - Exact match vs partial match');
console.log('-'.repeat(80));

const mumboJumbo: NormalizedBook = {
  workId: '4',
  title: 'Mumbo Jumbo',
  normalizedTitle: normalizeTitle('Mumbo Jumbo'),
  authors: ['Ishmael Reed'],
  normalizedAuthors: ['Ishmael Reed'].map(normalizeAuthor),
  editions: Array(15).fill({} as BookEdition),
};

const mumboJumboGuide: NormalizedBook = {
  workId: '5',
  title: 'Mumbo Jumbo: A Study Guide',
  normalizedTitle: normalizeTitle('Mumbo Jumbo: A Study Guide'),
  authors: ['BookCaps'],
  normalizedAuthors: ['BookCaps'].map(normalizeAuthor),
  editions: Array(1).fill({} as BookEdition),
};

const query2 = 'mumbo jumbo';

const mumboScore = calculateRelevance(mumboJumbo, query2);
const mumboGuideScore = calculateRelevance(mumboJumboGuide, query2);

console.log(`Query: "${query2}"`);
console.log(`\n1. "${mumboJumbo.title}" by ${mumboJumbo.authors.join(', ')}`);
console.log(`   Score: ${mumboScore}`);
console.log(`\n2. "${mumboJumboGuide.title}" by ${mumboJumboGuide.authors.join(', ')}`);
console.log(`   Score: ${mumboGuideScore}`);

console.log(`\n✓ RESULT: ${mumboScore > mumboGuideScore ? 'PASS - Exact match ranks higher' : 'FAIL - Partial match ranks higher'}`);

// Summary
console.log('\n' + '='.repeat(80));
const allTestsPassed = (novelScore > guide1Score && novelScore > guide2Score) && (mumboScore > mumboGuideScore);
console.log(`OVERALL: ${allTestsPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
console.log('='.repeat(80));
