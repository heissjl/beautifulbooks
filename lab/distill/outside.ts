/**
 * The held-out works: books the index does not hold, so the student is tested
 * on covers it has never seen and on kinds of book the index lacks — thrillers,
 * romance, non-fiction, children's picture books, German bestsellers, recent
 * titles with few editions.
 *
 *   npx tsx lab/distill/outside.ts           # resolve the works and their covers
 *   npx tsx lab/distill/outside.ts --embed   # then the teacher vectors (never while teacher.ts runs:
 *                                            # both write lab/clip's one vector file)
 *
 * Resolves each title through Open Library's search (no Google, lab rule 6),
 * takes the covers of the first edition page, and writes outside-works.json
 * (committed, so the held-out set does not drift) plus teacher vectors into
 * lab/clip's cache. One work at a time: Open Library is slow, and that is fine.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { embedCovers } from '../clip/clip';

const ROOT = join(__dirname, '..', '..');
const OUT_FILE = join(__dirname, 'outside-works.json');
/** Per work, so one book with 300 printings does not outweigh thirty with ten. */
const MAX_COVERS = 40;

const SEEDS: Array<[title: string, author: string]> = [
  ['The Da Vinci Code', 'Dan Brown'],
  ['The Girl with the Dragon Tattoo', 'Stieg Larsson'],
  ['Where the Crawdads Sing', 'Delia Owens'],
  ['The Midnight Library', 'Matt Haig'],
  ['Sapiens', 'Yuval Noah Harari'],
  ['Educated', 'Tara Westover'],
  ['Becoming', 'Michelle Obama'],
  ['Thinking, Fast and Slow', 'Daniel Kahneman'],
  ['Eat, Pray, Love', 'Elizabeth Gilbert'],
  ['The Notebook', 'Nicholas Sparks'],
  ['Fifty Shades of Grey', 'E. L. James'],
  ['The Girl on the Train', 'Paula Hawkins'],
  ['The Hunt for Red October', 'Tom Clancy'],
  ['Jurassic Park', 'Michael Crichton'],
  ['Misery', 'Stephen King'],
  ['Pet Sematary', 'Stephen King'],
  ['Ready Player One', 'Ernest Cline'],
  ['Project Hail Mary', 'Andy Weir'],
  ['The Martian', 'Andy Weir'],
  ['The Three-Body Problem', 'Liu Cixin'],
  ['The Lightning Thief', 'Rick Riordan'],
  ['Diary of a Wimpy Kid', 'Jeff Kinney'],
  ['The Very Hungry Caterpillar', 'Eric Carle'],
  ['Der Schwarm', 'Frank Schätzing'],
  ['Tschick', 'Wolfgang Herrndorf'],
  ['Die Känguru-Chroniken', 'Marc-Uwe Kling'],
  ['Der Medicus', 'Noah Gordon'],
  ['Das Boot', 'Lothar-Günther Buchheim'],
  ['Harry Potter and the Chamber of Secrets', 'J. K. Rowling'],
  ['A Brief History of Time', 'Stephen Hawking'],
  ['Silent Spring', 'Rachel Carson'],
  ['Outlander', 'Diana Gabaldon'],
  ["Bridget Jones's Diary", 'Helen Fielding'],
  ['The Pillars of the Earth', 'Ken Follett'],
  ['Shōgun', 'James Clavell'],
  ['The Joy Luck Club', 'Amy Tan'],
  ['The Lovely Bones', 'Alice Sebold'],
  ['Room', 'Emma Donoghue'],
  ['The Help', 'Kathryn Stockett'],
  ['Eragon', 'Christopher Paolini'],
  ['Wonder', 'R. J. Palacio'],
  ['Divergent', 'Veronica Roth'],
  ['The Poisonwood Bible', 'Barbara Kingsolver'],
];

interface OutsideWork {
  title: string;
  author: string;
  workId: string;
  editionCount: number;
  covers: string[];
}

async function getJson<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'beautifulbooks/lab-distill (held-out covers)' },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // a timeout is not an answer; try again
    }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  return null;
}

async function main() {
  const index = JSON.parse(readFileSync(join(ROOT, 'data/cover-index.json'), 'utf8')) as {
    works: Array<[string, string, string]>;
  };
  const inIndex = new Set(index.works.map((w) => w[0]));
  const done: OutsideWork[] = existsSync(OUT_FILE) ? JSON.parse(readFileSync(OUT_FILE, 'utf8')).works : [];
  const have = new Set(done.map((w) => w.title));

  for (const [title, author] of SEEDS) {
    if (have.has(title)) continue;
    const q = `title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1&fields=key,title,edition_count`;
    const search = await getJson<{ docs: Array<{ key: string; title: string; edition_count: number }> }>(
      `https://openlibrary.org/search.json?${q}`,
    );
    const doc = search?.docs[0];
    if (!doc) {
      console.log(`  ${title}: not found or no answer`);
      continue;
    }
    const workId = doc.key.replace('/works/', '');
    if (inIndex.has(workId)) {
      console.log(`  ${title}: already in the index, skipped`);
      continue;
    }
    const editions = await getJson<{ entries: Array<{ covers?: number[] }> }>(
      `https://openlibrary.org/works/${workId}/editions.json?limit=100`,
    );
    if (!editions) {
      console.log(`  ${title}: editions did not answer`);
      continue;
    }
    const covers = [...new Set(editions.entries.flatMap((e) => (e.covers ?? []).filter((c) => c > 0)))]
      .slice(0, MAX_COVERS)
      .map((c) => `ol:${c}`);
    done.push({ title, author, workId, editionCount: doc.edition_count, covers });
    writeFileSync(OUT_FILE, `${JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), maxCovers: MAX_COVERS, works: done }, null, 1)}\n`);
    console.log(`  ${title} (${workId}): ${doc.edition_count} editions, ${covers.length} covers`);
  }

  const ids = done.flatMap((w) => w.covers);
  if (!process.argv.includes('--embed')) {
    console.log(`${done.length} works outside the index, ${ids.length} covers; vectors with --embed`);
    return;
  }
  const vectors = await embedCovers(ids);
  console.log(`${done.length} works outside the index, ${ids.length} covers, ${[...vectors.values()].filter(Boolean).length} with a vector`);
}

main();
