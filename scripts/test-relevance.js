/**
 * Standalone test script for relevance scoring
 * Run with: node scripts/test-relevance.js
 */

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAuthor(author) {
  return author
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
}

function calculateRelevance(book, query) {
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

  // Check if query contains author name
  const queryContainsAuthor = book.normalizedAuthors.some(author =>
    queryWords.some(word => word.length > 3 && author.includes(word))
  );

  if (queryContainsAuthor) {
    score += 150;
  } else {
    const queryHasAuthorWord = queryWords.some(word =>
      word.length > 3 && ['by', 'author'].every(stopWord => word !== stopWord)
    );
    if (queryHasAuthorWord && book.normalizedAuthors.length > 0) {
      score -= 50;
    }
  }

  // More editions = more popular
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

const actualNovel = {
  workId: '1',
  title: "Gravity's Rainbow",
  normalizedTitle: normalizeTitle("Gravity's Rainbow"),
  authors: ['Thomas Pynchon'],
  normalizedAuthors: ['Thomas Pynchon'].map(normalizeAuthor),
  editions: Array(23).fill({}),
};

const studyGuide1 = {
  workId: '2',
  title: "Thomas Pynchon's Gravity's rainbow",
  normalizedTitle: normalizeTitle("Thomas Pynchon's Gravity's rainbow"),
  authors: ['Hohmann, Charles', 'Charles Hohmann'],
  normalizedAuthors: ['Hohmann, Charles', 'Charles Hohmann'].map(normalizeAuthor),
  editions: Array(3).fill({}),
};

const studyGuide2 = {
  workId: '3',
  title: "A Study Guide for Thomas Pynchon's \"Gravity's Rainbow\"",
  normalizedTitle: normalizeTitle("A Study Guide for Thomas Pynchon's \"Gravity's Rainbow\""),
  authors: ['Gale, Cengage Learning'],
  normalizedAuthors: ['Gale, Cengage Learning'].map(normalizeAuthor),
  editions: Array(1).fill({}),
};

const query1 = 'pynchon gravitys rainbow';

const novelScore = calculateRelevance(actualNovel, query1);
const guide1Score = calculateRelevance(studyGuide1, query1);
const guide2Score = calculateRelevance(studyGuide2, query1);

console.log(`Query: "${query1}"`);
console.log(`\n1. "${actualNovel.title}" by ${actualNovel.authors.join(', ')}`);
console.log(`   Authors normalized: ${actualNovel.normalizedAuthors.join(', ')}`);
console.log(`   Score: ${novelScore} (${actualNovel.editions.length} editions)`);
console.log(`\n2. "${studyGuide1.title}" by ${studyGuide1.authors.join(', ')}`);
console.log(`   Authors normalized: ${studyGuide1.normalizedAuthors.join(', ')}`);
console.log(`   Score: ${guide1Score} (${studyGuide1.editions.length} editions)`);
console.log(`\n3. "${studyGuide2.title}" by ${studyGuide2.authors.join(', ')}`);
console.log(`   Authors normalized: ${studyGuide2.normalizedAuthors.join(', ')}`);
console.log(`   Score: ${guide2Score} (${studyGuide2.editions.length} editions)`);

const test1Pass = novelScore > guide1Score && novelScore > guide2Score;
console.log(`\n✓ RESULT: ${test1Pass ? 'PASS - Novel ranks highest' : 'FAIL - Secondary literature ranks higher'}`);

// Summary
console.log('\n' + '='.repeat(80));
console.log(`OVERALL: ${test1Pass ? '✓ ALL TESTS PASSED' : '✗ TESTS FAILED'}`);
console.log('='.repeat(80));

process.exit(test1Pass ? 0 : 1);
