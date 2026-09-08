/**
 * Picks the works the cover index is built over (ROADMAP 5.1, 6.10).
 *
 * A first cut at the ~500 list of 5.1, at fifty. Not scraped from a "most
 * popular" endpoint, because for a site about covers the useful measure is
 * not how many people read a book but **how often it has been dressed
 * again** — and because Open Library has no such endpoint anyway.
 *
 * So: a seed list of titles, resolved through our own search, which already
 * ranks the work above its study guides (F1.4). Each hit must clear a
 * threshold of edition records, and no author may take more than two slots,
 * or half the list would be Tolkien and Kafka. The twelve works of the home
 * page are always in, so the wall and the index agree.
 *
 * Run: npx tsx scripts/pick-index-works.ts
 * Writes data/index-works.json; commit the result.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { CURATED_WORKS } from '../lib/curated';
import { search } from '../lib/search';
import { authorMatchKey } from '../lib/normalize';

/** Enough printings that the wall shows a range of designs. */
const MIN_EDITIONS = 25;
const MAX_PER_AUTHOR = 2;
const TARGET = 50;

/**
 * Chosen by hand for spread: five centuries, eight languages of origin,
 * novels and one treatise, and books whose jackets have actually changed.
 */
const SEEDS: Array<[title: string, author: string]> = [
  ['Pride and Prejudice', 'Jane Austen'],
  ['Frankenstein', 'Mary Shelley'],
  ['Dracula', 'Bram Stoker'],
  ['Jane Eyre', 'Charlotte Brontë'],
  ['Wuthering Heights', 'Emily Brontë'],
  ['Crime and Punishment', 'Fyodor Dostoevsky'],
  ['Anna Karenina', 'Leo Tolstoy'],
  ['Madame Bovary', 'Gustave Flaubert'],
  ['Don Quixote', 'Miguel de Cervantes'],
  ['The Trial', 'Franz Kafka'],
  ['Die Verwandlung', 'Franz Kafka'],
  ['Der Zauberberg', 'Thomas Mann'],
  ['Der Steppenwolf', 'Hermann Hesse'],
  ['Siddhartha', 'Hermann Hesse'],
  ['The Stranger', 'Albert Camus'],
  ['One Hundred Years of Solitude', 'Gabriel García Márquez'],
  ['Things Fall Apart', 'Chinua Achebe'],
  ['Invisible Man', 'Ralph Ellison'],
  ['To Kill a Mockingbird', 'Harper Lee'],
  ['Catch-22', 'Joseph Heller'],
  ['Slaughterhouse-Five', 'Kurt Vonnegut'],
  ['Brave New World', 'Aldous Huxley'],
  ['Fahrenheit 451', 'Ray Bradbury'],
  ['The Left Hand of Darkness', 'Ursula K. Le Guin'],
  ['Foundation', 'Isaac Asimov'],
  ['Do Androids Dream of Electric Sheep', 'Philip K. Dick'],
  ['The Hobbit', 'J. R. R. Tolkien'],
  ['The Lord of the Rings', 'J. R. R. Tolkien'],
  ['Heart of Darkness', 'Joseph Conrad'],
  ['The Old Man and the Sea', 'Ernest Hemingway'],
  ['On the Road', 'Jack Kerouac'],
  ['Naked Lunch', 'William S. Burroughs'],
  ['The Bell Jar', 'Sylvia Plath'],
  ['Mrs Dalloway', 'Virginia Woolf'],
  ['Also sprach Zarathustra', 'Friedrich Nietzsche'],
  ['Die Blechtrommel', 'Günter Grass'],
  ['The Unbearable Lightness of Being', 'Milan Kundera'],
  ['The Remains of the Day', 'Kazuo Ishiguro'],
  ['Norwegian Wood', 'Haruki Murakami'],
  ['Wolf Hall', 'Hilary Mantel'],
  ['The Master and Margarita', 'Mikhail Bulgakov'],
  ['The Handmaid’s Tale', 'Margaret Atwood'],
  ['A Confederacy of Dunces', 'John Kennedy Toole'],
  ['If on a Winter’s Night a Traveler', 'Italo Calvino'],
  ['Half of a Yellow Sun', 'Chimamanda Ngozi Adichie'],
  ['The Sellout', 'Paul Beatty'],
  ['Der Prozess', 'Franz Kafka'],
  ['Lord of the Flies', 'William Golding'],
  ['The Catcher in the Rye', 'J. D. Salinger'],
  ['Mumbo Jumbo', 'Ishmael Reed'],
];

export interface IndexWork {
  id: string;
  title: string;
  author: string;
  editionCount: number;
  /** Why it is in the list, so a later reader can judge the selection. */
  source: 'curated' | 'seed';
}

async function main() {
  const picked = new Map<string, IndexWork>();
  const perAuthor = new Map<string, number>();

  const take = (w: IndexWork) => {
    if (picked.has(w.id)) return false;
    const key = authorMatchKey(w.author);
    const used = perAuthor.get(key) ?? 0;
    if (w.source === 'seed' && used >= MAX_PER_AUTHOR) {
      console.log(`  übersprungen (${MAX_PER_AUTHOR} je Autor): ${w.title} — ${w.author}`);
      return false;
    }
    picked.set(w.id, w);
    perAuthor.set(key, used + 1);
    return true;
  };

  // The home page wall first, unconditionally: the two lists must not diverge.
  for (const w of CURATED_WORKS) {
    take({ id: w.id, title: w.title, author: w.author, editionCount: 0, source: 'curated' });
  }
  console.log(`${picked.size} kuratierte Werke übernommen.\n`);

  for (const [title, author] of SEEDS) {
    if (picked.size >= TARGET) break;
    let result;
    try {
      result = await search(`${title} ${author}`);
    } catch (err) {
      console.log(`  Quelle schwieg bei "${title}": ${(err as Error).message}`);
      continue;
    }
    const hit = result.works.find(w => authorMatchKey(w.authors[0] ?? '') === authorMatchKey(author)) ?? result.works[0];
    if (!hit) {
      console.log(`  kein Treffer: ${title}`);
      continue;
    }
    const editions = hit.editionCount ?? 0;
    if (editions < MIN_EDITIONS) {
      console.log(`  zu wenige Ausgaben (${editions} < ${MIN_EDITIONS}): ${hit.title} — ${hit.authors[0]}`);
      continue;
    }
    if (take({ id: hit.id, title: hit.title, author: hit.authors[0] ?? author, editionCount: editions, source: 'seed' })) {
      console.log(`  ${String(picked.size).padStart(2)}. ${hit.title.slice(0, 40).padEnd(42)} ${(hit.authors[0] ?? '').slice(0, 22).padEnd(24)} ${editions} Ausgaben`);
    }
  }

  const works = [...picked.values()];
  const out = path.join(process.cwd(), 'data', 'index-works.json');
  writeFileSync(out, JSON.stringify({ pickedAt: new Date().toISOString().slice(0, 10), works }, null, 2) + '\n');
  console.log(`\n${works.length} Werke in data/index-works.json.`);
}

main();
