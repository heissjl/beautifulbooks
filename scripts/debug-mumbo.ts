import { bookAggregator } from '../lib/aggregator';

async function debugMumboJumbo() {
  console.log('=== Debugging "mumbo jumbo" search ===\n');

  const results = await bookAggregator.search('mumbo jumbo', { language: 'en' });

  console.log(`\nFound ${results.length} works:\n`);

  results.forEach((work, index) => {
    console.log(`\n--- Work ${index + 1} ---`);
    console.log(`Title: ${work.title}`);
    console.log(`Authors: ${work.authors.join(', ') || 'NONE'}`);
    console.log(`Normalized Authors: ${work.normalizedAuthors.join(', ') || 'NONE'}`);
    console.log(`Work ID: ${work.workId}`);
    console.log(`Editions: ${work.editions.length}`);

    console.log('\nEditions in this work:');
    work.editions.forEach((edition, edIdx) => {
      console.log(`  ${edIdx + 1}. ${edition.title}`);
      console.log(`     Authors: ${edition.authors?.join(', ') || 'NONE'}`);
      console.log(`     Language: ${edition.language || 'NONE'}`);
      console.log(`     Publisher: ${edition.publisher || 'NONE'}`);
      console.log(`     Year: ${edition.publishedDate || 'NONE'}`);
      console.log(`     ID: ${edition.id}`);
    });
  });
}

debugMumboJumbo().catch(console.error);
