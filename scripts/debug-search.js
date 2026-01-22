/**
 * Debug script to see what the aggregator is actually returning
 * This helps us understand why the wrong books are showing up
 */

async function debugSearch() {
  console.log('Fetching search results for "pynchon gravity\'s rainbow"...\n');

  try {
    const response = await fetch('http://localhost:3000/api/search?q=pynchon%20gravitys%20rainbow&language=en');

    if (!response.ok) {
      console.error('API request failed:', response.status);
      return;
    }

    const data = await response.json();

    console.log(`Found ${data.length} works:\n`);
    console.log('='.repeat(80));

    data.forEach((work, index) => {
      console.log(`\n${index + 1}. "${work.title}"`);
      console.log(`   By: ${work.authors.join(', ')}`);
      console.log(`   Editions: ${work.editions.length}`);
      console.log(`   Work ID: ${work.workId}`);
      if (work.primaryEdition) {
        console.log(`   Primary Edition: ${work.primaryEdition.id}`);
      }
    });

    console.log('\n' + '='.repeat(80));

    // Check if actual novel is in results
    const hasActualNovel = data.some(work =>
      work.authors.some(author => author.toLowerCase().includes('pynchon')) &&
      work.title.toLowerCase() === "gravity's rainbow"
    );

    console.log(hasActualNovel
      ? '✓ Actual novel by Pynchon found in results'
      : '✗ Actual novel by Pynchon NOT found in results');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugSearch();
